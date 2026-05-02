import express from "express";
import fs from "node:fs";
import path from "node:path";
import { readState, writeState } from "../lib/state.js";

const BASE_DIR = path.join(import.meta.dirname, "..");
const PORT = 3456;

export async function runReview() {
  const app = express();
  app.use(express.json());

  app.get("/", (req, res) => {
    res.sendFile(path.join(import.meta.dirname, "index.html"));
  });

  app.use("/images", express.static(path.join(BASE_DIR, "generated")));

  app.get("/api/variants", (req, res) => {
    const generation = readState("generation.json", { generated: {} });
    const review = readState("review.json", { decisions: {}, skipped: [], feedback: {} });
    const variants = readState("variants.json", { variants: {} });

    const result = [];

    for (const [genKey, genData] of Object.entries(generation.generated)) {
      if (genData.refused || genData.images.length === 0) continue;
      if (review.skipped?.includes(genKey)) continue;

      const [category, subject, ...slugParts] = genKey.split("/");
      const variantSlug = slugParts.join("/");

      const subjectKey = `${category}/${subject}`;
      const variantList = variants.variants[subjectKey] || [];
      const variantInfo = variantList.find((v) => v.slug === variantSlug);

      // Check which image (if any) was picked for this variant
      const picked = review.decisions[genKey] || null;

      const images = genData.images.map((imgPath) => ({
        path: imgPath,
        url: "/images/" + imgPath.replace(/^generated\//, ""),
        picked: imgPath === picked,
      }));

      result.push({
        key: genKey,
        category,
        subject,
        variantSlug,
        description: variantInfo?.description || variantSlug,
        prompt: genData.prompt,
        images,
        status: picked ? "done" : "pending",
        feedback: review.feedback?.[genKey] || null,
      });
    }

    result.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return a.key.localeCompare(b.key);
    });

    res.json(result);
  });

  // Pick one image for a variant
  app.post("/api/pick", (req, res) => {
    const { variantKey, imagePath } = req.body;
    if (!variantKey || !imagePath) {
      return res.status(400).json({ error: "Missing variantKey or imagePath" });
    }

    const review = readState("review.json", { decisions: {}, skipped: [], feedback: {} });
    review.decisions[variantKey] = imagePath;
    writeState("review.json", review);

    res.json({ ok: true });
  });

  // Skip a variant — discard it permanently (bad variant idea)
  app.post("/api/skip", (req, res) => {
    const { variantKey } = req.body;
    if (!variantKey) return res.status(400).json({ error: "Missing variantKey" });

    const review = readState("review.json", { decisions: {}, skipped: [], feedback: {} });
    if (!review.skipped) review.skipped = [];
    if (!review.skipped.includes(variantKey)) {
      review.skipped.push(variantKey);
    }
    delete review.decisions[variantKey];
    writeState("review.json", review);

    res.json({ ok: true });
  });

  // Regenerate — clear from generation and optionally save feedback
  app.post("/api/regenerate", (req, res) => {
    const { key, feedback } = req.body;
    if (!key) return res.status(400).json({ error: "Missing key" });

    const generation = readState("generation.json", { generated: {} });
    const review = readState("review.json", { decisions: {}, skipped: [], feedback: {} });

    // Save feedback if provided
    if (feedback) {
      if (!review.feedback) review.feedback = {};
      review.feedback[key] = feedback;
    }

    // Remove from generation so it gets re-queued
    delete generation.generated[key];
    delete review.decisions[key];

    writeState("generation.json", generation);
    writeState("review.json", review);

    res.json({ ok: true });
  });

  app.get("/api/stats", (req, res) => {
    const review = readState("review.json", { decisions: {}, skipped: [], feedback: {} });
    const generation = readState("generation.json", { generated: {} });

    let totalVariants = 0;
    for (const [genKey, genData] of Object.entries(generation.generated)) {
      if (!genData.refused && genData.images.length > 0) totalVariants++;
    }

    const skipped = review.skipped?.length || 0;
    const picked = Object.keys(review.decisions).length;
    const pending = totalVariants - picked - skipped;

    res.json({ total: totalVariants, picked, skipped, pending });
  });

  app.listen(PORT, () => {
    console.log(`Review UI running at http://localhost:${PORT}`);
    console.log("Press Ctrl+C to stop.\n");
  });
}
