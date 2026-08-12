#!/usr/bin/env node
/**
 * Échoue si des *valeurs* de secrets interdits sont détectées dans le package desktop.
 * Les simples références code à process.env.OPENAI_API_KEY ne sont pas des secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const targets = [
  path.join(root, "desktop", "resources"),
  path.join(root, "out"),
];

/** Real assignments / embedded values — not bare env var name mentions. */
const forbidden = [
  /SUPABASE_SECRET_KEY\s*=\s*["']?(?!["'\s])[^\s"']+/i,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?(?!["'\s])[^\s"']+/i,
  /SERVICE_ROLE_KEY\s*=\s*["']?(?!["'\s])[^\s"']{20,}/i,
  /OPENAI_API_KEY\s*=\s*["']?sk-[A-Za-z0-9_-]{10,}/i,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT-like
];

const textExtensions = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".env",
  ".txt",
  ".md",
  ".html",
  ".map",
]);

const skipDirNames = new Set([
  "node_modules",
  ".git",
  "next-app-debug",
  ".asar-verify",
]);

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirNames.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

const hits = [];

for (const target of targets) {
  for (const file of walk(target)) {
    const base = path.basename(file);
    const ext = path.extname(file).toLowerCase();
    if (!textExtensions.has(ext) && !base.startsWith(".env")) {
      continue;
    }
    let content = "";
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const pattern of forbidden) {
      if (pattern.test(content)) {
        hits.push(`${file} ↔ ${pattern}`);
      }
    }
  }
}

if (hits.length > 0) {
  console.error("[desktop:check-secrets] Secrets interdits détectés :");
  for (const hit of hits) console.error(" -", hit);
  process.exit(1);
}

console.log("[desktop:check-secrets] OK — aucun secret interdit détecté.");
