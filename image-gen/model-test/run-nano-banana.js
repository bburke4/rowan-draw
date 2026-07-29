// Generate test outputs for Nano Banana 2 and Nano Banana 2 Lite via Interactions API
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

const STYLE_PROMPT = `centered, isolated on a pure white background, \
minimalist bold-line cartoon, thick black outlines, simple geometric shapes, \
coloring book style, kids illustration, no shading, no gradient, \
no background details, no color, black and white line art`;

const NEGATIVE_SUFFIX = `Do NOT include: shading, gradients, shadows, gray tones, \
color, watercolor, crosshatching, texture, patterns, multiple subjects, \
text, watermarks, borders, frames, thin lines, realistic proportions, \
scary imagery, background details.`;

const SUBJECTS = ["cat sitting upright", "simple house with a chimney", "racecar"];

const MODELS = [
  { id: "gemini-3.1-flash-image", dirName: "nano-banana-2" },
  { id: "gemini-3.1-flash-lite-image", dirName: "nano-banana-2-lite" },
];

const BASE_OUT = path.join(import.meta.dirname, "output");

function buildPrompt(subject) {
  return `A single ${subject}, ${STYLE_PROMPT}. ${NEGATIVE_SUFFIX}`;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Set GEMINI_API_KEY (run with: node --env-file=../.env run-nano-banana.js)");
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey });

  for (const model of MODELS) {
    const outDir = path.join(BASE_OUT, model.dirName);
    fs.mkdirSync(outDir, { recursive: true });
    console.log(`\n=== Generating images for ${model.id} (${model.dirName}) ===`);

    for (const subject of SUBJECTS) {
      const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      console.log(`  Generating: ${subject}...`);
      try {
        const interaction = await ai.interactions.create({
          model: model.id,
          input: buildPrompt(subject),
        });

        if (interaction.output_image) {
          const buffer = Buffer.from(interaction.output_image.data, "base64");
          fs.writeFileSync(path.join(outDir, `${slug}.png`), buffer);
          console.log(`    Saved ${slug}.png to ${outDir}`);
        } else {
          console.log(`    No output_image returned`);
        }
      } catch (err) {
        console.error(`    ERROR: ${err.message?.slice(0, 300)}`);
      }
    }
  }

  console.log(`\nDone. Outputs saved in ${BASE_OUT}`);
}

main();
