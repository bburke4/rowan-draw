import fs from "node:fs";
import path from "node:path";
import { getDb } from "../lib/db.js";

const BASE_DIR = path.join(import.meta.dirname, "..");
const PIPELINE_DIR = path.join(BASE_DIR, "pipeline");

function readJson(filename, fallback = {}) {
  const file = path.join(filename.startsWith("/") ? "" : PIPELINE_DIR, filename);
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function runMigration() {
  const db = getDb();
  console.log("Starting SQLite migration...");

  // 1. Migrate Categories and Subjects from catalog.json
  const catalog = readJson(path.join(BASE_DIR, "catalog.json"), { categories: {} });
  const catStmt = db.prepare("INSERT OR IGNORE INTO categories (slug, name, sort_order) VALUES (?, ?, ?)");
  const subStmt = db.prepare("INSERT OR IGNORE INTO subjects (category_id, slug, name, subject_type, sort_order) VALUES (?, ?, ?, ?, ?)");
  const getCatIdStmt = db.prepare("SELECT id FROM categories WHERE slug = ?");
  const getSubIdStmt = db.prepare("SELECT id FROM subjects WHERE category_id = ? AND slug = ?");

  let catIdx = 1;
  for (const [catSlug, catData] of Object.entries(catalog.categories || {})) {
    const catName = catSlug.charAt(0).toUpperCase() + catSlug.slice(1);
    catStmt.run(catSlug, catName, catIdx++);

    const catRow = getCatIdStmt.get(catSlug);
    if (!catRow) continue;

    let subIdx = 1;
    for (const subSlug of catData.subjects || []) {
      const subName = subSlug.charAt(0).toUpperCase() + subSlug.slice(1);
      // Rough type classification
      const isDetailProne = ["vehicles", "buildings"].includes(catSlug);
      const subjectType = isDetailProne ? "DETAIL-PRONE" : "ORGANIC";
      subStmt.run(catRow.id, subSlug, subName, subjectType, subIdx++);
    }
  }

  // 2. Migrate Variants from variants.json
  const variantsData = readJson("variants.json", { variants: {} });
  const varStmt = db.prepare(`
    INSERT INTO variants (subject_id, slug, description, base_prompt, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(subject_id, slug) DO UPDATE SET
      description = excluded.description,
      base_prompt = excluded.base_prompt
  `);

  let variantCount = 0;
  for (const [key, variantList] of Object.entries(variantsData.variants || {})) {
    const [catSlug, subSlug] = key.split("/");
    const catRow = getCatIdStmt.get(catSlug);
    if (!catRow) continue;
    const subRow = getSubIdStmt.get(catRow.id, subSlug);
    if (!subRow) continue;

    for (const v of variantList || []) {
      varStmt.run(subRow.id, v.slug, v.description, v.prompt, v.addedAt || new Date().toISOString());
      variantCount++;
    }
  }

  // 3. Migrate Generation Runs & Images from generation.json, review.json, tagging.json
  const genData = readJson("generation.json", { generated: {} });
  const reviewData = readJson("review.json", { decisions: {}, skipped: [], feedback: {} });
  const tagData = readJson("tagging.json", { tagged: {} });

  const getVarStmt = db.prepare(`
    SELECT v.id AS variant_id
    FROM variants v
    JOIN subjects s ON v.subject_id = s.id
    JOIN categories c ON s.category_id = c.id
    WHERE c.slug = ? AND s.slug = ? AND v.slug = ?
  `);

  const runStmt = db.prepare(`
    INSERT INTO generation_runs (variant_id, model_id, api_method, prompt_used, feedback_given, cost, image_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const imgStmt = db.prepare(`
    INSERT OR IGNORE INTO images (public_id, variant_id, generation_run_id, file_path, status, difficulty_score, difficulty_reasoning, tags_json, tagged_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let runCount = 0;
  let imageCount = 0;

  for (const [genKey, genInfo] of Object.entries(genData.generated || {})) {
    const [catSlug, subSlug, ...slugParts] = genKey.split("/");
    const varSlug = slugParts.join("/");

    const varRow = getVarStmt.get(catSlug, subSlug, varSlug);
    if (!varRow) continue;

    const feedback = reviewData.feedback?.[genKey] || null;
    const modelId = genInfo.model || "imagen-4.0-fast-generate-001";
    const apiMethod = modelId.includes("imagen") ? "generateImages" : "interactions";

    const runRes = runStmt.run(
      varRow.variant_id,
      modelId,
      apiMethod,
      genInfo.prompt || "",
      feedback,
      genInfo.cost || 0,
      genInfo.images?.length || 0,
      genInfo.generatedAt || new Date().toISOString()
    );
    const runId = runRes.lastInsertRowid;
    runCount++;

    const pickedImg = reviewData.decisions?.[genKey] || null;

    let imgIdx = 1;
    for (const imgPath of genInfo.images || []) {
      const isPicked = imgPath === pickedImg;
      const status = isPicked ? "accepted" : "pending";
      const publicId = `img_${catSlug}_${subSlug}_${varSlug}_${imgIdx++}`.replace(/[^a-z0-9_]/gi, "_");

      const tagInfo = tagData.tagged?.[imgPath] || {};
      const tagsJson = tagInfo.tags ? JSON.stringify(tagInfo.tags) : null;

      imgStmt.run(
        publicId,
        varRow.variant_id,
        runId,
        imgPath,
        status,
        tagInfo.difficulty || null,
        tagInfo.difficultyReasoning || null,
        tagsJson,
        tagInfo.taggedAt || null,
        genInfo.generatedAt || new Date().toISOString()
      );
      imageCount++;
    }
  }

  // Update skipped status
  const skipStmt = db.prepare(`
    UPDATE variants SET status = 'skipped'
    WHERE id IN (
      SELECT v.id FROM variants v
      JOIN subjects s ON v.subject_id = s.id
      JOIN categories c ON s.category_id = c.id
      WHERE (c.slug || '/' || s.slug || '/' || v.slug) = ?
    )
  `);
  for (const skippedKey of reviewData.skipped || []) {
    skipStmt.run(skippedKey);
  }

  console.log("Migration complete!");
  console.log(`- Variants: ${variantCount}`);
  console.log(`- Generation Runs: ${runCount}`);
  console.log(`- Images: ${imageCount}`);
}

if (process.argv[1] === path.dirname(import.meta.url) || process.argv[1].endsWith("migrate-to-sqlite.js")) {
  runMigration();
}
