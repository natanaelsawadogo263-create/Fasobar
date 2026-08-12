#!/usr/bin/env node
/**
 * Build a real multi-resolution Windows ICO from the official FasoBar logo.
 * - Removes the opaque white studio background (keeps the green squircle)
 * - Emits 16 / 24 / 32 / 48 / 64 / 128 / 256 PNG layers inside one .ico
 * - Syncs installer / uninstaller / Electron assets
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const SOURCE_CANDIDATES = [
  path.join(root, "build", "icon-source.png"),
  path.join(root, "desktop", "assets", "icon.png"),
];

function fail(message) {
  console.error(`[desktop:generate-icons] ${message}`);
  process.exit(1);
}

function findSource() {
  for (const candidate of SOURCE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  fail(
    `Official logo not found. Expected one of:\n` +
      SOURCE_CANDIDATES.map((p) => `  - ${p}`).join("\n"),
  );
}

/**
 * Flood-fill near-white / light gray studio background → transparent.
 * Preserves white strokes of the glass (they are not connected to edges).
 */
function knockOutBackground(rgba, width, height) {
  const data = Buffer.from(rgba);
  const visited = new Uint8Array(width * height);
  const stack = [];

  const isBackground = (idx) => {
    const o = idx * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const a = data[o + 3];
    if (a < 8) return true;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    // White / light gray paper + soft shadow around the mark
    if (max >= 235 && sat < 0.12) return true;
    if (max >= 210 && sat < 0.08 && (r + g + b) / 3 >= 200) return true;
    if (max >= 180 && sat < 0.06 && (r + g + b) / 3 >= 175) return true;
    return false;
  };

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    if (!isBackground(idx)) return;
    visited[idx] = 1;
    stack.push(idx);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length) {
    const idx = stack.pop();
    data[idx * 4 + 3] = 0;
    const x = idx % width;
    const y = (idx / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  return data;
}

async function loadTransparentMaster(sourcePath) {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const knocked = knockOutBackground(data, info.width, info.height);

  // Trim transparent margins, keep a small padding so the squircle breathes.
  const trimmed = await sharp(knocked, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 4 })
    .png()
    .toBuffer({ resolveWithObject: true });

  const pad = Math.max(4, Math.round(Math.max(trimmed.info.width, trimmed.info.height) * 0.04));
  const side = Math.max(trimmed.info.width, trimmed.info.height) + pad * 2;

  return sharp({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: trimmed.data,
        left: Math.round((side - trimmed.info.width) / 2),
        top: Math.round((side - trimmed.info.height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function pngAtSize(masterPng, size) {
  // Slight oversample then downscale for cleaner 16–32px marks.
  const workSize = size <= 32 ? size * 4 : size;
  let pipeline = sharp(masterPng).resize(workSize, workSize, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    kernel: sharp.kernel.lanczos3,
  });
  if (workSize !== size) {
    pipeline = pipeline.resize(size, size, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    });
  }
  return pipeline.png({ compressionLevel: 9 }).toBuffer();
}

/** Windows ICO container with PNG-compressed images (Vista+). */
function encodeIco(images) {
  const count = images.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const dir = [];
  for (const img of images) {
    dir.push({ width: img.width, height: img.height, offset, bytes: img.png.length, png: img.png });
    offset += img.png.length;
  }
  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);
  dir.forEach((entry, i) => {
    const o = 6 + i * 16;
    out[o] = entry.width >= 256 ? 0 : entry.width;
    out[o + 1] = entry.height >= 256 ? 0 : entry.height;
    out[o + 2] = 0;
    out[o + 3] = 0;
    out.writeUInt16LE(1, o + 4);
    out.writeUInt16LE(32, o + 6);
    out.writeUInt32LE(entry.bytes, o + 8);
    out.writeUInt32LE(entry.offset, o + 12);
  });
  for (const entry of dir) {
    entry.png.copy(out, entry.offset);
  }
  return out;
}

function assertValidIco(filePath, expectedSizes) {
  const buf = fs.readFileSync(filePath);
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    fail(`${filePath} is a PNG renamed to .ico — refused`);
  }
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) {
    fail(`${filePath} is not a Windows ICO`);
  }
  const count = buf.readUInt16LE(4);
  const found = [];
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16;
    let w = buf[o];
    let h = buf[o + 1];
    if (w === 0) w = 256;
    if (h === 0) h = 256;
    found.push(w);
    const size = buf.readUInt32LE(o + 8);
    const off = buf.readUInt32LE(o + 12);
    if (buf[off] !== 0x89 || buf[off + 1] !== 0x50) {
      // BMP/DIB also OK, but we always emit PNG layers.
      const dib = buf.readUInt32LE(off) === 40;
      if (!dib) fail(`${filePath}: image #${i} is neither PNG nor DIB`);
    }
    if (size < 16) fail(`${filePath}: image #${i} too small`);
  }
  for (const size of expectedSizes) {
    if (!found.includes(size)) {
      fail(`${filePath} missing ${size}x${size} (have: ${found.join(", ")})`);
    }
  }
}

async function main() {
  const source = findSource();
  console.log(`[desktop:generate-icons] source=${source}`);

  const master = await loadTransparentMaster(source);
  const masterMeta = await sharp(master).metadata();
  if (!masterMeta.hasAlpha) {
    fail("Transparent master lost alpha channel");
  }

  const layers = [];
  for (const size of SIZES) {
    const png = await pngAtSize(master, size);
    layers.push({ width: size, height: size, png });
  }

  const ico = encodeIco(layers);
  const outputs = [
    path.join(root, "build", "icon.ico"),
    path.join(root, "build", "installerIcon.ico"),
    path.join(root, "build", "uninstallerIcon.ico"),
    path.join(root, "desktop", "assets", "icon.ico"),
  ];

  fs.mkdirSync(path.join(root, "build"), { recursive: true });
  fs.mkdirSync(path.join(root, "desktop", "assets"), { recursive: true });

  for (const out of outputs) {
    fs.writeFileSync(out, ico);
    assertValidIco(out, SIZES);
    console.log(`[desktop:generate-icons] wrote ${path.relative(root, out)} (${ico.length} bytes)`);
  }

  // High-res transparent PNG for packaging / docs (not a renamed ICO).
  const png512 = await pngAtSize(master, 512);
  fs.writeFileSync(path.join(root, "desktop", "assets", "icon.png"), png512);
  // Keep a clean master next to build resources for future regenerations.
  fs.writeFileSync(path.join(root, "build", "icon-transparent.png"), png512);

  const tray = await pngAtSize(master, 32);
  fs.writeFileSync(path.join(root, "desktop", "assets", "tray-icon.png"), tray);

  console.log(
    `[desktop:generate-icons] OK — multi-res ICO [${SIZES.join(", ")}] from official logo`,
  );
}

main().catch((error) => {
  fail(String(error?.stack || error));
});
