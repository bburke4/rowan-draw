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
"A single sleeping cat curled into a circle, side view, \${STYLE_PROMPT}. \${NEGATIVE_SUFFIX}"

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
space with no logos, text, panel lines, or seams, \${STYLE_PROMPT}. \${NEGATIVE_SUFFIX}"

Style template: ${STYLE_PROMPT}
Negative instructions: ${NEGATIVE_SUFFIX}

## Output format

Return a JSON array of objects with these fields:
- "slug": URL-safe identifier (lowercase, hyphens, e.g., "sleeping-curled-up-cat")
- "description": Short human-readable description (e.g., "sleeping cat curled into a circle")
- "prompt": The full image generation prompt (with the style template and negative \
instructions written out in full, not as placeholders)`;

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
