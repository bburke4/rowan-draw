import fs from "node:fs";
import path from "node:path";
import { getDb } from "../lib/db.js";
import { geminiJson } from "../lib/gemini.js";
import { STYLE_PROMPT, NEGATIVE_SUFFIX, PRESETS } from "../lib/prompts.js";

const CATALOG_PATH = path.join(import.meta.dirname, "..", "catalog.json");

const SYSTEM_PROMPT = `You are helping build a kids drawing reference app. The app shows simple \
bold-line cartoon drawings that kids look at and try to draw themselves on paper.

When generating variants, think about what a child would actually ask for: \
"How do I draw a [thing]?" Each variant should be visually distinct from the others — \
a kid browsing should see real choices, not slight variations of the same pose.

## Difficulty Strategy: Hero Subjects vs. Regular Subjects

1. **HERO / HIGH-DEMAND SUBJECTS** (e.g. dog, cat, car, truck, house, dinosaur, tree, airplane, robot, boat, castle):
   - Intentionally generate a conscious spectrum of difficulty:
     * **1-2 Beginner / Toddler variants (Level 1)**: Extremely simple basic geometric shapes (~3-6 strokes, e.g. "simple box car with circle wheels", "basic sitting puppy with round head"). Use the ULTRA-SIMPLE style template: "${PRESETS.ultra_simple.stylePrompt}".
     * **4-6 Standard Cartoon variants (Level 2)**: Classic recognizable cartoon shapes (~8-12 strokes, e.g. "sedan", "convertible", "corgi", "sleeping cat"). Use the STANDARD style template: "${STYLE_PROMPT}".
     * **1-2 Dynamic / Advanced variants (Level 3)**: Multi-part objects or action poses (~12-18 strokes, e.g. "racecar with rear spoiler and racing stripes", "monster truck with giant tires", "dog catching a frisbee"). Use the DETAILED style template: "${PRESETS.detailed.stylePrompt}".

2. **REGULAR / SIMPLE SUBJECTS** (e.g. star, moon, apple, cookie, banana, flower, cloud):
   - Do NOT force artificial difficulty tiers. Generate 3-5 natural visual variants (e.g. "apple with leaf", "half apple slice", "apple with a bite taken out") using the STANDARD style template: "${STYLE_PROMPT}".

## Rules for descriptions & archetypes:
- NEVER mention brand names or trademarked characters (e.g., no "Bluey", no "Paw Patrol", no "Lightning McQueen").
- DO describe popular visual archetypes generically (e.g. "police dog puppy wearing a police cap", "spotted firefighter puppy wearing a firefighter helmet", "stock racecar with a lightning bolt decal").
- NEVER mention color names — all drawings are black and white line art.

## Building the image prompt

Use flat 2D views (side profile, front view, top-down) — never 3/4 or 3D perspective.

### 1. ORGANIC & EVERYDAY SUBJECTS (Animals, Food, Plants, Nature, Characters)
* **Rule: Keep it natural, simple, and concise!**
* Image models have incredible built-in cartoon priors for common objects (ice cream cones, cupcakes, dogs, apples, trees, pizza).
* **CRITICAL: DO NOT over-engineer geometric shape descriptions.** 
  - BAD: "An ice cream cone made of a triangular cone and a perfect circle sphere ball on top" (Creates rigid, awkward, disconnected lines).
  - GOOD: "A single cute cartoon ice cream cone with a scoop of ice cream on a waffle cone, front view"
  - BAD: "A sleeping cat curled up into a perfect circle shape with triangle ears"
  - GOOD: "A single cute cartoon sleeping cat lying down peacefully with head resting on paws, side profile view"
* Just describe the subject naturally in 1 clear phrase, specify the 2D view, and append the appropriate style template and negative suffix.

### 2. DETAIL-PRONE SUBJECTS (Vehicles, Machines, Complex Buildings)
* Only for mechanical / man-made things that image models tend to draw with too much realistic clutter (semi trucks, fire engines, airplanes, cranes):
  1. Describe the primary silhouette in simple box/cylinder blocks.
  2. Use "strict orthogonal [side / front / top] profile".
  3. Name the largest body region as blank empty canvas space (e.g. "trailer body is completely blank empty canvas with no logos or seams").

Example DETAIL-PRONE prompt:
"A single semi truck made of a small square cab on the left and a long blank rectangular trailer on the right, two round wheels under the cab and four round wheels under the trailer, strict orthogonal side profile view, the entire trailer body is completely blank empty canvas space with no logos, text, panel lines, or seams, ${STYLE_PROMPT}. ${NEGATIVE_SUFFIX}"

Style template: ${STYLE_PROMPT}
Negative instructions: ${NEGATIVE_SUFFIX}

## Output format

Return a JSON array of objects with these fields:
- "slug": URL-safe identifier (lowercase, hyphens, e.g., "sleeping-curled-up-cat")
- "description": Short human-readable description (e.g., "sleeping cat curled into a circle")
- "prompt": The full image generation prompt (with the appropriate style template and negative instructions written out in full, not as placeholders)`;

function syncCatalogToDb(db) {
  if (!fs.existsSync(CATALOG_PATH)) return;
  try {
    const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
    const catStmt = db.prepare("INSERT OR IGNORE INTO categories (slug, name, sort_order) VALUES (?, ?, ?)");
    const subStmt = db.prepare("INSERT OR IGNORE INTO subjects (category_id, slug, name, subject_type, sort_order) VALUES (?, ?, ?, ?, ?)");
    const getCatIdStmt = db.prepare("SELECT id FROM categories WHERE slug = ?");

    let catIdx = 1;
    for (const [catSlug, catData] of Object.entries(catalog.categories || {})) {
      const catName = catSlug.charAt(0).toUpperCase() + catSlug.slice(1);
      catStmt.run(catSlug, catName, catIdx++);
      const catRow = getCatIdStmt.get(catSlug);
      if (!catRow) continue;

      let subIdx = 1;
      for (const subSlug of catData.subjects || []) {
        const subName = subSlug.charAt(0).toUpperCase() + subSlug.slice(1);
        const isDetailProne = ["vehicles", "buildings"].includes(catSlug);
        const subjectType = isDetailProne ? "DETAIL-PRONE" : "ORGANIC";
        subStmt.run(catRow.id, subSlug, subName, subjectType, subIdx++);
      }
    }
  } catch (err) {
    console.warn("Could not sync catalog.json:", err.message);
  }
}

export async function runExpand(flags) {
  const db = getDb();
  syncCatalogToDb(db);

  const filterCategory = flags.category;
  const filterSubject = flags.subject;
  const force = flags.force || false;

  let query = `
    SELECT s.id AS subject_id, s.slug AS subject_slug, s.name AS subject_name, c.slug AS category_slug, c.name AS category_name
    FROM subjects s
    JOIN categories c ON s.category_id = c.id
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
    query += " WHERE " + conditions.join(" AND ");
  }

  const subjectsToExpand = db.prepare(query).all(...params);
  const checkVariantsStmt = db.prepare("SELECT COUNT(*) AS count FROM variants WHERE subject_id = ? AND status != 'skipped'");
  const insertVariantStmt = db.prepare(`
    INSERT INTO variants (subject_id, slug, description, base_prompt, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(subject_id, slug) DO UPDATE SET
      description = excluded.description,
      base_prompt = excluded.base_prompt,
      updated_at = CURRENT_TIMESTAMP
  `);

  let expanded = 0;
  let skipped = 0;

  for (const sub of subjectsToExpand) {
    const key = `${sub.category_slug}/${sub.subject_slug}`;

    const existingCount = checkVariantsStmt.get(sub.subject_id).count;
    if (existingCount > 0 && !force) {
      skipped++;
      continue;
    }

    console.log(`Expanding: ${key} using gemini-3.6-flash...`);
    const prompt = `Generate variants for the subject "${sub.subject_name}" in the "${sub.category_name}" category.`;

    const result = await geminiJson(prompt, { system: SYSTEM_PROMPT, model: "gemini-3.6-flash" });

    if (!Array.isArray(result)) {
      console.error(`  Unexpected response for ${key}, skipping`);
      continue;
    }

    const now = new Date().toISOString();
    for (const v of result) {
      insertVariantStmt.run(sub.subject_id, v.slug, v.description, v.prompt, now);
    }

    console.log(`  Generated ${result.length} variants in SQLite`);
    expanded++;
  }

  console.log(`\nDone. Expanded ${expanded} subjects, skipped ${skipped} existing.`);
  const totalVariants = db.prepare("SELECT COUNT(*) AS count FROM variants WHERE status != 'skipped'").get().count;
  console.log(`Total active variants in SQLite: ${totalVariants}`);
}
