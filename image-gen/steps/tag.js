import fs from "node:fs";
import path from "node:path";
import { getClient } from "../lib/gemini.js";
import { readState, writeState } from "../lib/state.js";

const BASE_DIR = path.join(import.meta.dirname, "..");

const SYSTEM_PROMPT = `You are evaluating simple black-and-white line art drawings for a kids drawing reference app. \
Kids (ages 3-7) will look at these drawings and try to recreate them on paper.

For each image, provide:

1. A difficulty score (1, 2, or 3) based on how hard it would be for a young child to draw:

   Scoring factors:
   - Stroke count: few shapes (5-10) = easier, many shapes (20+) = harder
   - Line type: straight lines and basic curves = easier, complex curves/S-shapes/spirals = harder
   - Precision required: shapes don't need to connect precisely = easier, features must be placed accurately (e.g., facial features) = harder
   - Symmetry: asymmetric or forgiving = easier, must look balanced (butterfly, face) = harder
   - Fine detail: no internal detail = easier, small features inside larger shapes = harder

   Level 1: "I can do that!" — a few big shapes, straight lines, very forgiving
   Level 2: Recognizable subject, needs some care with placement and curves
   Level 3: Challenging — many parts, curves, detail work, things need to line up

2. Brief reasoning for the difficulty score.

3. Search tags — alternate words someone might search to find this image. Include:
   - The subject name itself
   - Child-friendly synonyms (e.g., "kitty" for cat, "dino" for dinosaur)
   - Descriptive terms a parent or child might type
   - Keep it to 3-8 tags, practical not exhaustive

Return JSON with fields: difficulty (number), difficultyReasoning (string), tags (string array)`;

export async function runTag(flags) {
  const review = readState("review.json", { decisions: {}, skipped: [], feedback: {} });
  const tagging = readState("tagging.json", { tagged: {} });
  const dryRun = flags["dry-run"];

  // Find picked but untagged images
  // decisions is now { variantKey: imagePath } (one pick per variant)
  const pending = [];
  for (const [variantKey, imagePath] of Object.entries(review.decisions)) {
    if (!tagging.tagged[imagePath]) {
      pending.push(imagePath);
    }
  }

  if (pending.length === 0) {
    console.log("Nothing to tag — all picked images are already tagged.");
    return;
  }

  if (dryRun) {
    console.log(`Would tag ${pending.length} accepted images.`);
    return;
  }

  console.log(`Tagging ${pending.length} images...\n`);

  let tagged = 0;
  for (const imagePath of pending) {
    const fullPath = path.join(BASE_DIR, imagePath);

    if (!fs.existsSync(fullPath)) {
      console.warn(`  Image not found: ${imagePath}, skipping`);
      continue;
    }

    console.log(`[${tagged + 1}/${pending.length}] ${imagePath}`);

    const imageData = fs.readFileSync(fullPath);
    const base64 = imageData.toString("base64");

    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/png", data: base64 } },
            { text: "Evaluate this drawing and return difficulty score, reasoning, and search tags." },
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
      tagging.tagged[imagePath] = {
        difficulty: parsed.difficulty,
        difficultyReasoning: parsed.difficultyReasoning,
        tags: parsed.tags,
        taggedAt: new Date().toISOString(),
      };
      console.log(`  Difficulty: ${parsed.difficulty} — ${parsed.difficultyReasoning}`);
      console.log(`  Tags: ${parsed.tags.join(", ")}`);
    } catch {
      console.warn(`  Failed to parse tagging response, skipping`);
      continue;
    }

    writeState("tagging.json", tagging);
    tagged++;
  }

  console.log(`\nDone. Tagged ${tagged} images.`);
}
