# Image Generation Pipeline

Generates, reviews, tags, and publishes simple line-art drawing references for the rowan-draw app.

## Setup

```bash
cd image-gen
nvm use          # needs Node 24
npm install
```

Create `.env`:
```
GEMINI_API_KEY=your-key-here
```

## Quick start

```bash
npm run status                      # see where things stand
npm run expand                      # brainstorm variants for all subjects
npm run generate -- --dry-run       # preview cost before generating
npm run generate                    # generate images (costs money!)
npm run review                      # open http://localhost:3456 to accept/reject
npm run tag                         # AI scores difficulty + search tags
npm run publish                     # move accepted images to library + manifest
```

## Pipeline overview

```
catalog.json → expand → generate → review → tag → publish → manifest.json
  (you edit)    (LLM)   (Imagen)   (you)   (LLM)  (copy)    (app reads)
```

Each step is incremental. Running it again only processes new items — it won't duplicate work or waste API money.

## Step by step

### 1. Edit the catalog

`catalog.json` defines what to generate. Add categories, subjects, or search tags:

```json
{
  "categories": {
    "animals": {
      "tags": ["animals", "pets", "creatures"],
      "subjects": ["cat", "dog", "owl"]
    }
  }
}
```

### 2. Expand variants

```bash
npm run expand
```

For each new subject, the LLM brainstorms visually distinct variants (e.g., "sitting cat", "sleeping curled-up cat", "kitten playing"). Results saved to `pipeline/variants.json`.

Flags:
- `-- --category animals` — only expand new subjects in one category
- `-- --subject cat` — re-expand a specific subject
- `-- --force` — re-expand even if variants already exist (e.g., after changing the style prompt)

### 3. Generate images

```bash
npm run generate -- --dry-run       # ALWAYS preview cost first
npm run generate                    # generate for real
npm run generate -- --limit 5       # cap at 5 variants per run
```

Calls Imagen 4 Fast ($0.02/image, 4 images per variant = $0.08/variant). Images land in `generated/{category}/{subject}/{variant}/`.

Flags:
- `-- --dry-run` — show what would be generated + estimated cost
- `-- --limit N` — max variants to generate in one run
- `-- --category animals` — only generate for one category
- `-- --subject cat` — only generate for one subject
- `-- --force` — regenerate even if images exist (skips anything already picked/published)

### 4. Review images

```bash
npm run review
```

Opens a web UI at http://localhost:3456. For each variant you see 4 generated images.

- **Click an image** to pick the best one (one pick per variant)
- **Skip variant** — permanently discard a bad variant idea
- **Regenerate** — try again with new images. Type what was wrong (e.g., "too detailed") and it gets added to the prompt next time.
- Arrow keys to navigate between variants
- Filter by pending/picked/category
- To stop the server: `npm run review:stop`

### 5. Tag accepted images

```bash
npm run tag
```

Sends each picked image to Gemini's vision model which returns:
- **Difficulty** (1-3): how hard is this for a kid to draw?
- **Tags**: search terms (e.g., "kitty", "kitten" for a cat image)

### 6. Publish

```bash
npm run publish
```

For each picked + tagged image:
- Assigns a stable ID (e.g., `animals-cat-sitting-cat-001`)
- Copies the image to `library/{category}/{subject}/`
- Adds it to `manifest.json`

`manifest.json` is the source of truth the app reads. Once an image is published, it's permanent.

## Files

| File | Committed? | Description |
|---|---|---|
| `catalog.json` | Yes | Your input — categories and subjects |
| `manifest.json` | Yes | Published output — the app reads this |
| `library/` | Yes | Published image files |
| `pipeline/*.json` | No | Working state between steps |
| `generated/` | No | Raw Imagen output (staging area) |
| `.env` | No | API key |

## Cost

Imagen 4 Fast: **$0.02 per image**, 4 images per variant.

Example: 40 subjects x ~8 variants each x 4 images = 1,280 images = **~$25.60**

Always use `--dry-run` before generating to see the cost.
