import "server-only";

import fs from "node:fs";
import path from "node:path";

import { appendDesktopLog } from "@/lib/desktop/logger";
import {
  ensureLocalDataDirectories,
  resolveLocalDataPaths,
  type LocalDataPaths,
} from "@/lib/local-db/paths";
import type { SqlDatabase } from "@/lib/local-db/types";

const MAX_BACKUPS = 10;

/**
 * Safe SQLite backup via VACUUM INTO (consistent snapshot, respects WAL).
 */
export function backupLocalDatabase(
  db: SqlDatabase,
  paths?: LocalDataPaths,
): string {
  const resolved = paths ?? resolveLocalDataPaths();
  ensureLocalDataDirectories(resolved);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(resolved.backupsDir, `fasobar-${stamp}.db`);

  const sqlPath = target.replace(/\\/g, "/").replace(/'/g, "''");
  db.exec(`VACUUM INTO '${sqlPath}'`);
  appendDesktopLog("backup", "info", "Backup created", {
    file: path.basename(target),
  });
  pruneOldBackups(resolved.backupsDir);
  return target;
}

export function backupIfDatabaseExists(paths?: LocalDataPaths): string | null {
  const resolved = paths ?? resolveLocalDataPaths();
  if (!fs.existsSync(resolved.databaseFile)) {
    return null;
  }
  // Opening is required for VACUUM INTO — caller should pass open db when possible.
  return null;
}

export function pruneOldBackups(
  backupsDir: string,
  maxFiles: number = MAX_BACKUPS,
): void {
  if (!fs.existsSync(backupsDir)) return;
  const files = fs
    .readdirSync(backupsDir)
    .filter((f) => f.startsWith("fasobar-") && f.endsWith(".db"))
    .map((name) => ({
      name,
      full: path.join(backupsDir, name),
      mtime: fs.statSync(path.join(backupsDir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const stale of files.slice(maxFiles)) {
    try {
      fs.unlinkSync(stale.full);
      appendDesktopLog("backup", "info", "Pruned old backup", {
        file: stale.name,
      });
    } catch (error) {
      appendDesktopLog("backup", "warn", "Failed to prune backup", {
        file: stale.name,
        error: String(error),
      });
    }
  }
}
