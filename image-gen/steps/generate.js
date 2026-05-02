import fs from "node:fs";
import path from "node:path";
import { getClient } from "../lib/gemini.js";
import { readState, writeState } from "../lib/state.js";

const COST_PER_IMAGE = 0.02;
const IMAGES_PER_VARIANT = 4;
const DELAY_MS = 7000; // 10 requests/min limit → ~7s between calls
const MAX_RETRIES = 3;

const GENERATED_DIR = path.join(import.meta.dirname, "..", "generated");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runGenerate(flags) {
  const variants = readState("variants.json", { variants: {} });
  const generation = readState("generation.json", {
    generated: {},
    totalCost: 0,
    totalImages: 0,
  });
  const review = readState("review.json", { decisions: {}, skipped: [], feedback: {} });

  const filterSubject = flags.subject;
  const filterCategory = flags.category;
  const dryRun = flags["dry-run"];
  const force = flags.force || false;
  const limit = flags.limit ? parseInt(flags.limit, 10) : Infinity;

  // Collect all pending variants
  const pending = [];

  for (const [key, variantList] of Object.entries(variants.variants)) {
    const [category] = key.split("/");
    if (filterCategory && category !== filterCategory) continue;
    if (filterSubject && !key.endsWith(`/${filterSubject}`)) continue;

    for (const variant of variantList) {
      const genKey = `${key}/${variant.slug}`;
      if (generation.generated[genKey] && !force) continue;
      // Even with --force, never regenerate variants that have been picked or published
      if (force && (review.decisions[genKey] || review.skipped?.includes(genKey))) continue;
      pending.push({ key, genKey, variant, category });
    }
  }

  if (pending.length === 0) {
    console.log("Nothing to generate — all variants already have images.");
    return;
  }

  const toProcess = pending.slice(0, limit);
  const estimatedCost = toProcess.length * IMAGES_PER_VARIANT * COST_PER_IMAGE;

  if (dryRun) {
    console.log(`Would generate ${toProcess.length} variants (${toProcess.length * IMAGES_PER_VARIANT} images)`);
    console.log(`Estimated cost: $${estimatedCost.toFixed(2)}`);
    console.log(`\nBreakdown:`);

    const byCategory = {};
    for (const { key } of toProcess) {
      const [cat] = key.split("/");
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    for (const [cat, count] of Object.entries(byCategory)) {
      console.log(`  ${cat}: ${count} variants`);
    }
    return;
  }

  const ai = getClient();
  let processed = 0;

  for (const { key, genKey, variant } of toProcess) {
    const [category, subject] = key.split("/");
    const outDir = path.join(GENERATED_DIR, category, subject, variant.slug);
    fs.mkdirSync(outDir, { recursive: true });

    // If there's feedback from a previous rejection, append it to the prompt
    const feedback = review.feedback?.[genKey];
    let prompt = variant.prompt;
    if (feedback) {
      prompt += ` Avoid the following issue from a previous attempt: ${feedback}.`;
      console.log(`[${processed + 1}/${toProcess.length}] Generating: ${genKey} (with feedback: "${feedback}")`);
    } else {
      console.log(`[${processed + 1}/${toProcess.length}] Generating: ${genKey}`);
    }

    let success = false;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await ai.models.generateImages({
          model: "imagen-4.0-fast-generate-001",
          prompt,
          config: { numberOfImages: IMAGES_PER_VARIANT },
        });

        const images = [];
        let idx = 1;
        for (const generatedImage of response.generatedImages) {
          const buffer = Buffer.from(generatedImage.image.imageBytes, "base64");
          const relPath = path.join("generated", category, subject, variant.slug, `${variant.slug}-${idx}.png`);
          fs.writeFileSync(path.join(GENERATED_DIR, "..", relPath), buffer);
          images.push(relPath);
          idx++;
        }

        const cost = images.length * COST_PER_IMAGE;
        generation.generated[genKey] = {
          prompt: variant.prompt,
          generatedAt: new Date().toISOString(),
          images,
          cost,
          attempts: attempt,
        };
        generation.totalCost += cost;
        generation.totalImages += images.length;

        console.log(`  Saved ${images.length} images ($${cost.toFixed(2)})`);
        success = true;
        break;
      } catch (err) {
        if (err.message?.includes("SAFETY") || err.message?.includes("blocked")) {
          console.warn(`  Refused by content filter — marking as refused`);
          generation.generated[genKey] = {
            prompt: variant.prompt,
            generatedAt: new Date().toISOString(),
            images: [],
            cost: 0,
            attempts: attempt,
            refused: true,
          };
          success = true;
          break;
        } else if (err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED")) {
          // Parse retry delay from error if available
          const retryMatch = err.message.match(/retry in ([\d.]+)s/i);
          const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : 60;
          console.warn(`  Rate limited — waiting ${waitSec}s before retry (attempt ${attempt}/${MAX_RETRIES})`);
          await sleep(waitSec * 1000);
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

    writeState("generation.json", generation);
    processed++;

    if (processed < toProcess.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nDone. Generated ${processed} variants.`);
  console.log(`Running total: ${generation.totalImages} images, $${generation.totalCost.toFixed(2)} spent`);
}
