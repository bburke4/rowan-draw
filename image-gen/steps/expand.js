import { getDb } from "../lib/db.js";
import { geminiJson } from "../lib/gemini.js";
import { STYLE_PROMPT, NEGATIVE_SUFFIX } from "../lib/prompts.js";

const SYSTEM_PROMPT = `You are helping build a kids drawing reference app. The app shows simple \
bold-line cartoon drawings that kids look at and try to draw themselves on paper.

When generating variants, think about what a child would actually ask for: \
"How do I draw a [thing]?" Each variant should be visually distinct from the others — \
a kid browsing should see real choices, not slight variations of the same pose.

Rules for variants:
- Each should be immediately recognizable to a young child (ages 3-7)
- Vary by: type, breed, pose, action, distinguishing features
- Some subjects are naturally rich (dogs, flowers) → 8-15 variants
- Some subjects are simple (star, tree) → 3-5 variants
- Use your judgment on count — don't pad with weak variants
- NEVER mention colors in descriptions or prompts — all images are black and white line art. \
Describe subjects by shape and features only (e.g., "school bus" not "yellow school bus")

## Building the image prompt

A child (ages 3-7) needs to be able to draw the result. Keep it to ~10-15 bold strokes, \
basic geometric shapes. Use flat views (side, front, top-down) — never 3/4 or perspective.

First, classify the subject:

- **DETAIL-PRONE**: mechanical / manufactured / man-made things — vehicles, machines, \
buildings, appliances, tools, furniture. Imagen's prior pulls these toward realistic, \
technical-looking images, so the prompt has to push back hard.
- **ORGANIC**: animals, plants, food, people, simple natural forms (sun, cloud, star, \
heart). Imagen already has good cartoon priors for these — a simple prompt works.

### Prompt structure for ORGANIC subjects

Just describe the subject naturally, specify the view, and append the style template. \
Example:
"A single sleeping cat curled into a circle, side view, ${STYLE_PROMPT}. ${NEGATIVE_SUFFIX}"

### Prompt structure for DETAIL-PRONE subjects

The prompt MUST do three extra things:

1. **Describe the subject as its component geometric shapes**, not just name it. \
A fire truck is "a rectangular cab with a long rectangular ladder body behind it, \
two round wheels, and a small box light on top" — not "a fire truck with a ladder."

2. **Use "strict orthogonal [side / front / top] profile"** instead of plain "side view." \
This prevents Imagen from drifting into a 3/4 angle.

3. **Name the largest body region as blank canvas, positively.** \
e.g., "the trailer is completely blank empty canvas with no logos, no text, no panel \
lines, no seams." Stating where the empty space must go is more effective than \
just listing what to omit.

Example DETAIL-PRONE prompt:
"A single semi truck made of a small square cab on the left and a long blank rectangular \
trailer on the right, two round wheels under the cab and four round wheels under the trailer, \
strict orthogonal side profile view, the entire trailer body is completely blank empty canvas \
space with no logos, text, panel lines, or seams, ${STYLE_PROMPT}. ${NEGATIVE_SUFFIX}"

Style template: ${STYLE_PROMPT}
Negative instructions: ${NEGATIVE_SUFFIX}

## Output format

Return a JSON array of objects with these fields:
- "slug": URL-safe identifier (lowercase, hyphens, e.g., "sleeping-curled-up-cat")
- "description": Short human-readable description (e.g., "sleeping cat curled into a circle")
- "prompt": The full image generation prompt (with the style template and negative \
instructions written out in full, not as placeholders)`;

export async function runExpand(flags) {
  const db = getDb();
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
