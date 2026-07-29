// Standalone test: compare new Gemini image models against imagen-4.0-fast.
// Does NOT touch pipeline state. Output goes to model-test/output/<model>/.
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
  { id: "imagen-4.0-fast-generate-001", label: "imagen-4-fast ($0.020/img)", api: "generateImages" },
  { id: "gemini-3.1-flash-lite-image", label: "flash-lite ($0.034/img)", api: "generateContent" },
  { id: "gemini-3.1-flash-image", label: "flash ($0.067/img @1K)", api: "generateContent" },
  { id: "gemini-3-pro-image", label: "pro-image ($0.134/img)", api: "generateContent" },
];

const OUT_DIR = path.join(import.meta.dirname, "output");

function buildPrompt(subject) {
  return `A single ${subject}, ${STYLE_PROMPT}. ${NEGATIVE_SUFFIX}`;
}

async function generateOne(ai, model, subject, outDir) {
  const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  let saved = 0;

  if (model.api === "generateImages") {
    const response = await ai.models.generateImages({
      model: model.id,
      prompt: buildPrompt(subject),
      config: { numberOfImages: 1 },
    });
    for (const generatedImage of response.generatedImages || []) {
      const buffer = Buffer.from(generatedImage.image.imageBytes, "base64");
      fs.writeFileSync(path.join(outDir, `${slug}-${saved + 1}.png`), buffer);
      saved++;
    }
  } else {
    const response = await ai.models.generateContent({
      model: model.id,
      contents: buildPrompt(subject),
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const buffer = Buffer.from(part.inlineData.data, "base64");
        fs.writeFileSync(path.join(outDir, `${slug}-${saved + 1}.png`), buffer);
        saved++;
      } else if (part.text) {
        console.log(`    [model text]: ${part.text.slice(0, 120)}`);
      }
    }
  }
  return saved;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Set GEMINI_API_KEY (run with: node --env-file=../.env test-models.js)");
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey });

  for (const model of MODELS) {
    const outDir = path.join(OUT_DIR, model.id);
    fs.mkdirSync(outDir, { recursive: true });
    console.log(`\n=== ${model.id} — ${model.label} ===`);

    for (const subject of SUBJECTS) {
      console.log(`  Generating: ${subject}`);
      try {
        const saved = await generateOne(ai, model, subject, outDir);
        console.log(`    Saved ${saved} image(s)`);
      } catch (err) {
        console.error(`    ERROR: ${err.message?.slice(0, 300)}`);
      }
    }
  }

  console.log(`\nDone. Compare results in ${OUT_DIR}`);
}

main();
