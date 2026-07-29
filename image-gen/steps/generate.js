import fs from "node:fs";
import path from "node:path";
import { getClient } from "../lib/gemini.js";
import { getDb } from "../lib/db.js";

const COST_MAP = {
  "gemini-3.1-flash-lite-image": 0.034,
  "gemini-3.1-flash-image": 0.067,
  "imagen-4.0-fast-generate-001": 0.020,
  "gemini-3-pro-image": 0.134,
};

const IMAGES_PER_VARIANT = 4;
const DELAY_MS = 3000;
const MAX_RETRIES = 3;

const GENERATED_DIR = path.join(import.meta.dirname, "..", "generated");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runGenerate(flags) {
  const db = getDb();
  const filterCategory = flags.category;
  const filterSubject = flags.subject;
  const dryRun = flags["dry-run"];
  const force = flags.force || false;
  const limit = flags.limit ? parseInt(flags.limit, 10) : Infinity;
  const modelFlag = flags.model || "auto"; // 'auto', 'lite', 'standard', 'imagen'

  let query = `
    SELECT 
      v.id AS variant_id,
      v.slug AS variant_slug,
      v.description,
      v.base_prompt,
      v.custom_prompt,
      v.feedback_history,
      s.slug AS subject_slug,
      s.name AS subject_name,
      s.subject_type,
      c.slug AS category_slug
    FROM variants v
    JOIN subjects s ON v.subject_id = s.id
    JOIN categories c ON s.category_id = c.id
    WHERE v.status = 'active'
  `;
  const conditions = [];
  const params = [];

  if (filterCategory) {
    conditions.push("c.slug = ?");
    params.push(filterCategory);
  }
  if (filterSubject) {
    conditions.push("s.slug = ?");
    params.push(filterSubject);
  }

  if (conditions.length > 0) {
    query += " AND " + conditions.join(" AND ");
  }

  const allVariants = db.prepare(query).all(...params);
  const checkGenStmt = db.prepare("SELECT COUNT(*) AS count FROM images WHERE variant_id = ?");

  const pending = [];
  for (const v of allVariants) {
    const existingCount = checkGenStmt.get(v.variant_id).count;
    if (existingCount === 0 || force) {
      pending.push(v);
    }
  }

  if (pending.length === 0) {
    console.log("Nothing to generate — all active variants already have candidate images in SQLite.");
    return;
  }

  const toProcess = pending.slice(0, limit);

  if (dryRun) {
    console.log(`Would generate ${toProcess.length} variants (${toProcess.length * IMAGES_PER_VARIANT} images)`);
    console.log(`Model selection flag: ${modelFlag}`);
    return;
  }

  const ai = getClient();
  let processed = 0;

  const insertRunStmt = db.prepare(`
    INSERT INTO generation_runs (variant_id, model_id, api_method, prompt_used, feedback_given, cost, image_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertImgStmt = db.prepare(`
    INSERT INTO images (public_id, variant_id, generation_run_id, file_path, status)
    VALUES (?, ?, ?, ?, 'pending')
  `);

  for (const v of toProcess) {
    const genKey = `${v.category_slug}/${v.subject_slug}/${v.variant_slug}`;
    const outDir = path.join(GENERATED_DIR, v.category_slug, v.subject_slug, v.variant_slug);
    fs.mkdirSync(outDir, { recursive: true });

    // Determine model to use
    let selectedModel = "gemini-3.1-flash-lite-image"; // Default Lite
    if (modelFlag === "standard" || (modelFlag === "auto" && v.subject_type === "DETAIL-PRONE")) {
      selectedModel = "gemini-3.1-flash-image";
    } else if (modelFlag === "imagen") {
      selectedModel = "imagen-4.0-fast-generate-001";
    } else if (modelFlag === "lite") {
      selectedModel = "gemini-3.1-flash-lite-image";
    }

    // If retry/feedback present, upgrade to standard model for higher fidelity
    if (v.feedback_history && selectedModel === "gemini-3.1-flash-lite-image") {
      selectedModel = "gemini-3.1-flash-image";
    }

    let prompt = v.custom_prompt || v.base_prompt;
    if (v.feedback_history) {
      prompt += ` Avoid previous issue: ${v.feedback_history}.`;
    }

    console.log(`[${processed + 1}/${toProcess.length}] Generating: ${genKey} (${selectedModel})`);

    let success = false;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const savedImages = [];

        if (selectedModel.includes("imagen")) {
          // Dedicated Imagen API
          const response = await ai.models.generateImages({
            model: selectedModel,
            prompt,
            config: { numberOfImages: IMAGES_PER_VARIANT },
          });

          let idx = 1;
          for (const img of response.generatedImages || []) {
            const buffer = Buffer.from(img.image.imageBytes, "base64");
            const relPath = path.join("generated", v.category_slug, v.subject_slug, v.variant_slug, `${v.variant_slug}-${idx}.png`);
            fs.writeFileSync(path.join(GENERATED_DIR, "..", relPath), buffer);
            savedImages.push(relPath);
            idx++;
          }
        } else {
          // Interactions API (Nano Banana 2 Lite / Standard / Pro)
          for (let i = 1; i <= IMAGES_PER_VARIANT; i++) {
            const interaction = await ai.interactions.create({
              model: selectedModel,
              input: prompt,
            });

            if (interaction.output_image) {
              const buffer = Buffer.from(interaction.output_image.data, "base64");
              const relPath = path.join("generated", v.category_slug, v.subject_slug, v.variant_slug, `${v.variant_slug}-${i}.png`);
              fs.writeFileSync(path.join(GENERATED_DIR, "..", relPath), buffer);
              savedImages.push(relPath);
            }
          }
        }

        const costPerImg = COST_MAP[selectedModel] || 0.034;
        const totalRunCost = savedImages.length * costPerImg;
        const apiMethod = selectedModel.includes("imagen") ? "generateImages" : "interactions";

        const runRes = insertRunStmt.run(
          v.variant_id,
          selectedModel,
          apiMethod,
          prompt,
          v.feedback_history || null,
          totalRunCost,
          savedImages.length
        );

        let imgIdx = 1;
        for (const imgPath of savedImages) {
          const publicId = `img_${v.category_slug}_${v.subject_slug}_${v.variant_slug}_${Date.now()}_${imgIdx++}`;
          insertImgStmt.run(publicId, v.variant_id, runRes.lastInsertRowid, imgPath);
        }

        console.log(`  Saved ${savedImages.length} images to SQLite ($${totalRunCost.toFixed(3)})`);
        success = true;
        break;
      } catch (err) {
        if (err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED")) {
          console.warn(`  Rate limited — waiting 20s before retry (attempt ${attempt}/${MAX_RETRIES})`);
          await sleep(20000);
        } else {
          console.error(`  Error: ${err.message}`);
          break;
        }
      }
    }

    if (!success) {
      console.error("  Failed after retries, stopping.");
      break;
    }

    processed++;
    if (processed < toProcess.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nDone. Generated ${processed} variants into SQLite.`);
}
