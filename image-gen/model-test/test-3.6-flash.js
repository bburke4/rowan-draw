// Standalone test script for Gemini 3.6 Flash
// Evaluates both JSON prompt expansion and image output comparison.
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
const OUT_DIR = path.join(import.meta.dirname, "output", "gemini-3.6-flash");

function buildPrompt(subject) {
  return `A single ${subject}, ${STYLE_PROMPT}. ${NEGATIVE_SUFFIX}`;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Set GEMINI_API_KEY (run with: node --env-file=../.env test-3.6-flash.js)");
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("=== Testing gemini-3.6-flash ===");

  // 1. Test Structured JSON Prompt Expansion
  console.log("\n1. Testing Prompt Expansion (JSON)...");
  try {
    const expandRes = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: "Brainstorm 3 simple drawing variants for a kid drawing a dragon. Return JSON array with slug, description, prompt.",
      config: {
        responseMimeType: "application/json",
      },
    });
    console.log("Expansion Result:\n", expandRes.text);
  } catch (err) {
    console.error("Expansion Error:", err.message);
  }

  // 2. Test Image Generation Output
  console.log("\n2. Testing Image Generation Output...");
  for (const subject of SUBJECTS) {
    const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    console.log(`  Generating image for: ${subject}...`);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: buildPrompt(subject),
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      let saved = 0;
      for (const part of parts) {
        if (part.inlineData?.data) {
          const buffer = Buffer.from(part.inlineData.data, "base64");
          fs.writeFileSync(path.join(OUT_DIR, `${slug}-${saved + 1}.png`), buffer);
          saved++;
        } else if (part.text) {
          console.log(`    [Text output]: ${part.text.slice(0, 150)}...`);
        }
      }
      if (saved > 0) {
        console.log(`    Saved ${saved} image(s) to output/gemini-3.6-flash/`);
      }
    } catch (err) {
      console.error(`    Error generating image for ${subject}: ${err.message}`);
    }
  }

  console.log(`\nTest completed. Check results in ${OUT_DIR}`);
}

main();
