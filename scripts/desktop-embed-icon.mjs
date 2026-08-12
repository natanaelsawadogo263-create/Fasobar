#!/usr/bin/env node
/**
 * Force-embed build/icon.ico into the packaged FasoBar.exe (Windows PE resources).
 * Runs after electron-forge package so the taskbar / Explorer / shortcuts never
 * fall back to the default Electron icon.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const icoPath = path.join(root, "build", "icon.ico");
const exePath = path.join(root, "out", "FasoBar-win32-x64", "FasoBar.exe");

function fail(message) {
  console.error(`[desktop:embed-icon] ${message}`);
  process.exit(1);
}

function assertValidIco(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    fail(`${icoPath} is a PNG renamed to .ico`);
  }
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) {
    fail(`${icoPath} is not a Windows ICO`);
  }
  const count = buf.readUInt16LE(4);
  if (count < 7) fail(`${icoPath} must contain ≥7 images (have ${count})`);
}

async function main() {
  if (!fs.existsSync(icoPath)) fail(`Missing ${icoPath}. Run desktop:generate-icons.`);
  if (!fs.existsSync(exePath)) {
    fail(`Missing ${exePath}. Run desktop:package-app first.`);
  }

  const icoBuf = fs.readFileSync(icoPath);
  assertValidIco(icoBuf);

  const { load } = require("resedit/cjs");
  const resedit = await load();

  const before = fs.readFileSync(exePath);
  const exe = resedit.NtExecutable.from(before);
  const res = resedit.NtExecutableResource.from(exe);
  const groups = resedit.Resource.IconGroupEntry.fromEntries(res.entries);
  if (groups.length < 1) {
    fail("FasoBar.exe has no icon group to replace");
  }

  const iconFile = resedit.Data.IconFile.from(icoBuf);
  if (iconFile.icons.length < 7) {
    fail(`ICO parsed with only ${iconFile.icons.length} images`);
  }

  resedit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    groups[0].id,
    groups[0].lang,
    iconFile.icons.map((item) => item.data),
  );
  res.outputResource(exe);
  const after = Buffer.from(exe.generate());
  fs.writeFileSync(exePath, after);

  // Proof: largest PNG layer from ICO must appear inside the PE.
  const layers = [];
  const count = icoBuf.readUInt16LE(4);
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16;
    const size = icoBuf.readUInt32LE(o + 8);
    const off = icoBuf.readUInt32LE(o + 12);
    layers.push(icoBuf.subarray(off, off + size));
  }
  const largest = layers.reduce((a, b) => (a.length >= b.length ? a : b));
  if (after.indexOf(largest) < 0) {
    fail("Embedded icon PNG layer not found inside FasoBar.exe after write");
  }

  console.log(
    `[desktop:embed-icon] OK — ${path.relative(root, icoPath)} → ${path.relative(root, exePath)} (${after.length} bytes)`,
  );
}

main().catch((error) => fail(String(error?.stack || error)));
