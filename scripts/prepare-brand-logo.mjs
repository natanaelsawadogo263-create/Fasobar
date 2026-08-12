#!/usr/bin/env node
/**
 * Recadre le logo Cursor (logo/*.png), retire le fond, et exporte
 * les variantes clair / sombre pour public/brand/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logoDir = path.join(root, "logo");
const outDir = path.join(root, "public", "brand");

function findSource() {
  if (!fs.existsSync(logoDir)) {
    throw new Error(`Dossier introuvable: ${logoDir}`);
  }
  const files = fs
    .readdirSync(logoDir)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .map((name) => {
      const file = path.join(logoDir, name);
      return { file, mtime: fs.statSync(file).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) {
    throw new Error("Aucun PNG dans logo/");
  }
  return files[0].file;
}

function liftNavyForDark(rgba) {
  const px = Buffer.from(rgba);
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const a = px[i + 3];
    if (a < 12) continue;
    const isNavy = r < 50 && g < 80 && b > 55 && b > g + 10 && b > r + 20;
    if (!isNavy) continue;
    px[i] = Math.min(255, r + 118);
    px[i + 1] = Math.min(255, g + 108);
    px[i + 2] = Math.min(255, b + 96);
  }
  return px;
}

async function exportPng(buffer, width, height, dest) {
  await sharp(buffer, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(dest);
}

async function main() {
  const source = findSource();
  fs.mkdirSync(outDir, { recursive: true });

  const trimmed = sharp(source).ensureAlpha().trim({ threshold: 12 });
  const { data, info } = await trimmed.raw().toBuffer({ resolveWithObject: true });

  const lightPath = path.join(outDir, "fasobar-logo.png");
  const darkPath = path.join(outDir, "fasobar-logo-on-dark.png");

  await exportPng(data, info.width, info.height, lightPath);
  await exportPng(liftNavyForDark(data), info.width, info.height, darkPath);

  const lightMeta = await sharp(lightPath).metadata();
  console.log(
    `[prepare-brand-logo] ${path.relative(root, source)} → ${info.width}×${info.height} (alpha=${lightMeta.hasAlpha})`,
  );
}

main().catch((error) => {
  console.error("[prepare-brand-logo]", error.message);
  process.exit(1);
});
