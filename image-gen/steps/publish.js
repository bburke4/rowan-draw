import fs from "node:fs";
import path from "node:path";
import { readState, readManifest, writeManifest, readCatalog } from "../lib/state.js";
import { generateId } from "../lib/ids.js";

const BASE_DIR = path.join(import.meta.dirname, "..");
const LIBRARY_DIR = path.join(BASE_DIR, "library");

export async function runPublish(flags) {
  const review = readState("review.json", { decisions: {}, skipped: [], feedback: {} });
  const tagging = readState("tagging.json", { tagged: {} });
  const generation = readState("generation.json", { generated: {} });
  const manifest = readManifest();
  const catalog = readCatalog();
  const dryRun = flags["dry-run"];

  // Sync category tags from catalog to manifest
  for (const [category, { tags }] of Object.entries(catalog.categories)) {
    manifest.categories[category] = { tags };
  }

  // Find picked + tagged images not yet published
  // decisions is { variantKey: imagePath }
  const alreadyPublished = new Set(
    Object.values(manifest.images).map((img) => img.sourceFile)
  );

  const pending = [];
  for (const [variantKey, imagePath] of Object.entries(review.decisions)) {
    if (!tagging.tagged[imagePath]) continue;
    if (alreadyPublished.has(imagePath)) continue;
    pending.push(imagePath);
  }

  if (pending.length === 0) {
    console.log("Nothing to publish — all picked+tagged images are already in the manifest.");
    return;
  }

  if (dryRun) {
    console.log(`Would publish ${pending.length} images.`);
    return;
  }

  console.log(`Publishing ${pending.length} images...\n`);

  let published = 0;
  for (const imagePath of pending) {
    // Parse the path: generated/{category}/{subject}/{variant-slug}/{filename}
    const parts = imagePath.split("/");
    if (parts.length < 5) {
      console.warn(`  Unexpected path format: ${imagePath}, skipping`);
      continue;
    }
    const [, category, subject, variantSlug, filename] = parts;

    const tag = tagging.tagged[imagePath];
    const id = generateId(category, subject, variantSlug);

    // Copy image to library
    const ext = path.extname(filename);
    const libraryRelPath = path.join(category, subject, `${id}${ext}`);
    const libraryFullPath = path.join(LIBRARY_DIR, libraryRelPath);

    fs.mkdirSync(path.dirname(libraryFullPath), { recursive: true });
    fs.copyFileSync(path.join(BASE_DIR, imagePath), libraryFullPath);

    // Find the original prompt from generation data
    const genKey = `${category}/${subject}/${variantSlug}`;
    const genData = generation.generated[genKey];
    const prompt = genData?.prompt || "";

    manifest.images[id] = {
      file: `library/${libraryRelPath}`,
      category,
      subject,
      tags: tag.tags,
      difficulty: tag.difficulty,
      added: new Date().toISOString().slice(0, 10),
      prompt,
      sourceFile: imagePath,
    };

    console.log(`  ${id} → library/${libraryRelPath}`);
    published++;
  }

  writeManifest(manifest);
  console.log(`\nDone. Published ${published} images. Manifest now has ${Object.keys(manifest.images).length} total.`);
}
