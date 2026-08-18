# Project Context: Minimalist Drawing Reference App for Kids

## 1. Core Concept

**The problem it solves:** A kid says "how do I draw a car?" and the parent Googles "car drawing kids easy." They scroll past ads, inconsistent art styles, overly complex results, and random junk — all while handing a young child an open browser. This app replaces that workflow entirely.

**What it is:** A curated, offline library of simple drawing references. The images are *drawing prompts*, not coloring pages — the kid looks at the screen and draws their own version on physical paper. The key quality bar: if a young child can't look at the image and think "I could draw that," it doesn't belong in the app.

**Principles:** Offline-first, ad-free, no open browser, no distractions. The app gets out of the way so the kid can draw.

## 2. Technical Stack & Architecture
* **Frontend:** Vite + React 19 + TypeScript + Tailwind CSS v4 for a fast, responsive, web-first PWA.
* **Mobile Packaging:** Capacitor to package the static web build into a 100% offline Android App Bundle (`.aab`) for the Google Play Store ($25 lifetime developer account).
* **Backend:** 100% serverless/static to eliminate hosting costs ($0 on Vercel) and guarantee 0ms instant loading.
* **Asset Management:** Single production target in `web/public/`. All published images and `manifest.json` are bundled directly into the web static output and mobile binary for 100% offline reliability.
* **UX Architecture (Pattern A)**:
  - **Category Landing Grid**: Large, colorful touch cards (*Animals 🐱, Vehicles 🚗, Nature 🌻, Food 🍕, Buildings 🏰, People 🤖*).
  - **Active Search Layout**: Search results split into **Matching Categories (top row)** + **Matching Drawings grid (underneath)**.
  - **Dedicated Viewer Screen**: Pure white canvas with 3x3 Grid Overlay toggle, Mirroring, 1-Click Print, and Toddler Lock.

## 3. AI Asset Generation Pipeline (Local)

### 3.1 Hardware
* **Machine:** M3 Pro, 36 GB RAM — comfortably runs SD 1.5 with overhead to spare.
* **Why local:** Zero API costs, no daily generation limits, fast iteration on style.

### 3.2 Software: ComfyUI
ComfyUI is a node-based UI for Stable Diffusion. You build "workflows" by connecting nodes visually (load model → prompt → sample → decode → save). Workflows are saved as JSON and can be shared, version-controlled, and scripted for batch generation.

#### Installation & First Launch
ComfyUI should auto-detect MPS (Apple Silicon GPU) on first run. Confirm by checking the terminal output for `Using device: mps` when you start it.

If you installed via git clone, launch with:
```bash
python main.py
```
Then open `http://127.0.0.1:8188` in your browser.

#### Folder Structure (important — this is where you drop models)
```
ComfyUI/
├── models/
│   ├── checkpoints/    ← main SD model files (.safetensors)
│   ├── loras/          ← LoRA files (.safetensors)
│   ├── controlnet/     ← ControlNet models (.safetensors)
│   └── vae/            ← (optional) VAE overrides
├── output/             ← generated images land here
└── input/              ← reference images for ControlNet/img2img
```

### 3.3 Models to Download

Everything below is a `.safetensors` file. Download and drop into the corresponding `models/` subfolder.

#### Checkpoint (the base model) — pick ONE to start
| Model | Size | Where to get it | Notes |
|---|---|---|---|
| **Stable Diffusion 1.5** | ~4 GB | HuggingFace: `stable-diffusion-v1-5/stable-diffusion-v1-5` (file: `v1-5-pruned-emaonly.safetensors`) | The standard. Most LoRAs are trained against this. Start here. |
| Anything V5 | ~4 GB | CivitAI | Anime-leaning variant of SD 1.5. Can produce cleaner line art out of the box, but may fight you on "simple" — it wants to add detail. Try as a second option. |

**Recommendation:** Start with vanilla SD 1.5. It's the most predictable with LoRAs.

#### LoRAs (style modifiers) — download ALL of these, test each
Search CivitAI (civitai.com) for these by name. Each is a small file (typically 10–150 MB). Drop them in `models/loras/`.

| LoRA | What it does | Starting weight |
|---|---|---|
| **Coloring Book** (search: "coloring book line art") | Enforces thick black outlines on white background, removes shading | 0.7–0.9 |
| **Kids Illustration** or **Simple Cartoon** | Pushes toward rounder, simpler geometric shapes | 0.4–0.6 |

> **What is "LoRA weight"?** A number from 0 to 1 that controls how strongly the LoRA influences the output. At 0 it does nothing; at 1 it dominates. You'll set this in the ComfyUI workflow. Start with the values above and tune from there.

> **Expect to experiment.** CivitAI has dozens of "coloring book" LoRAs — quality varies. Download 2–3 that have good preview images matching your target style, test each, and keep the best one. This is the most important tuning step in the whole pipeline.

#### ControlNet (optional — for Phase 2)
| Model | What it does |
|---|---|
| **control_v11p_sd15_lineart** | Extracts line structure from a reference image and guides generation to follow it |
| **control_v11p_sd15_canny** | Edge detection variant — sharper, more mechanical lines |

ControlNet is useful for: (a) converting a rough sketch into a clean version, (b) generating pose/layout variants of an existing good image. **Skip this for now** — get the basic text-to-image pipeline producing good results first, then add ControlNet as a refinement tool.

### 3.4 Your First Workflow (Text-to-Image)

When you open ComfyUI, it loads a default workflow. Modify it or build from scratch with these nodes:

```
[Load Checkpoint] → [CLIP Text Encode (positive)] → [KSampler] → [VAE Decode] → [Save Image]
                  → [CLIP Text Encode (negative)] ↗
                  → [Load LoRA] ↗ (between checkpoint and CLIP)
```

**Node settings:**

| Node | Setting | Value |
|---|---|---|
| Load Checkpoint | ckpt_name | `v1-5-pruned-emaonly.safetensors` |
| Load LoRA | lora_name | your coloring book LoRA |
| Load LoRA | strength_model | 0.8 (adjust to taste) |
| Load LoRA | strength_clip | 0.8 (keep same as model) |
| KSampler | sampler | `euler_ancestral` |
| KSampler | scheduler | `normal` |
| KSampler | steps | 25 |
| KSampler | cfg | 7.0 |
| KSampler | denoise | 1.0 |
| Empty Latent Image | width | 512 |
| Empty Latent Image | height | 512 |

> **512x512** is the native resolution for SD 1.5. Going larger (768, 1024) often produces duplicated subjects or artifacts. Generate at 512 and upscale later if needed.

## 4. Prompting Strategy

### 4.1 The Style Template
Every prompt uses this skeleton. Only the `[SUBJECT]` changes:

**Positive prompt:**
```
a single [SUBJECT], centered, isolated on a pure white background,
minimalist bold-line cartoon, thick black outlines, simple geometric shapes,
coloring book style, kids illustration, no shading, no gradient,
no background details, no color, black and white line art
```

**Negative prompt (always include — tells the model what to avoid):**
```
photorealistic, 3d render, photograph, shading, gradient, shadow, gray,
color, watercolor, pencil sketch, crosshatching, multiple subjects,
text, watermark, signature, blurry, complex background, detailed background,
thin lines, realistic proportions, scary, dark, horror
```

### 4.2 Prompting Tips (for tuning the style template)
* **Front-load the subject.** SD pays more attention to the beginning of the prompt. The style template already does this — the `[SUBJECT]` comes first.
* **Be specific about the subject but vague about the style.** "a friendly cartoon cat sitting" works better than "a cat drawn in the style of a children's coloring book from the 1990s."
* **Use the negative prompt aggressively.** If outputs keep having shading, add more anti-shading terms. If you get gray backgrounds, add "gray background" to negatives.
* **Seed pinning.** When you find a good composition, note the seed number (shown in KSampler output). You can lock the seed and vary only the prompt to get consistent style across subjects.

### 4.3 Content Philosophy

**Why depth matters:** Competing apps might have one "owl." But a kid already has a picture in their head — they want *that* owl. A single generic option feels limiting. The app should feel like browsing a selection, not being handed one answer.

**Variant depth varies by subject — and that's fine.** Some subjects are naturally rich (dogs have dozens of recognizable breeds, flowers have endless variety) while others are simple (there are only so many ways to draw a tree or a star). The content library should reflect this reality, not force artificial uniformity.

For high-demand subjects (car, cat, dog, house, dinosaur — maybe top ~20), it's worth deliberately generating the same subject at different complexity levels (a rectangle-with-circles car vs a car with windows and headlights). For everything else, each variant has a natural difficulty and gets tagged accordingly — don't force 3 versions of every flower.

> **Prioritization heuristic:** Generate subjects a kid is most likely to ask for first. "How do I draw a dinosaur?" is more common than "how do I draw a lamp." Let your own kid's requests guide the initial content list.

### 4.4 Content Generation Pipeline

The full pipeline for going from "I want car drawings" to finished, tagged images in the app.

#### Stage 1: Define structure (you do this)

You decide the categories and what subjects belong in each. This is editorial work — what does a kid want to draw? Start simple:

```
animals: cat, dog, owl, fish, horse, butterfly, dinosaur, snake, frog, bear
vehicles: car, truck, boat, airplane, helicopter, train, rocket, bicycle
nature: tree, flower, sun, moon, star, cloud, mountain, rainbow
food: apple, pizza, ice cream, cupcake, banana, cookie
buildings: house, castle, skyscraper, barn, lighthouse
people: stick figure, princess, robot, superhero, pirate
```

#### Stage 2: AI generates variant ideas (LLM — Claude, etc.)

You feed a subject to an LLM and it brainstorms specific, visually distinct variants. This is where the creative expansion happens.

**Example prompt to the LLM:**
```
I'm building a kids drawing reference app. For the subject "car",
generate 8-12 visually distinct variants that a child might want to draw.
Each variant should be describable in a short phrase.
Think about: types, styles, distinguishing visual features, actions.
Don't get too niche — a kid should recognize what it is.
```

**Example output:**
```
car:
  - simple sedan (side view)
  - racecar with a spoiler and racing stripes
  - taxi cab with a roof light
  - police car with a light bar
  - VW beetle / rounded bug car
  - monster truck with huge wheels
  - convertible with the top down
  - old-timey car with big round headlights
  - pickup truck with stuff in the bed
  - jeep with a roll cage
```

These are variant *ideas*, not prompts yet. You review, edit, add, remove. Maybe your kid loves garbage trucks and you know that needs to be on the list. The LLM does the bulk brainstorming, you do the curation.

#### Stage 3: AI generates ComfyUI prompts (LLM)

Each variant idea gets expanded into a full SD prompt by combining it with the style template. The LLM does this so you don't have to manually merge hundreds of prompts.

**Example: variant idea → full prompt**

Variant idea: `racecar with a spoiler and racing stripes`

Full positive prompt:
```
a single racecar with a large rear spoiler and racing stripes along the side,
centered, isolated on a pure white background, minimalist bold-line cartoon,
thick black outlines, simple geometric shapes, coloring book style,
kids illustration, no shading, no gradient, no background details,
no color, black and white line art
```

The negative prompt stays the same for all images (see 4.1).

The LLM can generate all of these in bulk — give it the style template + a list of 50 variant ideas, get back 50 ready-to-use prompts. We can script this.

#### Stage 4: ComfyUI generates images (local, free)

Feed the prompts into ComfyUI. For each prompt, generate 3–5 images with different seeds to get options. Pick the best one (or none, and re-prompt).

**Batch approach:**
* **Manual (starting out):** Paste each prompt into ComfyUI, click "Queue Prompt," review results. Good for learning and tuning.
* **Scripted (at scale):** ComfyUI has an API at `http://127.0.0.1:8188/prompt`. A script reads the prompt list, POSTs each one, collects outputs. We can build this when you're ready.

#### Stage 5: Manual QA (you do this)

### 4.5 Post-Processing Checklist
Every generated image needs manual review before going into the app:

- [ ] **Single subject?** No duplicates, no extra floating shapes.
- [ ] **Clean white background?** No gray areas, no artifacts.
- [ ] **Bold, consistent lines?** No thin wispy lines, no broken outlines.
- [ ] **Appropriate for target age?** Nothing scary, overly complex, or confusing.
- [ ] **Correct proportions?** Friendly, slightly exaggerated cartoon proportions.
- [ ] **No text or watermarks?** SD sometimes hallucinates text.

Rejected images get regenerated with adjusted prompts or seeds. Expect roughly a 30–50% keep rate initially — this improves as you dial in the LoRA weight and prompt.

### 4.6 AI Tagging Pipeline

After an image passes manual QA, it gets run through a vision model (Claude or GPT-4o) for automated tagging. This is a separate step from image *generation* — it's a post-processing pass on accepted images. One API call per image, structured output back.

#### What the vision model tags

**1. Difficulty score (1–3)**

The model evaluates these concrete properties of the drawing:

| Factor | Easier (→ Level 1) | Harder (→ Level 3) |
|---|---|---|
| **Stroke count** | Few shapes (5–10) | Many shapes (20+) |
| **Line type** | Straight lines, basic curves | Complex curves, S-shapes, spirals |
| **Precision required** | Shapes don't need to connect precisely | Features must be placed accurately (e.g., facial features) |
| **Symmetry** | Asymmetric or forgiving | Must look balanced (butterfly, face) |
| **Fine detail** | No internal detail | Small features inside larger shapes |

The model sees the image + a rubric describing these factors, and returns a score with reasoning. The reasoning is useful for sanity-checking — if it says "Level 1 because only 6 straight lines" you can glance at the image and confirm.

| Level | What it means for the kid |
|---|---|
| **1** | "I can do that!" — a few big shapes, straight lines, very forgiving |
| **2** | Recognizable subject, needs some care with placement and curves |
| **3** | Challenging — many parts, curves, detail work, things need to line up |

**2. Search tags**

The same API call also returns structured tags for search and browse:

Search works by matching the user's query against tags at every level. Tags live on both categories and individual images.

**Category tags** are defined once, not per-image. They map broad/colloquial terms to a category:

| Category | Tags |
|---|---|
| animals | `animals`, `pets`, `creatures`, `wildlife` |
| vehicles | `vehicles`, `cars`, `trucks`, `things that go`, `transportation` |
| nature | `nature`, `plants`, `outside`, `garden`, `outdoors` |
| food | `food`, `snacks`, `fruit`, `drinks` |

**Image tags** are generated per-image by the vision model. They include the subject name plus alternate words someone might search:

| Field | What it is | Examples |
|---|---|---|
| **subject** | Primary name | `cat`, `fire truck`, `sunflower` |
| **tags** | Other words that should match this image | `kitty`, `kitten`, `firetruck`, `fire engine` |

> **Who's searching?** Young kids (3–5) won't type — they browse by tapping category icons. Older kids (6–7) might type a word or two. Parents search on behalf of their kid. Tags should cover natural variation: "fire truck" / "firetruck" / "fire engine", "kitty" / "cat", "dino" / "dinosaur". Practical, not exhaustive.

**How search resolves:** A query like "pets" hits the category tags → shows all animals. A query like "kitty" hits image-level tags → shows cat images directly.

#### Example API call (pseudocode)

```
Input:  image + system prompt with rubric
Output (JSON):
{
  "difficulty": 2,
  "difficulty_reasoning": "~15 strokes, mix of straight lines and gentle curves,
                           eyes and whiskers require moderate placement precision",
  "category": "animals",
  "subject": "cat",
  "tags": ["kitty", "kitten"]
}
```

#### The full image pipeline end-to-end

```
1. DEFINE       You write categories + subjects (or add to existing ones)
2. EXPAND       LLM brainstorms variant ideas → you curate
3. PROMPT       LLM combines variant ideas + style template → full SD prompts
4. GENERATE     ComfyUI renders images (local, free)
5. QA           Manual review — reject bad outputs
6. TAG          Vision model API call → difficulty + search tags (JSON)
7. PUBLISH      Image + metadata get a stable ID and enter the asset library
```

Steps 2–3 can be a single scripted LLM call. Step 6–7 can be scripted too. We can build these when you're ready.

### 4.7 Asset Library & State Management

**Core rule: the pipeline is additive. Images are never regenerated, replaced, or modified once published.**

A kid's favorite monster truck must stay exactly the same across every app update. This means:

#### Stable IDs

Every image gets a permanent ID the moment it passes QA and enters the asset library. This ID is what the app uses for favorites, and it never changes. Format doesn't matter much — could be a hash, a slug like `vehicles-car-racecar-001`, or a UUID. The point is: once assigned, it's permanent.

#### The manifest file

The asset library is tracked by a **manifest** — a single JSON file that is the source of truth for what exists. The pipeline checks this before doing anything.

```json
{
  "images": {
    "vehicles-car-racecar-001": {
      "file": "vehicles/car/racecar-001.png",
      "category": "vehicles",
      "subject": "car",
      "tags": ["racecar", "race car", "fast car", "sports car"],
      "difficulty": 2,
      "added": "2026-04-22",
      "prompt": "a single racecar with a large rear spoiler..."
    },
    "animals-cat-sitting-001": {
      "file": "animals/cat/sitting-001.png",
      "category": "animals",
      "subject": "cat",
      "tags": ["kitty", "kitten"],
      "difficulty": 1,
      "added": "2026-04-22",
      "prompt": "a single cat sitting upright with a curled tail..."
    }
  },
  "categories": {
    "animals": { "tags": ["animals", "pets", "creatures", "wildlife"] },
    "vehicles": { "tags": ["vehicles", "cars", "trucks", "things that go", "transportation"] }
  }
}
```

#### How state prevents re-work

* **Stage 2 (variant expansion):** The LLM gets the current manifest so it knows what variants already exist. If there are already 7 car variants, it suggests *new* ones, not duplicates.
* **Stage 3 (prompt generation):** Only generates prompts for new variants, not existing ones.
* **Stage 7 (publish):** Appends to the manifest. Never edits or removes existing entries.
* **Deleting content:** If an image is truly bad and needs removal (discovered after publishing), it gets marked as `"deprecated": true` in the manifest rather than deleted. The app hides deprecated images but existing favorites still resolve (gracefully — e.g., "this drawing is no longer available"). This should be rare.

#### What the app ships

The app bundles the manifest JSON + image files. On update, new images are added. Existing image IDs and files are untouched. A kid's favorites, stored locally by ID, always resolve to the same image.

## 5. UI/UX Principles
* **Kindergarten UX:** Massive hit targets, icon-driven navigation, audio feedback, and no dead ends.
* **The "Zen" View:** Full-screen reference images with an optional grid overlay. 
* **Validation:** The clean, minimal UX avoids the noisy "freemium" pitfalls of typical children's apps. In-house beta testing with a six-year-old and a three-year-old will immediately highlight necessary UI adjustments, while consulting a K-12 educator ensures the visual hierarchy and difficulty scaling perfectly match developmental stages.
* **Difficulty Scaling:** A parent-gated multi-select filter (Level 1, 2, 3) to curate the feed's complexity without cluttering the child's interface.

## 6. Ethical Monetization Strategy
* No advertisements, no virtual currency, no predatory subscriptions.
* Options include a simple upfront "Pay Once" premium model, a strictly parent-gated IAP for unlocking the full library, or keeping the app free while upselling printable high-res PDF coloring packs.
