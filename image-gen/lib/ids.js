import { readManifest } from "./state.js";
import { slugify } from "./prompts.js";

/**
 * Generate a stable ID for a published image.
 * Format: {category}-{subject}-{variant-slug}-{NNN}
 */
export function generateId(category, subject, variantSlug) {
  const manifest = readManifest();
  const prefix = `${slugify(category)}-${slugify(subject)}-${slugify(variantSlug)}-`;

  let maxNum = 0;
  for (const id of Object.keys(manifest.images)) {
    if (id.startsWith(prefix)) {
      const num = parseInt(id.slice(prefix.length), 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
}
