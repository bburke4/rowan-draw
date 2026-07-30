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

    // Ensure image_description column exists if database was created prior
    try {
      _db.exec("ALTER TABLE images ADD COLUMN image_description TEXT;");
    } catch {}
  }
  return _db;
}
