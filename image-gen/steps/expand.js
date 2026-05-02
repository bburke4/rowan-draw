import { geminiJson } from "../lib/gemini.js";
import { STYLE_PROMPT, NEGATIVE_SUFFIX } from "../lib/prompts.js";
import { readCatalog, readState, writeState } from "../lib/state.js";

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

Rules for image prompts:
- A child (ages 3-7) needs to be able to draw this. Keep it VERY simple — \
think 5-15 bold strokes, basic geometric shapes. If you wouldn't describe it as \
"easy for a kindergartner to draw", it's too complex.
- Prefer flat views: side view, front view, or top-down. Avoid 3/4 angle or perspective \
views — they are much harder for kids to draw. Specify the view in every prompt \
(e.g., "side view", "front view").
- Reduce subjects to their most essential, recognizable features. \
A fire truck is a rectangle with wheels, a ladder shape, and a light on top — not a \
detailed vehicle with windows, hoses, doors, and mechanical parts.

For each variant, generate a full image generation prompt by combining your variant \
description with the style template below. The prompt must start with \
"A single [specific description]" followed by the view angle, then the style instructions.

Style template: ${STYLE_PROMPT}
Negative instructions: ${NEGATIVE_SUFFIX}

Return a JSON array of objects with these fields:
- "slug": URL-safe identifier (lowercase, hyphens, e.g., "sleeping-curled-up-cat")
- "description": Short human-readable description (e.g., "sleeping cat curled into a circle")
- "prompt": The full image generation prompt`;

export async function runExpand(flags) {
  const catalog = readCatalog();
  const variants = readState("variants.json", { variants: {} });

  const filterCategory = flags.category;
  const filterSubject = flags.subject;
  const force = flags.force || false;

  let expanded = 0;
  let skipped = 0;

  for (const [category, { subjects }] of Object.entries(catalog.categories)) {
    if (filterCategory && category !== filterCategory) continue;

    for (const subject of subjects) {
      if (filterSubject && subject !== filterSubject) continue;

      const key = `${category}/${subject}`;

      if (variants.variants[key] && !force) {
        skipped++;
        continue;
      }

      console.log(`Expanding: ${key}`);

      const prompt = `Generate variants for the subject "${subject}" in the "${category}" category.`;

      const result = await geminiJson(prompt, { system: SYSTEM_PROMPT });

      if (!Array.isArray(result)) {
        console.error(`  Unexpected response for ${key}, skipping`);
        continue;
      }

      variants.variants[key] = result.map((v) => ({
        slug: v.slug,
        description: v.description,
        prompt: v.prompt,
        addedAt: new Date().toISOString(),
      }));

      console.log(`  Generated ${result.length} variants`);
      expanded++;

      writeState("variants.json", variants);
    }
  }

  console.log(`\nDone. Expanded ${expanded} subjects, skipped ${skipped} existing.`);

  // Print summary
  let totalVariants = 0;
  for (const v of Object.values(variants.variants)) {
    totalVariants += v.length;
  }
  console.log(`Total: ${Object.keys(variants.variants).length} subjects, ${totalVariants} variants`);
}
