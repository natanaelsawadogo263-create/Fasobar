#!/usr/bin/env node
/**
 * Verify packaged Electron app (forge output used by NSIS):
 * 1) main.js bundles deps (no bare requires for zod / squirrel)
 * 2) AppUserModelId com.fasobar.desktop present
 * 3) resources/next-app has full Next standalone runtime (incl. @swc/helpers)
 * 4) Smoke-test: start packaged server.js, GET /api/desktop/health
 * 5) SQLite: database.status=ok, schemaVersion=4, installationId, fasobar.db + SELECT 1
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagedRoot = path.join(root, "out", "FasoBar-win32-x64");
const asarPath = path.join(packagedRoot, "resources", "app.asar");
const nextApp = path.join(packagedRoot, "resources", "next-app");
const extractDir = path.join(root, "out", ".asar-verify");
const smokePort = 3199;

function fail(message) {
  console.error(`[desktop:verify-package] ${message}`);
  process.exit(1);
}

function waitForPort(port, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = net.connect({ host: "127.0.0.1", port }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timeout waiting for port ${port}`));
          return;
        }
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

function fetchHealth(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port,
        path: "/api/desktop/health",
        timeout: 5000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode ?? 0, json: JSON.parse(body) });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("health request timeout"));
    });
  });
}

function assertNoTurbopackSqliteStub(nextAppRoot) {
  const serverDir = path.join(nextAppRoot, ".next", "server");
  if (!fs.existsSync(serverDir)) {
    fail("Missing .next/server in packaged next-app");
  }

  const stubNeedle = "Unsupported external type Url for commonjs reference";
  /** @type {string[]} */
  const stubHits = [];
  /** @type {string[]} */
  const requireHits = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".js")) continue;
      const text = fs.readFileSync(full, "utf8");
      const rel = path.relative(nextAppRoot, full).replace(/\\/g, "/");
      if (
        text.includes(stubNeedle) ||
        text.includes("Cannot find module 'node:sqlite'")
      ) {
        stubHits.push(rel);
      }
      if (
        text.includes('require("node:sqlite")') ||
        text.includes("require('node:sqlite')") ||
        text.includes('require("sqlite")') ||
        text.includes("require('sqlite')")
      ) {
        requireHits.push(rel);
      }
    }
  };
  walk(serverDir);

  if (stubHits.length > 0) {
    fail(
      `Bundles Next contiennent encore le stub Turbopack node:sqlite:\n` +
        stubHits.map((h) => `  - ${h}`).join("\n") +
        `\nRelancer avec: npm run desktop:build-next (next build --webpack)`,
    );
  }

  if (requireHits.length === 0) {
    fail(
      "Aucun require(node:sqlite) trouvé dans le standalone packagé — " +
        "le builtin n’est peut-être pas externalisé correctement.",
    );
  }

  const examples =
    requireHits
      .filter((h) => h.includes("api/desktop") || h.includes("chunks/"))
      .slice(0, 8)
      .join(", ") || requireHits.slice(0, 5).join(", ");

  console.log(
    "[desktop:verify-package] node:sqlite external OK (pas de stub Turbopack)",
  );
  console.log(
    `[desktop:verify-package] chunks avec require("node:sqlite"): ${requireHits.length} — ex. ${examples}`,
  );
}

function openAndSelectOne(dbPath) {
  const require = createRequire(import.meta.url);
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    const row = db.prepare("SELECT 1 AS ok").get();
    if (!row || Number(row.ok) !== 1) {
      throw new Error(`SELECT 1 failed: ${JSON.stringify(row)}`);
    }
  } finally {
    db.close();
  }
}

if (!fs.existsSync(asarPath)) {
  fail(`Missing ${asarPath}`);
}

const nextRequired = [
  ["server.js", path.join(nextApp, "server.js")],
  ["node_modules/next", path.join(nextApp, "node_modules", "next", "package.json")],
  [
    "node_modules/@swc/helpers",
    path.join(nextApp, "node_modules", "@swc", "helpers", "package.json"),
  ],
  ["node_modules/react", path.join(nextApp, "node_modules", "react", "package.json")],
  [
    "node_modules/react-dom",
    path.join(nextApp, "node_modules", "react-dom", "package.json"),
  ],
  [".next/server", path.join(nextApp, ".next", "server")],
  [".next/static", path.join(nextApp, ".next", "static")],
  ["public", path.join(nextApp, "public")],
];

const missingNext = nextRequired
  .filter(([, p]) => !fs.existsSync(p))
  .map(([label]) => label);

if (missingNext.length > 0) {
  fail(
    `resources/next-app incomplet : ${missingNext.join(", ")}\n` +
      `  Chemin : ${nextApp}`,
  );
}

// Scoped packages must not be URL-encoded leftovers
for (const name of fs.readdirSync(path.join(nextApp, "node_modules"))) {
  if (name.startsWith("%40")) {
    fail(`Scoped package encodé détecté dans next-app: ${name} (attendu @…)`);
  }
}

assertNoTurbopackSqliteStub(nextApp);

const packagedRenderer = path.join(packagedRoot, "resources", "renderer");
for (const name of ["splash.html", "setup.html", "error.html"]) {
  const full = path.join(packagedRenderer, name);
  if (!fs.existsSync(full)) {
    fail(`Missing packaged renderer file: ${full}`);
  }
}

fs.rmSync(extractDir, { recursive: true, force: true });
fs.mkdirSync(extractDir, { recursive: true });

const asarCli = path.join(
  root,
  "node_modules",
  "@electron",
  "asar",
  "bin",
  "asar.js",
);
execFileSync(process.execPath, [asarCli, "extract", asarPath, extractDir], {
  stdio: "inherit",
});

const mainJs = path.join(extractDir, ".vite", "build", "main.js");
if (!fs.existsSync(mainJs)) {
  fail("main.js not found in asar");
}

const source = fs.readFileSync(mainJs, "utf8");
const forbidden = [
  'require("electron-squirrel-startup")',
  "require('electron-squirrel-startup')",
  'require("zod")',
  "require('zod')",
];
const hits = forbidden.filter((needle) => source.includes(needle));
if (hits.length > 0) {
  fail(
    "Packaged main.js still requires modules that are not in asar:\n" +
      hits.map((h) => `  - ${h}`).join("\n"),
  );
}
if (!source.includes("com.fasobar.desktop")) {
  fail("AppUserModelId com.fasobar.desktop does not appear in main.js");
}
if (!source.includes("pathToFileURL") && !source.includes("fileURLToPath")) {
  // Bundlers may mangle the import name; also accept encoded file URL builder usage.
  if (!source.includes("file:") || !source.includes("renderer")) {
    fail(
      "Packaged main.js must load renderer HTML via pathToFileURL (Windows-safe file URLs)",
    );
  }
}

// Windows-safe URL check against the real packaged splash path
{
  const { pathToFileURL } = await import("node:url");
  const splashAbs = path.join(packagedRenderer, "splash.html");
  const url = pathToFileURL(splashAbs).toString();
  if (url.includes("\\")) {
    fail(`pathToFileURL produced backslashes: ${url}`);
  }
  if (/^file:\/\/\/[A-Za-z]:\\/.test(url)) {
    fail(`Invalid Windows file URL form: ${url}`);
  }
  console.log(`[desktop:verify-package] renderer splash URL OK → ${url}`);
}

const nextVersion = JSON.parse(
  fs.readFileSync(path.join(nextApp, "node_modules", "next", "package.json"), "utf8"),
).version;

// --- Smoke test Next server from packaged resources ---
const electronExe = path.join(packagedRoot, "FasoBar.exe");
if (!fs.existsSync(electronExe)) {
  fail(`Missing ${electronExe}`);
}

const smokeUserData = fs.mkdtempSync(path.join(os.tmpdir(), "fasobar-smoke-"));
const smokeOut = path.join(smokeUserData, "stdout.log");
const smokeErr = path.join(smokeUserData, "stderr.log");
const expectedDbPath = path.join(smokeUserData, "data", "fasobar.db");

const child = spawn(electronExe, ["server.js"], {
  cwd: nextApp,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    PORT: String(smokePort),
    HOSTNAME: "127.0.0.1",
    FASOBAR_RUNTIME: "desktop-server",
    FASOBAR_USER_DATA: smokeUserData,
    FASOBAR_INSTALLATION_ID: "00000000-0000-4000-8000-000000000099",
    FASOBAR_APP_VERSION: "0.1.0",
  },
  stdio: ["ignore", fs.openSync(smokeOut, "w"), fs.openSync(smokeErr, "w")],
  windowsHide: true,
});

let smokeFailed = null;
/** @type {unknown} */
let healthJson = null;
try {
  await waitForPort(smokePort, 45000);
  const health = await fetchHealth(smokePort);
  healthJson = health.json;

  if (health.statusCode !== 200 || health.json?.status !== "ok") {
    smokeFailed = `Health check failed: HTTP ${health.statusCode} body=${JSON.stringify(health.json)}`;
  } else if (health.json?.runtime !== "desktop-server") {
    smokeFailed = `Expected runtime=desktop-server, got ${JSON.stringify(health.json)}`;
  } else if (health.json?.database?.status !== "ok") {
    smokeFailed = `database.status must be ok, got ${JSON.stringify(health.json)}`;
  } else if (health.json?.database?.schemaVersion !== 4) {
    smokeFailed = `schemaVersion must be 4, got ${JSON.stringify(health.json)}`;
  } else if (!health.json?.installationId) {
    smokeFailed = `installationId must be non-null, got ${JSON.stringify(health.json)}`;
  } else {
    // Local auth module must load in the packaged server graph.
    const serverDir = path.join(nextApp, ".next", "server");
    let hasLocalAuth = false;
    const walkAuth = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkAuth(full);
          continue;
        }
        if (!entry.name.endsWith(".js")) continue;
        const text = fs.readFileSync(full, "utf8");
        if (
          text.includes("fasobar_lsid") ||
          text.includes("offline_credentials_ready") ||
          text.includes("scrypt-N16384")
        ) {
          hasLocalAuth = true;
        }
      }
    };
    walkAuth(serverDir);
    if (!hasLocalAuth) {
      smokeFailed =
        "Module auth locale introuvable dans le standalone (fasobar_lsid / scrypt).";
    }
  }
} catch (error) {
  smokeFailed = String(error);
} finally {
  if (!child.killed) {
    child.kill();
    await new Promise((r) => setTimeout(r, 1200));
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }
  }
}

if (!smokeFailed) {
  if (!fs.existsSync(expectedDbPath)) {
    smokeFailed = `fasobar.db not created at ${expectedDbPath}`;
  } else {
    try {
      openAndSelectOne(expectedDbPath);
      console.log(
        `[desktop:verify-package] smoke SQLite OK → ${JSON.stringify(healthJson)} ; db=${expectedDbPath}`,
      );
    } catch (error) {
      smokeFailed = `SELECT 1 on fasobar.db failed: ${error}`;
    }
  }
}

if (smokeFailed) {
  const errTail = fs.existsSync(smokeErr)
    ? fs.readFileSync(smokeErr, "utf8").slice(-2000)
    : "";
  const outTail = fs.existsSync(smokeOut)
    ? fs.readFileSync(smokeOut, "utf8").slice(-2000)
    : "";
  fail(
    `Smoke test serveur packagé échoué : ${smokeFailed}\n` +
      `health=${JSON.stringify(healthJson)}\n--- stderr ---\n${errTail}\n--- stdout ---\n${outTail}`,
  );
}

fs.rmSync(extractDir, { recursive: true, force: true });
try {
  fs.rmSync(smokeUserData, { recursive: true, force: true });
} catch {
  // ignore
}

console.log(
  `[desktop:verify-package] OK — AppUserModelId; next@${nextVersion}; @swc/helpers présent; smoke health+sqlite=ok`,
);
