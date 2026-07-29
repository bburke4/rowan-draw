# Image Generation Pipeline & Catalog Studio

Generates, reviews, tags, and publishes simple line-art drawing references for the **rowan-draw** app.

Powered by **Node 24 native SQLite (`node:sqlite`)**, Google **Gemini 3.6 Flash**, and the official **Interactions API** with **Nano Banana 2** image models.

## Setup

```bash
cd image-gen
nvm use          # requires Node 24
npm install
```

Create `.env`:
```env
GEMINI_API_KEY=your-key-here
```

## Quick Start

```bash
npm run status                      # View catalog, image, & cost statistics from SQLite
npm run expand                      # gemini-3.6-flash brainstorms variants into SQLite
npm run generate -- --dry-run       # Preview generation candidates
npm run generate                    # Generate candidate images into staging
npm run review                      # Launch Studio Web UI at http://localhost:3456
npm run tag                         # gemini-3.6-flash scores difficulty (1-3) & search tags
npm run publish                     # Copy accepted images to library/ + update manifest.json
```

## Architecture & Data Flow

```
                     ┌─────────────────────────┐
                     │   pipeline/catalog.db   │
                     │   (SQLite Database)     │
                     └────────────┬────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌───────────────────┐                             ┌───────────────────┐
│   CLI BATCH MODE  │                             │  STUDIO WEB APP   │
│ (Bulk Automation) │                             │ (http://localhost:3456)│
└───────────────────┘                             └───────────────────┘
 • npm run expand                                  • Multi-Image Accept
 • npm run generate                                • Edit Prompts per Variant
 • npm run tag                                     • In-Browser Retry & Model Select
 • npm run publish                                 • 1-Click Auto-Tag & Publish
```

## Key Workflows & Features

### 1. Safe Non-Destructive Generation (Experimenting on Published Variants)
Generating new image candidates for a variant that already has published images will **NEVER overwrite or break published assets**. 
* New candidate images land safely in staging (`generated/`) and are added to SQLite as `pending`.
* Your live published assets in `library/` and `manifest.json` stay 100% untouched.
* You can preview the new candidates in `http://localhost:3456`. If you like one, click **Accept** and **Publish**. If not, reject them—your published asset stays safe.

### 2. Multi-Image Acceptance
Unlike legacy flat JSON, the SQLite database supports accepting **multiple drawing candidates per variant**! If 2 or 3 generated variations look great for "sleeping cat", click **Accept** on all of them, giving kids rich options in the mobile app.

### 3. Model Toggling & In-UI Retries
When generating or retrying candidates in the Web UI (`http://localhost:3456`), you can select which model to use:
* **⚡ Nano Banana 2 Lite** (`gemini-3.1-flash-lite-image`, $0.034/img) — Default fast & cheap generation.
* **🎨 Nano Banana 2** (`gemini-3.1-flash-image`, $0.067/img) — High-fidelity generalist model.
* **🚀 Imagen 4 Fast** (`imagen-4.0-fast-generate-001`, $0.020/img) — Dedicated image diffusion.

### 4. Custom Prompt Overrides
In `http://localhost:3456`, click any variant's prompt box, type your customized prompt override (e.g. *"thicker outlines, simple side profile"*), and click **Save Prompt Override**. Future generation runs will use your customized prompt.

## Database & File Map

| Path | Type | Description |
|---|---|---|
| `pipeline/catalog.db` | SQLite DB | **Single Source of Truth** for categories, subjects, variants, generation runs, candidates, decisions, tags, and costs. |
| `generated/` | Folder | Raw staging area for candidate images undergoing review. |
| `library/` | Folder | Published production image assets read by the mobile app. |
| `manifest.json` | JSON | Published metadata bundle exported by `npm run publish` for the React Native app. |
| `.env` | Env File | Holds `GEMINI_API_KEY`. |

## Cost Reference

* **Nano Banana 2 Lite**: **$0.034 per image**
* **Nano Banana 2**: **$0.067 per image**
* **Imagen 4 Fast**: **$0.020 per image**
* **Gemini 3.6 Flash**: Standard text/vision tier for expansion and difficulty tagging.
