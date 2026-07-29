# rowan-draw

A kids drawing reference app. Kids ask "how do I draw a car?" and browse simple bold-line cartoon images to use as drawing references on paper.

## Project structure

```
rowan-draw/
  kids_drawing_app_context.md   # Full project design doc (app concept, pipeline, UX, monetization)
  image-gen/                    # Image generation pipeline (Node.js 24 + SQLite + Interactions API)
    catalog.json                # Seed category & subject list
    manifest.json               # Output: published images + metadata (source of truth for the app)
    library/                    # Output: published image files
    pipeline/
      catalog.db                # SQLite Database (Single Source of Truth for pipeline, state, and QA)
    cli.js                      # CLI entry point — dispatches to steps
    lib/                        # Shared modules (db.js SQLite connection, gemini.js client, prompts)
    steps/                      # Pipeline steps (expand, generate, tag, publish)
    review/                     # Studio Web UI (Express server + HTML at localhost:3456)
    generated/                  # Raw candidate images (staging area)
```

## Tech stack

- **Models:**
  - **Prompt Expansion & Vision Tagging:** Google Gemini API (`gemini-3.6-flash`)
  - **Image Generation:** Nano Banana 2 (`gemini-3.1-flash-image`), Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`), or Imagen 4 Fast (`imagen-4.0-fast-generate-001`) via the Google Gen AI SDK (`@google/genai` >= 2.0) & Interactions API (`ai.interactions.create`).
- **Database:** Node 24 native SQLite (`node:sqlite`) at `pipeline/catalog.db`.
- **App (not yet built):** React Native + Expo + TypeScript, targeting Android first then iOS.
- Node 24 required (see `.nvmrc`).

## Working in image-gen/

All commands run from `image-gen/` directory. Requires `.env` with `GEMINI_API_KEY`.

Pipeline steps run via CLI or Studio Web UI:

- `npm run expand` — `gemini-3.6-flash` brainstorms variants for subjects and inserts them into SQLite
- `npm run generate` — Generates candidate images into `generated/` and records runs in SQLite
- `npm run review` — Starts Studio Web UI at `http://localhost:3456` for interactive review, multi-accept, prompt editing, and model toggling
- `npm run tag` — `gemini-3.6-flash` vision scores difficulty (1-3) and generates search tags in SQLite
- `npm run publish` — Copies accepted+tagged images to `library/` and updates `manifest.json`
- `npm run status` — Shows catalog & image statistics

## Key design decisions

- **SQLite as Source of Truth**: All categories, subjects, variants, generation runs, candidates, QA decisions, and tags are stored centrally in `pipeline/catalog.db`.
- **Non-Destructive Generation**: Generating new candidates for an already published variant will NEVER overwrite or break existing published assets in `library/` or `manifest.json`. New candidates land safely in staging for review.
- **Multi-Image Acceptance**: Multiple high-quality candidate drawings can be accepted for the same variant, giving kids multiple options.
- **Interactions API & Nano Banana 2**: Image generation uses Google's latest `ai.interactions.create` API with `gemini-3.1-flash-lite-image` ($0.034/img) and `gemini-3.1-flash-image` ($0.067/img).
- **Style Consistency**: Bold black lines, white background, simple geometric shapes suitable for ages 3-7.
