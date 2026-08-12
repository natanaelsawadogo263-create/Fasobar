import "server-only";

import fs from "node:fs";
import path from "node:path";

import { getDesktopUserDataPath } from "@/lib/desktop/runtime";

export type LocalDataPaths = {
  root: string;
  dataDir: string;
  backupsDir: string;
  logsDir: string;
  databaseFile: string;
};

/**
 * Resolve durable local paths under Electron userData (SERVEUR_CAISSE only).
 * Never use Program Files, project root, public/, or .next/.
 */
export function resolveLocalDataPaths(
  userDataRoot?: string | null,
): LocalDataPaths {
  const root =
    userDataRoot?.trim() ||
    getDesktopUserDataPath() ||
    path.join(process.cwd(), ".fasobar-local-data");

  const dataDir = path.join(root, "data");
  const backupsDir = path.join(root, "backups");
  const logsDir = path.join(root, "logs");
  const databaseFile = path.join(dataDir, "fasobar.db");

  return { root, dataDir, backupsDir, logsDir, databaseFile };
}

export function ensureLocalDataDirectories(paths: LocalDataPaths): void {
  for (const dir of [paths.root, paths.dataDir, paths.backupsDir, paths.logsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
