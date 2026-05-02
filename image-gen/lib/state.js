import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const PIPELINE_DIR = path.join(import.meta.dirname, "..", "pipeline");

export function readState(filename, defaultValue = {}) {
  const filePath = path.join(PIPELINE_DIR, filename);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return structuredClone(defaultValue);
  }
}

export function writeState(filename, data) {
  fs.mkdirSync(PIPELINE_DIR, { recursive: true });
  const filePath = path.join(PIPELINE_DIR, filename);
  const tmpPath = filePath + "." + randomBytes(4).toString("hex") + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmpPath, filePath);
}

export function readManifest() {
  const filePath = path.join(import.meta.dirname, "..", "manifest.json");
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return { images: {}, categories: {} };
  }
}

export function writeManifest(data) {
  const filePath = path.join(import.meta.dirname, "..", "manifest.json");
  const tmpPath = filePath + "." + randomBytes(4).toString("hex") + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmpPath, filePath);
}

export function readCatalog() {
  const filePath = path.join(import.meta.dirname, "..", "catalog.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}
