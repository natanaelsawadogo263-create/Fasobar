/**
 * Build FasoBar-Setup-0.1.0.exe for Windows.
 *
 * IMPORTANT: Do NOT use nuget.exe to pack app files.
 * NuGet encodes `@` in paths as `%40`, so scoped packages like
 * `@swc/helpers` extract as `%40swc/helpers` and Node cannot resolve them.
 * We build the .nupkg as a plain zip with 7-Zip, preserving real `@` folder names.
 */
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const vendor = path.join(root, "node_modules", "electron-winstaller", "vendor");
const sevenZip = path.join(vendor, "7z.exe");
const outDir = path.join(root, "out", "make", "squirrel.windows", "x64");
const appDir = path.join(root, "out", "FasoBar-win32-x64");
const setupName = "FasoBar-Setup-0.1.0.exe";
const pkgName = "fasobar";
const version = "0.1.0";
const exeName = "FasoBar.exe";
const nupkgName = `${pkgName}.${version}.nupkg`;
const fullName = `${pkgName}-${version}-full.nupkg`;

function sha1File(filePath) {
  const hash = crypto.createHash("sha1");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex").toUpperCase();
}

function ensureSquirrelInApp() {
  const target = path.join(appDir, "Squirrel.exe");
  if (!fs.existsSync(target)) {
    fs.copyFileSync(path.join(vendor, "Squirrel.exe"), target);
  }
}

function robocopy(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const result = spawnSync(
    "robocopy",
    [src, dest, "/E", "/COPY:DAT", "/R:2", "/W:2", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"],
    { encoding: "utf8", windowsHide: true },
  );
  const code = result.status ?? 0;
  if (code >= 8) {
    throw new Error(`robocopy failed (${code}): ${src} → ${dest}`);
  }
}

function packNupkg() {
  ensureSquirrelInApp();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fasobar-nupkg-"));
  const stage = path.join(tmp, "stage");
  const libNet45 = path.join(stage, "lib", "net45");
  fs.mkdirSync(libNet45, { recursive: true });

  // Copy whole Electron app tree with real `@` directory names preserved.
  robocopy(appDir, libNet45);

  const nuspec = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2010/07/nuspec.xsd">
  <metadata>
    <id>${pkgName}</id>
    <title>FasoBar</title>
    <version>${version}</version>
    <authors>FasoBar</authors>
    <owners>FasoBar</owners>
    <requireLicenseAcceptance>false</requireLicenseAcceptance>
    <description>FasoBar desktop</description>
    <copyright>Copyright © ${new Date().getFullYear()} FasoBar</copyright>
  </metadata>
</package>
`;
  fs.writeFileSync(path.join(stage, `${pkgName}.nuspec`), nuspec, "utf8");

  // Minimal [Content_Types].xml for a valid nupkg/zip package
  fs.writeFileSync(
    path.join(stage, "[Content_Types].xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="nuspec" ContentType="application/octet"/>
  <Default Extension="exe" ContentType="application/octet"/>
  <Default Extension="dll" ContentType="application/octet"/>
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="js" ContentType="application/javascript"/>
  <Default Extension="css" ContentType="text/css"/>
  <Default Extension="html" ContentType="text/html"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="ico" ContentType="image/x-icon"/>
  <Default Extension="pak" ContentType="application/octet"/>
  <Default Extension="bin" ContentType="application/octet"/>
  <Default Extension="dat" ContentType="application/octet"/>
  <Default Extension="node" ContentType="application/octet"/>
  <Default Extension="cjs" ContentType="application/javascript"/>
  <Default Extension="mjs" ContentType="application/javascript"/>
  <Default Extension="map" ContentType="application/json"/>
  <Default Extension="txt" ContentType="text/plain"/>
  <Default Extension="md" ContentType="text/plain"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="asar" ContentType="application/octet"/>
</Types>
`,
    "utf8",
  );

  const packed = path.join(tmp, nupkgName);
  execFileSync(
    sevenZip,
    ["a", "-tzip", "-mx=5", packed, "*"],
    { cwd: stage, stdio: "inherit" },
  );

  const list = execFileSync(sevenZip, ["l", packed], { encoding: "utf8" });

  // Must keep real @ scoped paths — never %40swc
  if (list.includes("%40swc") || list.includes("%40next")) {
    throw new Error(
      "nupkg contains URL-encoded scoped paths (%40…) — Node cannot resolve @swc/@next",
    );
  }
  if (!/node_modules[/\\]@swc[/\\]helpers[/\\]package\.json/i.test(list)) {
    throw new Error(
      "nupkg missing node_modules/@swc/helpers/package.json — refuse broken Setup.exe",
    );
  }
  if (!/node_modules[/\\]next[/\\]package\.json/i.test(list)) {
    throw new Error("nupkg missing node_modules/next/package.json");
  }

  fs.mkdirSync(outDir, { recursive: true });
  const dest = path.join(outDir, nupkgName);
  fs.copyFileSync(packed, dest);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("nupkg", dest, fs.statSync(dest).size);
  return dest;
}

function buildEmbeddedZip(fullNupkgPath, releasesPath, gifPath) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fasobar-setup-"));
  fs.copyFileSync(path.join(vendor, "Squirrel.exe"), path.join(tmp, "Update.exe"));
  fs.copyFileSync(fullNupkgPath, path.join(tmp, path.basename(fullNupkgPath)));
  fs.copyFileSync(releasesPath, path.join(tmp, "RELEASES"));
  if (gifPath && fs.existsSync(gifPath)) {
    fs.copyFileSync(gifPath, path.join(tmp, "background.gif"));
  }

  const zipPath = path.join(os.tmpdir(), `fasobar-setup-${Date.now()}.zip`);
  execFileSync(sevenZip, ["a", "-tzip", "-mx=5", zipPath, "*"], {
    cwd: tmp,
    stdio: "inherit",
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  return zipPath;
}

function main() {
  if (!fs.existsSync(path.join(appDir, exeName))) {
    throw new Error(
      `Missing packaged app at ${appDir}. Run npm run desktop:build first.`,
    );
  }

  fs.mkdirSync(outDir, { recursive: true });
  const nupkgPath = packNupkg();
  const fullPath = path.join(outDir, fullName);
  fs.copyFileSync(nupkgPath, fullPath);

  const size = fs.statSync(fullPath).size;
  const sha1 = sha1File(fullPath);
  const releasesPath = path.join(outDir, "RELEASES");
  fs.writeFileSync(releasesPath, `${sha1} ${fullName} ${size}\n`, "utf8");
  console.log("RELEASES", sha1, fullName, size);

  const gifPath = path.join(
    root,
    "node_modules",
    "electron-winstaller",
    "resources",
    "install-spinner.gif",
  );
  const zipPath = buildEmbeddedZip(fullPath, releasesPath, gifPath);

  const setupOut = path.join(outDir, setupName);
  fs.copyFileSync(path.join(vendor, "Setup.exe"), setupOut);
  execFileSync(path.join(vendor, "WriteZipToSetup.exe"), [setupOut, zipPath], {
    stdio: "inherit",
  });
  fs.rmSync(zipPath, { force: true });
  fs.copyFileSync(setupOut, path.join(outDir, "Setup.exe"));

  console.log("OK", setupOut, fs.statSync(setupOut).size);
}

main();
