#!/usr/bin/env node
/**
 * Prépare le bundle Next.js standalone pour Electron.
 * Source de vérité : .next/standalone (copie intégrale, sans filtrer @* / node_modules).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const staticDir = path.join(root, ".next", "static");
const publicDir = path.join(root, "public");
const outDir = path.join(root, "desktop", "resources", "next-app");

function mustExist(label, target) {
  if (!fs.existsSync(target)) {
    throw new Error(`[desktop:prepare] Manquant : ${label} → ${target}`);
  }
}

function robocopy(src, dest, extraArgs = []) {
  fs.mkdirSync(dest, { recursive: true });
  const args = [
    src,
    dest,
    "/E",
    "/COPY:DAT",
    "/R:2",
    "/W:2",
    "/NFL",
    "/NDL",
    "/NJH",
    "/NJS",
    "/NP",
    ...extraArgs,
  ];
  console.log(`[desktop:prepare] robocopy ${src} → ${dest}`);
  const result = spawnSync("robocopy", args, {
    encoding: "utf8",
    windowsHide: true,
  });
  const code = result.status ?? 0;
  if (code >= 8) {
    console.error(result.stdout || "");
    console.error(result.stderr || "");
    throw new Error(`[desktop:prepare] robocopy failed with code ${code}`);
  }
}

function assertPrepared(dir) {
  const required = [
    ["server.js", path.join(dir, "server.js")],
    ["package.json", path.join(dir, "package.json")],
    ["node_modules/next", path.join(dir, "node_modules", "next", "package.json")],
    [
      "node_modules/@swc/helpers",
      path.join(dir, "node_modules", "@swc", "helpers", "package.json"),
    ],
    ["node_modules/react", path.join(dir, "node_modules", "react", "package.json")],
    [
      "node_modules/react-dom",
      path.join(dir, "node_modules", "react-dom", "package.json"),
    ],
    [".next", path.join(dir, ".next")],
    [".next/server", path.join(dir, ".next", "server")],
    [".next/static", path.join(dir, ".next", "static")],
    ["public", path.join(dir, "public")],
  ];
  const missing = required.filter(([, p]) => !fs.existsSync(p)).map(([n]) => n);
  if (missing.length > 0) {
    throw new Error(
      `[desktop:prepare] next-app incomplet, manquant : ${missing.join(", ")}`,
    );
  }

  // Scoped packages must keep real @ names (never %40)
  const nm = path.join(dir, "node_modules");
  for (const name of fs.readdirSync(nm)) {
    if (name.startsWith("%40")) {
      throw new Error(
        `[desktop:prepare] dossier scoped encodé détecté (${name}) — attendu @…`,
      );
    }
  }
}

mustExist(".next/standalone", standalone);
mustExist(
  "standalone/node_modules/next",
  path.join(standalone, "node_modules", "next", "package.json"),
);
mustExist(
  "standalone/node_modules/@swc/helpers",
  path.join(standalone, "node_modules", "@swc", "helpers", "package.json"),
);
mustExist(".next/static", staticDir);
mustExist("public", publicDir);

console.log(`[desktop:prepare] source=${standalone}`);
console.log(`[desktop:prepare] dest=${outDir}`);

const stale = `${outDir}.stale-${Date.now()}`;
if (fs.existsSync(outDir)) {
  try {
    fs.renameSync(outDir, stale);
  } catch {
    fs.rmSync(outDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 250,
    });
  }
}

fs.mkdirSync(outDir, { recursive: true });

// Full mirror of standalone. Only exclude accidental local data dir if present.
robocopy(standalone, outDir, ["/XD", ".fasobar-local-data"]);

for (const name of fs.readdirSync(outDir)) {
  if (name === ".env" || name.startsWith(".env.")) {
    fs.rmSync(path.join(outDir, name), { force: true });
  }
}

const staticTarget = path.join(outDir, ".next", "static");
fs.mkdirSync(path.join(outDir, ".next"), { recursive: true });
robocopy(staticDir, staticTarget);
robocopy(publicDir, path.join(outDir, "public"));

fs.writeFileSync(
  path.join(root, "desktop", "resources", "desktop.env.example"),
  `# Variables publiques uniquement — jamais de SECRET / SERVICE_ROLE / OPENAI
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
PORT=3180
HOSTNAME=0.0.0.0
`,
  "utf8",
);

assertPrepared(outDir);

const nextPkg = JSON.parse(
  fs.readFileSync(path.join(outDir, "node_modules", "next", "package.json"), "utf8"),
);
console.log(`[desktop:prepare] OK → ${outDir} (next@${nextPkg.version})`);

if (fs.existsSync(stale)) {
  try {
    fs.rmSync(stale, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch {
    console.warn(`[desktop:prepare] impossible de supprimer ${stale} (verrouillé)`);
  }
}
