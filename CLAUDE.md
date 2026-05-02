# rowan-draw

A kids drawing reference app. Kids ask "how do I draw a car?" and browse simple bold-line cartoon images to use as drawing references on paper.

## Project structure

```
rowan-draw/
  kids_drawing_app_context.md   # Full project design doc (app concept, pipeline, UX, monetization)
  image-gen/                    # Image generation pipeline (Node.js)
    catalog.json                # Hand-edited: categories and subjects
    manifest.json               # Output: published images + metadata (source of truth for the app)
    library/                    # Output: published image files
    cli.js                      # CLI entry point — dispatches to steps
    lib/                        # Shared modules (gemini client, prompts, state, ID generation)
    steps/                      # Pipeline steps (expand, generate, tag, publish)
    review/                     # Express server + HTML for image QA review UI
    pipeline/                   # Working state files (not committed)
    generated/                  # Raw Imagen output (not committed)
```

## Tech stack

- **Image generation pipeline:** Node.js (ES modules), Google Gemini API (gemini-2.5-flash for text/vision), Imagen 4 Fast API for image generation
- **App (not yet built):** React Native + Expo + TypeScript, targeting Android first then iOS
- Node 24 required (see .nvmrc)

## Working in image-gen/

All commands run from `image-gen/` directory. Requires `.env` with `GEMINI_API_KEY`.

Pipeline steps run in order: expand → generate → review → tag → publish

- `npm run expand` — LLM brainstorms variants for catalog subjects
- `npm run generate` — Imagen 4 renders images ($0.02/image). Use `-- --dry-run` to preview cost.
- `npm run review` — Starts local web UI at localhost:3456 for accept/reject QA
- `npm run tag` — Vision model scores difficulty (1-3) and generates search tags
- `npm run publish` — Copies accepted+tagged images to library/ and updates manifest.json
- `npm run status` — Shows pipeline progress

The pipeline is incremental — re-running any step only processes new/unprocessed items. State is tracked in `pipeline/*.json` files.

## Key design decisions

- Images are additive-only. Once published to manifest.json, an image is never modified or removed (kids save favorites by ID).
- catalog.json is the only hand-edited input. Everything else is derived.
- Style is consistent across all images: bold black lines, white background, simple geometric shapes.
- Difficulty is tagged per-image by AI vision model, not manually assigned.
