# Rowan Draw — Web App 🎨

A minimalist, offline-first web application designed for kids (ages 3–7) to find simple bold-line drawing references to copy onto physical paper.

---

## 🚀 Tech Stack

- **Framework**: React 19 + TypeScript
- **Build System**: Vite 8 (Ultra-fast HMR & static compilation)
- **Styling**: Tailwind CSS v4 + Custom HSL Design Tokens
- **Icons**: Lucide React
- **Mobile Packaging**: Capacitor Ready (for Android Play Store bundling)
- **Deployment**: Static build output in `dist/` suitable for Vercel, Netlify, or GitHub Pages ($0 hosting)

---

## 🎨 App Architecture & UX Flow

### 1. Pattern A Home View (`/#`)
- **Global Search Bar**: Instant in-memory search across categories, subjects, descriptions, and `#tags`.
- **Active Search Layout**: When searching, results split dynamically into:
  - **Matching Categories** (top row)
  - **Matching Drawings** (2-column mobile grid underneath)
- **Category Cards Grid**: Large, colorful touch cards displaying emojis, titles, and item counts (*Animals 🐱, Vehicles 🚗, Nature 🌻, Food 🍕, Buildings 🏰, People 🤖*).

### 2. Category Detail View (`/#category/:slug`)
- Displays drawings for a specific topic with **Difficulty Level Filtering**:
  - **Level 1 ★**: Easy
  - **Level 2 ★★**: Medium
  - **Level 3 ★★★**: Challenge

### 3. Dedicated Fullscreen Drawing Viewer (`/#view/:id`)
- Distraction-free, pure white canvas viewport.
- **Kid & Parent Tools**:
  - ⬅️ **Back Button**: Natural browser history navigation.
  - 📐 **3x3 Grid Overlay**: Toggle faint alignment grid to help kids match proportions on physical paper.
  - 🔄 **Mirror / Flip**: Flips drawing horizontally (great for left-handed drawing preferences).
  - 🖨️ **1-Click Print**: Generates a clean A4/Letter physical drawing practice sheet (`window.print()`).
  - 🔒 **Toddler Lock**: Fades floating controls to prevent accidental exits when handled by young children.

---

## 📁 Directory Structure

```
web/
├── public/
│   ├── manifest.json       # Source of truth catalog outputted by image-gen pipeline
│   └── library/             # Published PNG image files (library/category/subject/...)
├── src/
│   ├── components/
│   │   ├── Header.tsx       # Top bar + sticky search input
│   │   ├── CategoryCard.tsx # Touch card for category landing
│   │   ├── DrawingCard.tsx  # Drawing thumbnail + difficulty badge
│   │   ├── DrawingGrid.tsx  # Responsive 2-4 column grid
│   │   └── DrawingViewer.tsx# Fullscreen drawing canvas with tools
│   ├── hooks/
│   │   └── useCatalog.ts    # Loads manifest.json & handles search/filter logic
│   ├── types/
│   │   └── catalog.ts       # TypeScript schemas (Manifest, CatalogImage, Category)
│   ├── App.tsx              # Hash router & view orchestration
│   ├── index.css            # Tailwind directives, fonts, & print styles
│   └── main.tsx             # Entry point
├── dist/                    # Production bundle output
├── index.html
├── package.json
└── vite.config.ts
```

---

## 🛠️ Commands

Run all commands from the `web/` directory:

```bash
# Start local development server (http://localhost:5173)
npm run dev

# Typecheck and build production bundle into dist/
npm run build

# Local preview of the production build
npm run preview
```

---

## 🔄 Publishing New Images

When new candidate drawings are reviewed and accepted in the `image-gen` pipeline, run:

```bash
cd ../image-gen
npm run publish
```

This automatically copies new published PNG files into `web/public/library/` and updates `web/public/manifest.json`.
