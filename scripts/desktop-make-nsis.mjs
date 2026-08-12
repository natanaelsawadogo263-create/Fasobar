#!/usr/bin/env node
/**
 * Produce the client-facing Windows installer with electron-builder NSIS.
 * Input: forge-packaged app at out/FasoBar-win32-x64 (next-app intact).
 * Output: dist/desktop/FasoBar-Setup.exe
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prepackaged = path.join(root, "out", "FasoBar-win32-x64");
const setupOut = path.join(root, "dist", "desktop", "FasoBar-Setup.exe");
const electronBuilder = path.join(
  root,
  "node_modules",
  "electron-builder",
  "cli.js",
);

function fail(message) {
  console.error(`[desktop:make-nsis] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(prepackaged)) {
  fail(`Missing prepackaged app: ${prepackaged}. Run desktop:build first.`);
}

const exe = path.join(prepackaged, "FasoBar.exe");
if (!fs.existsSync(exe)) {
  fail(`Missing ${exe}`);
}

const nextApp = path.join(prepackaged, "resources", "next-app");
if (!fs.existsSync(path.join(nextApp, "server.js"))) {
  fail("Packaged next-app/server.js missing — refuse NSIS build.");
}

for (const icon of [
  "build/icon.ico",
  "build/installerIcon.ico",
  "build/uninstallerIcon.ico",
]) {
  if (!fs.existsSync(path.join(root, icon))) {
    fail(`Missing ${icon}`);
  }
}

// Refuse a PNG renamed to .ico (must be a real multi-resolution Windows ICO).
{
  const ico = fs.readFileSync(path.join(root, "build", "icon.ico"));
  if (ico[0] === 0x89 && ico[1] === 0x50) {
    fail("build/icon.ico is a PNG renamed to .ico — run desktop:generate-icons");
  }
  if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) {
    fail("build/icon.ico is not a Windows ICO");
  }
}

// Re-assert PE embed before NSIS so Setup ships FasoBar branding, not Electron.
{
  const embed = spawnSync(process.execPath, [path.join(root, "scripts", "desktop-embed-icon.mjs")], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if ((embed.status ?? 1) !== 0) {
    fail("desktop-embed-icon failed before NSIS");
  }
}

if (!fs.existsSync(electronBuilder)) {
  fail("electron-builder is not installed. Run npm install.");
}

console.log("[desktop:make-nsis] Building NSIS installer from", prepackaged);

const result = spawnSync(
  process.execPath,
  [
    electronBuilder,
    "--prepackaged",
    prepackaged,
    "--config",
    "electron-builder.yml",
    "--win",
    "nsis",
    "--x64",
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      // Avoid publishing / token prompts during local make.
      CSC_IDENTITY_AUTO_DISCOVERY: "false",
    },
    windowsHide: true,
  },
);

if ((result.status ?? 1) !== 0) {
  fail(`electron-builder failed with code ${result.status}`);
}

if (!fs.existsSync(setupOut)) {
  // electron-builder sometimes suffixes version; locate FasoBar-Setup*.exe
  const dir = path.join(root, "dist", "desktop");
  const matches = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /^FasoBar-Setup.*\.exe$/i.test(f))
    : [];
  if (matches.length === 0) {
    fail(`Expected installer not found under ${dir}`);
  }
  const found = path.join(dir, matches[0]);
  if (found !== setupOut) {
    fs.copyFileSync(found, setupOut);
  }
}

const size = fs.statSync(setupOut).size;
console.log(`[desktop:make-nsis] OK ${setupOut} (${size} bytes)`);
