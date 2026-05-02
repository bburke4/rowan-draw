import { GoogleGenAI } from "@google/genai";

let _ai;

export function getClient() {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Set GEMINI_API_KEY environment variable");
      process.exit(1);
    }
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

/**
 * Call Gemini with a prompt and get structured JSON back.
 * Retries once on parse failure.
 */
export async function geminiJson(prompt, { model = "gemini-2.5-flash", system } = {}) {
  const ai = getClient();
  const contents = [{ role: "user", parts: [{ text: prompt }] }];
  const config = {
    responseMimeType: "application/json",
  };
  if (system) {
    config.systemInstruction = { parts: [{ text: system }] };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });
    try {
      return JSON.parse(response.text);
    } catch {
      if (attempt === 0) {
        console.warn("  Gemini returned invalid JSON, retrying...");
        continue;
      }
      throw new Error(`Gemini returned invalid JSON after 2 attempts: ${response.text.slice(0, 200)}`);
    }
  }
}
