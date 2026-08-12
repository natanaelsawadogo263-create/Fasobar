#!/usr/bin/env node
/**
 * Démarre le serveur Next standalone (prod) hors Electron — utile pour tests LAN.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const appDir = path.join(root, "desktop", "resources", "next-app");
const serverJs = path.join(appDir, "server.js");

if (!fs.existsSync(serverJs)) {
  console.error(
    "Manquant : desktop/resources/next-app. Lancez npm run desktop:prepare",
  );
  process.exit(1);
}

const port = process.env.PORT || "3180";
const userData =
  process.env.FASOBAR_USER_DATA ||
  path.join(root, ".fasobar-local-data");
fs.mkdirSync(userData, { recursive: true });

const child = spawn(process.execPath, [serverJs], {
  cwd: appDir,
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: "0.0.0.0",
    FASOBAR_RUNTIME: "desktop-server",
    FASOBAR_USER_DATA: userData,
    FASOBAR_INSTALLATION_ID:
      process.env.FASOBAR_INSTALLATION_ID ||
      "00000000-0000-4000-8000-000000000001",
    FASOBAR_APP_VERSION: process.env.npm_package_version || "0.1.0",
  },
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
