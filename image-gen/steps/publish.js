import fs from "node:fs";
import path from "node:path";
import { getDb } from "../lib/db.js";

const BASE_DIR = path.join(import.meta.dirname, "..");
const WEB_DIR = path.join(BASE_DIR, "..", "web");
const WEB_PUBLIC_DIR = path.join(WEB_DIR, "public");
const WEB_MANIFEST_PATH = path.join(WEB_PUBLIC_DIR, "manifest.json");
const BASE_MANIFEST_PATH = path.join(BASE_DIR, "manifest.json");
const MANIFEST_PATH = fs.existsSync(WEB_PUBLIC_DIR) ? WEB_MANIFEST_PATH : BASE_MANIFEST_PATH;

export async function runPublish(flags) {
  const db = getDb();
  const dryRun = flags["dry-run"];

  const pending = db.prepare(`
    SELECT 
      i.id AS image_id,
      i.public_id,
      i.file_path,
      i.image_description,
      i.difficulty_score,
      i.tags_json,
      v.slug AS variant_slug,
      v.description AS variant_description,
      COALESCE(v.custom_prompt, v.base_prompt) AS prompt,
      s.slug AS subject_slug,
      c.slug AS category_slug
    FROM images i
    JOIN variants v ON i.variant_id = v.id
    JOIN subjects s ON v.subject_id = s.id
    JOIN categories c ON s.category_id = c.id
    WHERE i.status = 'accepted' AND i.difficulty_score IS NOT NULL AND i.tags_json IS NOT NULL AND i.is_published = 0
  `).all();

  if (pending.length === 0) {
    console.log("Nothing to publish — all accepted and tagged images in SQLite are already published.");
    return;
  }

  if (dryRun) {
    console.log(`Would publish ${pending.length} accepted images from SQLite.`);
    return;
  }

  console.log(`Publishing ${pending.length} images from SQLite...\n`);

  let manifest = { version: "1.0", categories: {}, images: {} };
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    } catch {}
  }

  const categories = db.prepare("SELECT slug, name FROM categories").all();
  for (const cat of categories) {
    if (!manifest.categories[cat.slug]) {
      manifest.categories[cat.slug] = { name: cat.name };
    }
  }

  const markPublishedStmt = db.prepare(`
    UPDATE images
    SET is_published = 1, published_path = ?, published_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  let published = 0;
  for (const img of pending) {
    const srcFullPath = path.join(BASE_DIR, img.file_path);
    if (!fs.existsSync(srcFullPath)) {
      console.warn(`  Source file not found: ${img.file_path}, skipping`);
      continue;
    }

    const ext = path.extname(img.file_path) || ".png";
    const libraryRelPath = path.join("library", img.category_slug, img.subject_slug, `${img.public_id}${ext}`);
    const webLibraryFullPath = path.join(WEB_PUBLIC_DIR, libraryRelPath);

    // Single production target: Copy from raw staging (generated/) directly into web/public/library/
    fs.mkdirSync(path.dirname(webLibraryFullPath), { recursive: true });
    fs.copyFileSync(srcFullPath, webLibraryFullPath);

    let tagsArr = [];
    try {
      tagsArr = JSON.parse(img.tags_json);
    } catch {}

    manifest.images[img.public_id] = {
      file: libraryRelPath,
      category: img.category_slug,
      subject: img.subject_slug,
      variant: img.variant_slug,
      description: img.image_description || img.variant_description,
      tags: tagsArr,
      difficulty: img.difficulty_score,
      added: new Date().toISOString().slice(0, 10),
      prompt: img.prompt,
      sourceFile: img.file_path,
    };

    markPublishedStmt.run(libraryRelPath, img.image_id);
    console.log(`  Published ${img.public_id} → ${webLibraryFullPath}`);
    published++;
  }

  // Write manifest.json to production target (web/public/manifest.json)
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  // Also keep a copy at image-gen/manifest.json for convenience if BASE_DIR manifest is separate
  const baseManifestPath = path.join(BASE_DIR, "manifest.json");
  if (baseManifestPath !== MANIFEST_PATH) {
    fs.writeFileSync(baseManifestPath, JSON.stringify(manifest, null, 2));
  }

  console.log(`\nDone. Published ${published} images. Manifest now has ${Object.keys(manifest.images).length} total images.`);
}
