import express from "express";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../lib/db.js";
import { getClient } from "../lib/gemini.js";
import { runTag } from "../steps/tag.js";
import { runPublish } from "../steps/publish.js";
import { PRESETS, STYLE_PROMPT, NEGATIVE_SUFFIX, slugify } from "../lib/prompts.js";

const BASE_DIR = path.join(import.meta.dirname, "..");
const PORT = 3456;

export async function runReview() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/", (req, res) => {
    res.sendFile(path.join(import.meta.dirname, "index.html"));
  });

  app.use("/images", express.static(path.join(BASE_DIR, "generated")));
  app.use("/library-images", express.static(path.join(BASE_DIR, "library")));

  // API: Billing & Cost Breakdown
  app.get("/api/billing", (req, res) => {
    const db = getDb();
    const apiKey = process.env.GEMINI_API_KEY || "";
    const maskedKey = apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : "Not Configured";

    const rows = db.prepare(`
      SELECT model_id, COUNT(*) AS run_count, SUM(image_count) AS total_images, SUM(cost) AS total_cost
      FROM generation_runs
      GROUP BY model_id
      ORDER BY total_cost DESC
    `).all();

    const totalCost = db.prepare("SELECT SUM(cost) AS total FROM generation_runs").get().total || 0;

    res.json({
      apiKeyConfigured: Boolean(apiKey),
      maskedKey,
      totalSpentUsd: Number(totalCost.toFixed(3)),
      billingUrl: "https://aistudio.google.com/plan",
      apiKeyUrl: "https://aistudio.google.com/apikey",
      breakdown: rows.map((r) => ({
        modelId: r.model_id,
        runCount: r.run_count,
        totalImages: r.total_images,
        totalCostUsd: Number(r.total_cost.toFixed(3)),
      })),
    });
  });

  // API: Get Catalog Variants list with clean status filtering
  app.get("/api/variants", (req, res) => {
    const db = getDb();
    const filterCat = req.query.category;
    const filterStatus = req.query.status || "all";

    let query = `
      SELECT 
        v.id AS variant_id,
        v.slug AS variant_slug,
        v.description,
        v.base_prompt,
        v.custom_prompt,
        v.status AS variant_status,
        v.feedback_history,
        s.slug AS subject_slug,
        s.name AS subject_name,
        c.slug AS category_slug,
        c.name AS category_name
      FROM variants v
      JOIN subjects s ON v.subject_id = s.id
      JOIN categories c ON s.category_id = c.id
    `;
    const params = [];
    const conditions = [];

    if (filterCat) {
      conditions.push("c.slug = ?");
      params.push(filterCat);
    }

    if (filterStatus === "skipped") {
      conditions.push("v.status = 'skipped'");
    } else if (filterStatus === "accepted") {
      conditions.push("v.status = 'active' AND EXISTS (SELECT 1 FROM images i WHERE i.variant_id = v.id AND i.status = 'accepted')");
    } else if (filterStatus === "pending") {
      conditions.push("v.status = 'active' AND EXISTS (SELECT 1 FROM images i WHERE i.variant_id = v.id AND i.status = 'pending') AND NOT EXISTS (SELECT 1 FROM images i WHERE i.variant_id = v.id AND i.status = 'accepted')");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY c.sort_order, s.sort_order, v.id";

    const variants = db.prepare(query).all(...params);
    const getImagesStmt = db.prepare(`
      SELECT 
        i.id AS image_id, i.public_id, i.file_path, i.published_path, i.status, 
        i.image_description, i.difficulty_score, i.tags_json, i.is_published, i.created_at,
        r.model_id, r.prompt_used, r.cost, r.feedback_given
      FROM images i
      LEFT JOIN generation_runs r ON i.generation_run_id = r.id
      WHERE i.variant_id = ?
      ORDER BY i.id DESC
    `);

    const result = variants.map((v) => {
      const dbImgs = getImagesStmt.all(v.variant_id);
      const images = dbImgs.map((img) => {
        let tags = [];
        try {
          tags = JSON.parse(img.tags_json || "[]");
        } catch {}
        return {
          imageId: img.image_id,
          publicId: img.public_id,
          path: img.file_path,
          url: "/images/" + img.file_path.replace(/^generated\//, ""),
          status: img.status,
          imageDescription: img.image_description,
          difficulty: img.difficulty_score,
          tags,
          isPublished: Boolean(img.is_published),
          modelId: img.model_id || "gemini-3.1-flash-lite-image",
          promptUsed: img.prompt_used || v.custom_prompt || v.base_prompt,
          cost: img.cost || 0,
          createdAt: img.created_at,
        };
      });

      const hasAccepted = images.some((i) => i.status === "accepted");
      let status = "pending";
      if (v.variant_status === "skipped") status = "skipped";
      else if (hasAccepted) status = "accepted";

      return {
        variantId: v.variant_id,
        key: `${v.category_slug}/${v.subject_slug}/${v.variant_slug}`,
        category: v.category_slug,
        categoryName: v.category_name,
        subject: v.subject_slug,
        subjectName: v.subject_name,
        variantSlug: v.variant_slug,
        description: v.description,
        prompt: v.custom_prompt || v.base_prompt,
        basePrompt: v.base_prompt,
        customPrompt: v.custom_prompt,
        feedback: v.feedback_history,
        status,
        images,
      };
    });

    res.json(result);
  });

  // Toggle Acceptance on individual Image
  app.post("/api/image-status", (req, res) => {
    const { imageId, status } = req.body;
    if (!imageId || !status) {
      return res.status(400).json({ error: "Missing imageId or status" });
    }

    const db = getDb();
    db.prepare("UPDATE images SET status = ? WHERE id = ?").run(status, imageId);
    res.json({ ok: true });
  });

  // Dismiss/Reject All Non-Accepted Candidate Images for a Variant
  app.post("/api/dismiss-unaccepted", (req, res) => {
    const { variantId } = req.body;
    if (!variantId) return res.status(400).json({ error: "Missing variantId" });

    const db = getDb();
    db.prepare("UPDATE images SET status = 'rejected' WHERE variant_id = ? AND status != 'accepted'").run(variantId);
    res.json({ ok: true });
  });

  // Update Custom Prompt Override for a Variant
  app.post("/api/update-prompt", (req, res) => {
    const { variantId, customPrompt } = req.body;
    if (!variantId) return res.status(400).json({ error: "Missing variantId" });

    const db = getDb();
    db.prepare("UPDATE variants SET custom_prompt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(customPrompt || null, variantId);
    res.json({ ok: true });
  });

  // Regenerate Candidates for a Variant with Live Quota Error Interception
  app.post("/api/regenerate", async (req, res) => {
    const { variantId, modelId = "gemini-3.1-flash-lite-image", feedback } = req.body;
    if (!variantId) return res.status(400).json({ error: "Missing variantId" });

    const db = getDb();
    const v = db.prepare(`
      SELECT 
        v.id AS variant_id, v.slug AS variant_slug, v.description, v.base_prompt, v.custom_prompt,
        s.slug AS subject_slug, c.slug AS category_slug
      FROM variants v
      JOIN subjects s ON v.subject_id = s.id
      JOIN categories c ON s.category_id = c.id
      WHERE v.id = ?
    `).get(variantId);

    if (!v) return res.status(404).json({ error: "Variant not found" });

    if (feedback) {
      db.prepare("UPDATE variants SET feedback_history = ? WHERE id = ?").run(feedback, variantId);
    }

    let prompt = v.custom_prompt || v.base_prompt;
    if (feedback) prompt += ` Avoid previous issue: ${feedback}.`;

    const ai = getClient();
    const outDir = path.join(BASE_DIR, "generated", v.category_slug, v.subject_slug, v.variant_slug);
    fs.mkdirSync(outDir, { recursive: true });

    const savedImages = [];
    const IMAGES_PER_RUN = 4;

    try {
      if (modelId.includes("imagen")) {
        const response = await ai.models.generateImages({
          model: modelId,
          prompt,
          config: { numberOfImages: IMAGES_PER_RUN },
        });

        let idx = Date.now();
        for (const img of response.generatedImages || []) {
          const buffer = Buffer.from(img.image.imageBytes, "base64");
          const relPath = path.join("generated", v.category_slug, v.subject_slug, v.variant_slug, `${v.variant_slug}-${idx}.png`);
          fs.writeFileSync(path.join(BASE_DIR, relPath), buffer);
          savedImages.push(relPath);
          idx++;
        }
      } else {
        for (let i = 1; i <= IMAGES_PER_RUN; i++) {
          const interaction = await ai.interactions.create({
            model: modelId,
            input: prompt,
          });
          if (interaction.output_image) {
            const buffer = Buffer.from(interaction.output_image.data, "base64");
            const relPath = path.join("generated", v.category_slug, v.subject_slug, v.variant_slug, `${v.variant_slug}-${Date.now()}-${i}.png`);
            fs.writeFileSync(path.join(BASE_DIR, relPath), buffer);
            savedImages.push(relPath);
          }
        }
      }

      const costPerImg = {
        "gemini-3.1-flash-lite-image": 0.034,
        "gemini-3.1-flash-image": 0.067,
        "imagen-4.0-fast-generate-001": 0.020,
        "gemini-3-pro-image": 0.134,
      }[modelId] || 0.034;

      const totalCost = savedImages.length * costPerImg;
      const apiMethod = modelId.includes("imagen") ? "generateImages" : "interactions";

      const runRes = db.prepare(`
        INSERT INTO generation_runs (variant_id, model_id, api_method, prompt_used, feedback_given, cost, image_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(v.variant_id, modelId, apiMethod, prompt, feedback || null, totalCost, savedImages.length);

      const insertImgStmt = db.prepare(`
        INSERT INTO images (public_id, variant_id, generation_run_id, file_path, status)
        VALUES (?, ?, ?, ?, 'pending')
      `);

      let imgIdx = 1;
      for (const imgPath of savedImages) {
        const publicId = `img_${v.category_slug}_${v.subject_slug}_${v.variant_slug}_${Date.now()}_${imgIdx++}`;
        insertImgStmt.run(publicId, v.variant_id, runRes.lastInsertRowid, imgPath);
      }

      res.json({ ok: true, count: savedImages.length, cost: totalCost });
    } catch (err) {
      console.error("Regenerate Error:", err);
      const isQuota = err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED") || err.message?.includes("quota") || err.message?.includes("402") || err.message?.includes("credit");
      res.status(500).json({
        error: err.message,
        isQuotaError: Boolean(isQuota),
        billingUrl: "https://aistudio.google.com/plan",
      });
    }
  });

  // Skip / Archive Variant
  app.post("/api/skip-variant", (req, res) => {
    const { variantId } = req.body;
    if (!variantId) return res.status(400).json({ error: "Missing variantId" });

    const db = getDb();
    db.prepare("UPDATE variants SET status = 'skipped' WHERE id = ?").run(variantId);
    res.json({ ok: true });
  });

  // Edit Image Difficulty & Search Tags
  app.post("/api/update-tags", (req, res) => {
    const { imageId, difficulty, tags } = req.body;
    if (!imageId) return res.status(400).json({ error: "Missing imageId" });

    const db = getDb();
    const tagsJson = JSON.stringify(tags || []);
    db.prepare("UPDATE images SET difficulty_score = ?, tags_json = ?, tagged_at = CURRENT_TIMESTAMP WHERE id = ?").run(difficulty || null, tagsJson, imageId);
    res.json({ ok: true });
  });

  // Trigger 1-Click Publish from Web UI
  app.post("/api/publish", async (req, res) => {
    try {
      await runTag({ "dry-run": false });
      await runPublish({ "dry-run": false });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Get Style Presets for Playground
  app.get("/api/presets", (req, res) => {
    res.json(Object.values(PRESETS));
  });

  // API: Get Categories and Subjects hierarchy for promotion dropdowns
  app.get("/api/categories-subjects", (req, res) => {
    const db = getDb();
    const categories = db.prepare("SELECT id, slug, name FROM categories ORDER BY sort_order, name").all();
    const getSubjectsStmt = db.prepare("SELECT id, slug, name, subject_type FROM subjects WHERE category_id = ? ORDER BY sort_order, name");

    const result = categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      subjects: getSubjectsStmt.all(c.id).map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        subjectType: s.subject_type,
      })),
    }));

    res.json(result);
  });

  // Helper for single image generation call
  async function generateImagesWithModel(ai, modelId, prompt, count = 1) {
    const startTime = Date.now();
    const costMap = {
      "gemini-3.1-flash-lite-image": 0.034,
      "gemini-3.1-flash-image": 0.067,
      "imagen-4.0-fast-generate-001": 0.020,
      "gemini-3-pro-image": 0.134,
    };

    const images = [];
    if (modelId.includes("imagen")) {
      const response = await ai.models.generateImages({
        model: modelId,
        prompt,
        config: { numberOfImages: count },
      });
      for (const img of response.generatedImages || []) {
        images.push(img.image.imageBytes);
      }
    } else {
      for (let i = 0; i < count; i++) {
        const interaction = await ai.interactions.create({
          model: modelId,
          input: prompt,
        });
        if (interaction.output_image?.data) {
          images.push(interaction.output_image.data);
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    const costPerImg = costMap[modelId] || 0.034;
    const totalCost = images.length * costPerImg;

    return {
      images: images.map((base64) => ({
        base64,
        dataUrl: `data:image/png;base64,${base64}`,
      })),
      latencyMs,
      totalCost,
      costPerImg,
      modelId,
    };
  }

  // API: Playground Single Model Generation
  app.post("/api/playground/generate", async (req, res) => {
    const { prompt, modelId = "gemini-3.1-flash-lite-image", count = 1 } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const ai = getClient();
    try {
      const result = await generateImagesWithModel(ai, modelId, prompt, Math.min(count, 4));
      res.json({ ok: true, ...result, prompt });
    } catch (err) {
      console.error("Playground generate error:", err);
      const isQuota = err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED") || err.message?.includes("quota") || err.message?.includes("credit");
      res.status(500).json({ error: err.message, isQuotaError: Boolean(isQuota) });
    }
  });

  // API: Playground Compare Across 3 Key Models
  app.post("/api/playground/compare", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const ai = getClient();
    const modelsToCompare = [
      { id: "gemini-3.1-flash-lite-image", name: "⚡ Nano Banana 2 Lite", cost: 0.034 },
      { id: "gemini-3.1-flash-image", name: "🎨 Nano Banana 2 (Standard)", cost: 0.067 },
      { id: "imagen-4.0-fast-generate-001", name: "🚀 Imagen 4 Fast", cost: 0.020 },
    ];

    const results = [];
    for (const m of modelsToCompare) {
      try {
        const out = await generateImagesWithModel(ai, m.id, prompt, 1);
        results.push({
          modelId: m.id,
          modelName: m.name,
          cost: m.cost,
          latencyMs: out.latencyMs,
          image: out.images[0] || null,
          error: null,
        });
      } catch (err) {
        results.push({
          modelId: m.id,
          modelName: m.name,
          cost: m.cost,
          latencyMs: 0,
          image: null,
          error: err.message,
        });
      }
    }

    res.json({ ok: true, prompt, results });
  });

  // API: Playground Multi-Difficulty Tier Generation (Level 1, Level 2, Level 3)
  app.post("/api/playground/generate-tiers", async (req, res) => {
    const { subject, modelId = "gemini-3.1-flash-lite-image" } = req.body;
    if (!subject) return res.status(400).json({ error: "Missing subject" });

    const ai = getClient();
    const cleanSub = subject.trim().replace(/^A single\s+/i, "");

    const tierConfigs = [
      {
        level: 1,
        levelBadge: "Level 1 (Toddler ~3–6 strokes)",
        suffixSlug: "simple",
        prompt: `A single ${cleanSub}, ${PRESETS.ultra_simple.stylePrompt}. ${PRESETS.ultra_simple.negativeSuffix}`,
      },
      {
        level: 2,
        levelBadge: "Level 2 (Standard ~8–12 strokes)",
        suffixSlug: "standard",
        prompt: `A single ${cleanSub}, ${STYLE_PROMPT}. ${NEGATIVE_SUFFIX}`,
      },
      {
        level: 3,
        levelBadge: "Level 3 (Detailed ~12–18 strokes)",
        suffixSlug: "detailed",
        prompt: `A single ${cleanSub}, ${PRESETS.detailed.stylePrompt}. ${PRESETS.detailed.negativeSuffix}`,
      },
    ];

    const results = [];
    for (const t of tierConfigs) {
      try {
        const out = await generateImagesWithModel(ai, modelId, t.prompt, 1);
        results.push({
          level: t.level,
          levelBadge: t.levelBadge,
          suffixSlug: t.suffixSlug,
          prompt: t.prompt,
          cost: out.costPerImg,
          latencyMs: out.latencyMs,
          image: out.images[0] || null,
          modelId,
          error: null,
        });
      } catch (err) {
        results.push({
          level: t.level,
          levelBadge: t.levelBadge,
          suffixSlug: t.suffixSlug,
          prompt: t.prompt,
          cost: 0,
          latencyMs: 0,
          image: null,
          modelId,
          error: err.message,
        });
      }
    }

    res.json({ ok: true, subject: cleanSub, modelId, results });
  });

  // API: Promote Playground Image to Catalog as New Variant
  app.post("/api/playground/promote", (req, res) => {
    const { categorySlug, subjectSlug, variantSlug, description, prompt, imageBase64, modelId = "gemini-3.1-flash-lite-image" } = req.body;
    if (!categorySlug || !subjectSlug || !variantSlug || !prompt || !imageBase64) {
      return res.status(400).json({ error: "Missing required fields for promotion" });
    }

    const db = getDb();
    const cleanVarSlug = slugify(variantSlug);
    const cleanDesc = description || cleanVarSlug.replace(/-/g, " ");

    const catRow = db.prepare("SELECT id FROM categories WHERE slug = ?").get(categorySlug);
    if (!catRow) return res.status(404).json({ error: `Category '${categorySlug}' not found` });

    const subRow = db.prepare("SELECT id FROM subjects WHERE category_id = ? AND slug = ?").get(catRow.id, subjectSlug);
    if (!subRow) return res.status(404).json({ error: `Subject '${subjectSlug}' not found in category '${categorySlug}'` });

    // Insert or update variant
    const insertVarStmt = db.prepare(`
      INSERT INTO variants (subject_id, slug, description, base_prompt, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(subject_id, slug) DO UPDATE SET
        description = excluded.description,
        base_prompt = excluded.base_prompt,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
    `);
    insertVarStmt.run(subRow.id, cleanVarSlug, cleanDesc, prompt);

    const variantRow = db.prepare("SELECT id FROM variants WHERE subject_id = ? AND slug = ?").get(subRow.id, cleanVarSlug);

    // Save image to filesystem
    const outDir = path.join(BASE_DIR, "generated", categorySlug, subjectSlug, cleanVarSlug);
    fs.mkdirSync(outDir, { recursive: true });

    const timestamp = Date.now();
    const filename = `${cleanVarSlug}-${timestamp}-promoted.png`;
    const relPath = path.join("generated", categorySlug, subjectSlug, cleanVarSlug, filename);
    const fullPath = path.join(BASE_DIR, relPath);

    fs.writeFileSync(fullPath, Buffer.from(imageBase64, "base64"));

    const costMap = {
      "gemini-3.1-flash-lite-image": 0.034,
      "gemini-3.1-flash-image": 0.067,
      "imagen-4.0-fast-generate-001": 0.020,
      "gemini-3-pro-image": 0.134,
    };
    const cost = costMap[modelId] || 0.034;
    const apiMethod = modelId.includes("imagen") ? "generateImages" : "interactions";

    const runRes = db.prepare(`
      INSERT INTO generation_runs (variant_id, model_id, api_method, prompt_used, cost, image_count)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(variantRow.id, modelId, apiMethod, prompt, cost);

    const publicId = `img_${categorySlug}_${subjectSlug}_${cleanVarSlug}_${timestamp}`;
    const imgRes = db.prepare(`
      INSERT INTO images (public_id, variant_id, generation_run_id, file_path, status)
      VALUES (?, ?, ?, ?, 'accepted')
    `).run(publicId, variantRow.id, runRes.lastInsertRowid, relPath);

    res.json({
      ok: true,
      variantId: variantRow.id,
      imageId: imgRes.lastInsertRowid,
      publicId,
      path: relPath,
    });
  });

  // Stats Endpoint
  app.get("/api/stats", (req, res) => {
    const db = getDb();
    const categories = db.prepare("SELECT COUNT(*) AS c FROM categories").get().c;
    const subjects = db.prepare("SELECT COUNT(*) AS c FROM subjects").get().c;
    const variants = db.prepare("SELECT COUNT(*) AS c FROM variants WHERE status = 'active'").get().c;
    const totalImages = db.prepare("SELECT COUNT(*) AS c FROM images").get().c;
    const acceptedImages = db.prepare("SELECT COUNT(*) AS c FROM images WHERE status = 'accepted'").get().c;
    const publishedImages = db.prepare("SELECT COUNT(*) AS c FROM images WHERE is_published = 1").get().c;
    const totalCost = db.prepare("SELECT SUM(cost) AS s FROM generation_runs").get().s || 0;

    res.json({
      categories,
      subjects,
      variants,
      totalImages,
      acceptedImages,
      publishedImages,
      totalSpentUsd: Number(totalCost.toFixed(2)),
    });
  });

  app.listen(PORT, () => {
    console.log(`Studio Web UI running at http://localhost:${PORT}`);
    console.log("Press Ctrl+C to stop.\n");
  });
}
