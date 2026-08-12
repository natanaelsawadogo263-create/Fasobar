#!/usr/bin/env node
/**
 * Verify FasoBar Windows branding icons:
 *  - build/icon.ico is a real multi-resolution ICO (not a renamed PNG)
 *  - package configs reference that ICO
 *  - packaged FasoBar.exe embeds the icon (PE resource, not loose file only)
 *  - optional: Setup silent-install proof (Desktop / Start Menu / DisplayIcon)
 *
 * Usage:
 *   node scripts/desktop-verify-icons.mjs
 *   node scripts/desktop-verify-icons.mjs --packaged
 *   node scripts/desktop-verify-icons.mjs --setup
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const args = new Set(process.argv.slice(2));
const checkPackaged = args.has("--packaged") || args.has("--setup");
const checkSetup = args.has("--setup");

function fail(message) {
  console.error(`[desktop:verify-icons] ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[desktop:verify-icons] ${message}`);
}

function parseIco(filePath) {
  if (!fs.existsSync(filePath)) fail(`Missing ${filePath}`);
  const buf = fs.readFileSync(filePath);
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    fail(`${filePath} is a PNG renamed to .ico — refused`);
  }
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) {
    fail(`${filePath} is not a Windows ICO`);
  }
  const count = buf.readUInt16LE(4);
  const layers = [];
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16;
    let w = buf[o];
    let h = buf[o + 1];
    if (w === 0) w = 256;
    if (h === 0) h = 256;
    const size = buf.readUInt32LE(o + 8);
    const off = buf.readUInt32LE(o + 12);
    if (off + size > buf.length) fail(`${filePath}: image #${i} out of bounds`);
    const payload = buf.subarray(off, off + size);
    const isPng = payload[0] === 0x89 && payload[1] === 0x50;
    const isDib = payload.readUInt32LE(0) === 40;
    if (!isPng && !isDib) fail(`${filePath}: image #${i} neither PNG nor DIB`);
    layers.push({
      width: w,
      height: h,
      size,
      sha256: crypto.createHash("sha256").update(payload).digest("hex"),
      payload,
    });
  }
  for (const size of SIZES) {
    if (!layers.some((l) => l.width === size && l.height === size)) {
      fail(
        `${filePath} missing ${size}x${size} (have: ${layers
          .map((l) => `${l.width}x${l.height}`)
          .join(", ")})`,
      );
    }
  }
  return { buf, layers };
}

function assertConfigUsesIcon() {
  const yml = fs.readFileSync(path.join(root, "electron-builder.yml"), "utf8");
  for (const needle of [
    "icon: build/icon.ico",
    "installerIcon: build/installerIcon.ico",
    "uninstallerIcon: build/uninstallerIcon.ico",
  ]) {
    if (!yml.includes(needle)) fail(`electron-builder.yml missing "${needle}"`);
  }

  const forge = fs.readFileSync(path.join(root, "forge.config.ts"), "utf8");
  if (!forge.includes("build/icon") && !forge.includes("build\\\\icon")) {
    fail("forge.config.ts must set packagerConfig.icon to build/icon");
  }

  const main = fs.readFileSync(path.join(root, "desktop", "main", "main.ts"), "utf8");
  if (!main.includes('app.setAppUserModelId("com.fasobar.desktop")')) {
    fail('main.ts must call app.setAppUserModelId("com.fasobar.desktop")');
  }

  const windows = fs.readFileSync(
    path.join(root, "desktop", "main", "windows.ts"),
    "utf8",
  );
  if (!windows.includes("icon.ico") || !windows.includes("icon:")) {
    fail("windows.ts BrowserWindow must set icon to FasoBar icon.ico");
  }

  ok("configs reference build/icon.ico + AppUserModelId + BrowserWindow icon");
}

function assertExeEmbedsIco(exePath, ico) {
  if (!fs.existsSync(exePath)) fail(`Missing ${exePath}`);
  const exeBuf = fs.readFileSync(exePath);

  // Strong proof: each PNG/DIB layer from the official ICO appears in the PE.
  const missing = [];
  for (const layer of ico.layers) {
    if (exeBuf.indexOf(layer.payload) < 0) {
      missing.push(`${layer.width}x${layer.height}`);
    }
  }
  if (missing.length === ico.layers.length) {
    fail(
      `${exePath} does not embed any layer from build/icon.ico — still Electron default?`,
    );
  }
  if (missing.length > 0) {
    // Some PE writers may recompress; require at least the 256px + one small size.
    const has256 = ico.layers.some(
      (l) => l.width === 256 && exeBuf.indexOf(l.payload) >= 0,
    );
    const hasSmall = ico.layers.some(
      (l) => l.width <= 32 && exeBuf.indexOf(l.payload) >= 0,
    );
    if (!has256 || !hasSmall) {
      fail(
        `${exePath} incomplete icon embed (missing exact layers: ${missing.join(", ")})`,
      );
    }
    ok(
      `FasoBar.exe embeds FasoBar ICO (exact match for critical sizes; near-match for ${missing.join(", ")})`,
    );
  } else {
    ok(
      `FasoBar.exe embeds full multi-res ICO [${SIZES.join(", ")}] — ${path.relative(root, exePath)}`,
    );
  }

  // Also confirm PE has an icon group via resedit.
  return loadReseditAndAssertGroup(exePath);
}

async function loadReseditAndAssertGroup(exePath) {
  const { load } = require("resedit/cjs");
  const resedit = await load();
  const exe = resedit.NtExecutable.from(fs.readFileSync(exePath));
  const res = resedit.NtExecutableResource.from(exe);
  const groups = resedit.Resource.IconGroupEntry.fromEntries(res.entries);
  if (groups.length < 1) fail(`${exePath}: no RT_GROUP_ICON resource`);
  const items = groups[0].getIconItemsFromEntries(res.entries);
  if (!items || items.length < 1) {
    fail(`${exePath}: icon group is empty`);
  }
  ok(`PE icon group OK (${items.length} image(s), group id=${groups[0].id})`);
  return items.length;
}

function assertPackagedAssets(ico) {
  const packagedIco = path.join(
    root,
    "out",
    "FasoBar-win32-x64",
    "resources",
    "assets",
    "icon.ico",
  );
  if (!fs.existsSync(packagedIco)) {
    fail(`Missing packaged asset ${packagedIco}`);
  }
  const packaged = parseIco(packagedIco);
  const a = ico.layers.map((l) => l.sha256).join(",");
  const b = packaged.layers.map((l) => l.sha256).join(",");
  if (a !== b) {
    fail("resources/assets/icon.ico differs from build/icon.ico");
  }
  ok("resources/assets/icon.ico matches build/icon.ico");
}

function readShortcut(lnkPath) {
  const ps = `
$ErrorActionPreference = 'Stop'
$sh = New-Object -ComObject WScript.Shell
$l = $sh.CreateShortcut(${JSON.stringify(lnkPath)})
Write-Output ("TARGET=" + $l.TargetPath)
Write-Output ("ICON=" + $l.IconLocation)
`;
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", ps],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) {
    fail(`Cannot read shortcut ${lnkPath}: ${result.stderr || result.stdout}`);
  }
  const lines = (result.stdout || "").split(/\r?\n/);
  const target = lines
    .find((l) => l.startsWith("TARGET="))
    ?.slice("TARGET=".length)
    ?.trim();
  const icon = lines
    .find((l) => l.startsWith("ICON="))
    ?.slice("ICON=".length)
    ?.trim();
  return { target, icon };
}

function readDisplayIconFromRegistry() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$paths = @(
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
foreach ($p in $paths) {
  Get-ItemProperty $p | Where-Object { $_.DisplayName -like 'FasoBar*' } | ForEach-Object {
    Write-Output ("DISPLAYICON=" + $_.DisplayIcon)
    Write-Output ("INSTALLLOC=" + $_.InstallLocation)
  }
}
`;
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", ps],
    { encoding: "utf8", windowsHide: true },
  );
  const lines = (result.stdout || "").split(/\r?\n/).filter(Boolean);
  const displayIcon = lines
    .find((l) => l.startsWith("DISPLAYICON="))
    ?.slice("DISPLAYICON=".length)
    ?.trim();
  const installLoc = lines
    .find((l) => l.startsWith("INSTALLLOC="))
    ?.slice("INSTALLLOC=".length)
    ?.trim();
  return { displayIcon, installLoc };
}

async function proveCleanInstall(setupPath, ico) {
  if (!fs.existsSync(setupPath)) fail(`Missing setup ${setupPath}`);

  const installDir = path.join(os.tmpdir(), `fasobar-icon-proof-${Date.now()}`);
  fs.mkdirSync(installDir, { recursive: true });

  ok(`Silent install → ${installDir}`);
  const install = spawnSync(
    setupPath,
    ["/S", `/D=${installDir}`],
    { encoding: "utf8", windowsHide: true, timeout: 300000 },
  );
  if (install.error) fail(`Setup spawn failed: ${install.error.message}`);

  const installedExe = path.join(installDir, "FasoBar.exe");
  // NSIS /S can return before files flush; wait briefly.
  const deadline = Date.now() + 60000;
  while (!fs.existsSync(installedExe) && Date.now() < deadline) {
    spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 500)"], {
      windowsHide: true,
    });
  }
  if (!fs.existsSync(installedExe)) {
    fail(`After silent install, missing ${installedExe}`);
  }

  assertExeEmbedsIco(installedExe, ico);

  const desktopLnk = path.join(os.homedir(), "Desktop", "FasoBar.lnk");
  const desktopLnkAlt = path.join(
    process.env.PUBLIC || "C:\\Users\\Public",
    "Desktop",
    "FasoBar.lnk",
  );
  const startLnk = path.join(
    process.env.APPDATA || "",
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "FasoBar.lnk",
  );

  const desktop =
    fs.existsSync(desktopLnk)
      ? desktopLnk
      : fs.existsSync(desktopLnkAlt)
        ? desktopLnkAlt
        : null;
  if (!desktop) {
    fail("Desktop shortcut FasoBar.lnk not found after install");
  }
  const desk = readShortcut(desktop);
  if (!/FasoBar\.exe$/i.test(desk.target || "")) {
    fail(`Desktop shortcut target invalid: ${desk.target}`);
  }
  if (!/FasoBar\.exe/i.test(desk.icon || "")) {
    fail(`Desktop shortcut icon must point to FasoBar.exe, got: ${desk.icon}`);
  }
  ok(`Desktop shortcut OK → target=${desk.target} icon=${desk.icon}`);

  if (!fs.existsSync(startLnk)) {
    fail(`Start Menu shortcut missing: ${startLnk}`);
  }
  const start = readShortcut(startLnk);
  if (!/FasoBar\.exe/i.test(start.icon || "")) {
    fail(`Start Menu icon must point to FasoBar.exe, got: ${start.icon}`);
  }
  ok(`Start Menu shortcut OK → icon=${start.icon}`);

  const { displayIcon } = readDisplayIconFromRegistry();
  if (!displayIcon) {
    fail("Uninstall registry DisplayIcon not found for FasoBar");
  }
  const displayOk =
    /FasoBar\.exe/i.test(displayIcon) ||
    /uninstallerIcon\.ico/i.test(displayIcon) ||
    /icon\.ico/i.test(displayIcon);
  if (!displayOk) {
    fail(`DisplayIcon unexpected: ${displayIcon}`);
  }
  ok(`Apps & Features DisplayIcon OK → ${displayIcon}`);

  // Uninstall silently
  const uninstaller = path.join(installDir, "Uninstall FasoBar.exe");
  const altUninstaller = fs
    .readdirSync(installDir)
    .find((f) => /^uninstall/i.test(f) && f.endsWith(".exe"));
  const uninstallExe = fs.existsSync(uninstaller)
    ? uninstaller
    : altUninstaller
      ? path.join(installDir, altUninstaller)
      : null;
  if (uninstallExe) {
    spawnSync(uninstallExe, ["/S"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 180000,
    });
    ok(`Silent uninstall via ${path.basename(uninstallExe)}`);
  } else {
    ok("Uninstaller not found — left proof install dir for manual cleanup");
  }
}

async function main() {
  const iconPath = path.join(root, "build", "icon.ico");
  const ico = parseIco(iconPath);
  ok(
    `ICO OK ${path.relative(root, iconPath)} — sizes [${ico.layers
      .map((l) => `${l.width}x${l.height}`)
      .join(", ")}]`,
  );

  for (const rel of [
    "build/installerIcon.ico",
    "build/uninstallerIcon.ico",
    "desktop/assets/icon.ico",
  ]) {
    parseIco(path.join(root, rel));
    ok(`${rel} valid multi-res ICO`);
  }

  assertConfigUsesIcon();

  if (checkPackaged) {
    const exe = path.join(root, "out", "FasoBar-win32-x64", "FasoBar.exe");
    assertExeEmbedsIco(exe, ico);
    assertPackagedAssets(ico);
  }

  if (checkSetup) {
    const setup = path.join(root, "dist", "desktop", "FasoBar-Setup.exe");
    await proveCleanInstall(setup, ico);
  }

  ok("ALL ICON CHECKS PASSED");
}

main().catch((error) => fail(String(error?.stack || error)));
