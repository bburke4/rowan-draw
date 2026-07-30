import fs from "node:fs";
import path from "node:path";
import { getClient } from "../lib/gemini.js";
import { getDb } from "../lib/db.js";

const BASE_DIR = path.join(import.meta.dirname, "..");

const SYSTEM_PROMPT = `You are evaluating simple black-and-white line art drawings for a kids drawing reference app. \
Kids (ages 3-7) will look at these drawings and try to recreate them on paper.

For each image, provide:

1. A concise 5-10 word visual description of what is actually drawn in this specific image (e.g. "Sitting cat facing forward with big round eyes", "Side profile racecar with oversized rear wheels"). Keep it short and factual.

2. A difficulty score (1, 2, or 3) based on how hard it would be for a young child to draw:
   Level 1: "I can do that!" — a few big shapes, straight lines, very forgiving
   Level 2: Recognizable subject, needs some care with placement and curves
   Level 3: Challenging — many parts, curves, detail work, things need to line up

3. Brief reasoning for the difficulty score.

4. Search tags — 3 to 8 child-friendly search terms (e.g. "cat", "kitty", "pet").

Return JSON with fields: imageDescription (string 5-10 words), difficulty (number 1-3), difficultyReasoning (string), tags (string array)`;

export async function runTag(flags) {
  const db = getDb();
  const dryRun = flags["dry-run"];

  const pending = db.prepare(`
    SELECT id, public_id, file_path
    FROM images
    WHERE status = 'accepted' AND (difficulty_score IS NULL OR tags_json IS NULL OR image_description IS NULL)
  `).all();

  if (pending.length === 0) {
    console.log("Nothing to tag — all accepted images in SQLite are already described and tagged.");
    return;
  }

  if (dryRun) {
    console.log(`Would describe and tag ${pending.length} accepted images using gemini-3.6-flash.`);
    return;
  }

  console.log(`Describing and tagging ${pending.length} accepted images with gemini-3.6-flash...\n`);

  const updateImgStmt = db.prepare(`
    UPDATE images
    SET image_description = ?, difficulty_score = ?, difficulty_reasoning = ?, tags_json = ?, tagged_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  let tagged = 0;
  for (const img of pending) {
    const fullPath = path.join(BASE_DIR, img.file_path);

    if (!fs.existsSync(fullPath)) {
      console.warn(`  Image file not found: ${img.file_path}, skipping`);
      continue;
    }

    console.log(`[${tagged + 1}/${pending.length}] ${img.file_path}`);

    const imageData = fs.readFileSync(fullPath);
    const base64 = imageData.toString("base64");

    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/png", data: base64 } },
            { text: "Evaluate this drawing and return imageDescription (5-10 words), difficulty score, reasoning, and search tags." },
          ],
        },
      ],
      config: {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        responseMimeType: "application/json",
      },
    });

    try {
      const parsed = JSON.parse(response.text);
      const tagsJson = JSON.stringify(parsed.tags || []);
      updateImgStmt.run(parsed.imageDescription || null, parsed.difficulty, parsed.difficultyReasoning, tagsJson, img.id);

      console.log(`  Description: ${parsed.imageDescription}`);
      console.log(`  Difficulty: Level ${parsed.difficulty} — ${parsed.difficultyReasoning}`);
      console.log(`  Tags: ${(parsed.tags || []).join(", ")}`);
      tagged++;
    } catch {
      console.warn(`  Failed to parse tagging response for ${img.file_path}`);
      continue;
    }
  }

  console.log(`\nDone. Described & tagged ${tagged} images in SQLite.`);
}
