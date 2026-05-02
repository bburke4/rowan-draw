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

function buildPrompt(subject) {
  return `A single ${subject}, ${STYLE_PROMPT}. ${NEGATIVE_SUFFIX}`;
}

async function generateImage(ai, subject, outputDir) {
  const prompt = buildPrompt(subject);
  console.log(`Generating: ${subject}`);

  const response = await ai.models.generateImages({
    model: "imagen-4.0-fast-generate-001",
    prompt,
    config: {
      numberOfImages: 4,
    },
  });

  const subjectSlug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  let saved = 0;

  for (const generatedImage of response.generatedImages) {
    const buffer = Buffer.from(generatedImage.image.imageBytes, "base64");
    const filename = `${subjectSlug}-${saved + 1}.png`;
    fs.writeFileSync(path.join(outputDir, filename), buffer);
    saved++;
  }

  console.log(`  Saved ${saved} images for "${subject}"`);
  return saved;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Set GEMINI_API_KEY environment variable");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  // Test subjects — just a few to validate the pipeline
  const subjects = [
    "cat sitting upright",
    "simple house with a chimney",
    "racecar",
  ];

  const outputDir = path.join(import.meta.dirname, "output");
  fs.mkdirSync(outputDir, { recursive: true });

  for (const subject of subjects) {
    await generateImage(ai, subject, outputDir);
  }

  console.log(`\nDone. Images saved to ${outputDir}`);
}

main();
