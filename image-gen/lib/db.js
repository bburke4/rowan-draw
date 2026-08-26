import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const PIPELINE_DIR = path.join(import.meta.dirname, "..", "pipeline");
const DB_PATH = path.join(PIPELINE_DIR, "catalog.db");

let _db = null;

export function getDb() {
  if (!_db) {
    if (!fs.existsSync(PIPELINE_DIR)) {
      fs.mkdirSync(PIPELINE_DIR, { recursive: true });
    }

    _db = new DatabaseSync(DB_PATH);
    _db.exec("PRAGMA foreign_keys = ON;");

    // Initialize Schema
    _db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        subject_type TEXT DEFAULT 'ORGANIC',
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category_id, slug)
      );

      CREATE TABLE IF NOT EXISTS variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        description TEXT NOT NULL,
        base_prompt TEXT NOT NULL,
        custom_prompt TEXT,
        status TEXT DEFAULT 'active',
        feedback_history TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(subject_id, slug)
      );

      CREATE TABLE IF NOT EXISTS generation_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        variant_id INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
        model_id TEXT NOT NULL,
        api_method TEXT NOT NULL,
        prompt_used TEXT NOT NULL,
        feedback_given TEXT,
        cost REAL DEFAULT 0.0,
        image_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        public_id TEXT UNIQUE NOT NULL,
        variant_id INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
        generation_run_id INTEGER REFERENCES generation_runs(id) ON DELETE SET NULL,
        file_path TEXT NOT NULL,
        published_path TEXT,
        status TEXT DEFAULT 'pending',
        image_description TEXT,
        difficulty_score INTEGER,
        difficulty_reasoning TEXT,
        tags_json TEXT,
        tagged_at DATETIME,
        is_published INTEGER DEFAULT 0,
        published_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_subjects_category ON subjects(category_id);
      CREATE INDEX IF NOT EXISTS idx_variants_subject ON variants(subject_id);
      CREATE INDEX IF NOT EXISTS idx_images_variant ON images(variant_id);
      CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);
    `);

    // Auto-seed categories and subjects from catalog.json if categories table is empty
    const catCount = _db.prepare("SELECT COUNT(*) AS c FROM categories").get().c;
    if (catCount === 0) {
      syncCatalog(_db);
    }
  }
  return _db;
}

export function syncCatalog(db) {
  const catalogPath = path.join(import.meta.dirname, "..", "catalog.json");
  if (!fs.existsSync(catalogPath)) return;
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
    const catStmt = db.prepare("INSERT OR IGNORE INTO categories (slug, name, sort_order) VALUES (?, ?, ?)");
    const subStmt = db.prepare("INSERT OR IGNORE INTO subjects (category_id, slug, name, subject_type, sort_order) VALUES (?, ?, ?, ?, ?)");
    const getCatIdStmt = db.prepare("SELECT id FROM categories WHERE slug = ?");

    let catIdx = 1;
    for (const [catSlug, catData] of Object.entries(catalog.categories || {})) {
      const catName = catSlug.charAt(0).toUpperCase() + catSlug.slice(1);
      catStmt.run(catSlug, catName, catIdx++);
      const catRow = getCatIdStmt.get(catSlug);
      if (!catRow) continue;

      let subIdx = 1;
      for (const subSlug of catData.subjects || []) {
        const subName = subSlug.charAt(0).toUpperCase() + subSlug.slice(1);
        const isDetailProne = ["vehicles", "buildings"].includes(catSlug);
        const subjectType = isDetailProne ? "DETAIL-PRONE" : "ORGANIC";
        subStmt.run(catRow.id, subSlug, subName, subjectType, subIdx++);
      }
    }
  } catch (err) {
    console.warn("Could not sync catalog.json:", err.message);
  }
}

