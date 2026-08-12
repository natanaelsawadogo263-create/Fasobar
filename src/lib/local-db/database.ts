import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs";

import { appendDesktopLog } from "@/lib/desktop/logger";
import {
  getDesktopAppVersionFromEnv,
  getDesktopInstallationIdFromEnv,
  isDesktopServerRuntime,
} from "@/lib/desktop/runtime";
import { backupLocalDatabase } from "@/lib/local-db/backup";
import {
  applyMigrations,
  getAppliedSchemaVersion,
  loadMigrationDefinitions,
} from "@/lib/local-db/migrations";
import {
  ensureLocalDataDirectories,
  resolveLocalDataPaths,
  type LocalDataPaths,
} from "@/lib/local-db/paths";
import type { LocalDbHealth, SqlDatabase } from "@/lib/local-db/types";

type OpenOptions = {
  /** Override userData root (tests). */
  userDataRoot?: string;
  /** Skip startup backup (tests). */
  skipBackup?: boolean;
  /** Force open even when not desktop-server (tests). */
  force?: boolean;
};

let singleton: SqlDatabase | null = null;
let singletonPaths: LocalDataPaths | null = null;

function openSqliteFile(dbPath: string): SqlDatabase {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(dbPath, {
    enableForeignKeyConstraints: true,
  }) as unknown as SqlDatabase & {
    exec(sql: string): void;
  };

  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA synchronous = NORMAL;");

  return db;
}

function ensureInstallationRow(db: SqlDatabase): string {
  const envId = getDesktopInstallationIdFromEnv();
  const appVersion = getDesktopAppVersionFromEnv();
  const now = new Date().toISOString();

  const existing = db
    .prepare("SELECT installation_id FROM local_installation WHERE id = 1")
    .get();

  if (existing?.installation_id) {
    db.prepare(
      `UPDATE local_installation
       SET last_started_at = ?, app_version = ?
       WHERE id = 1`,
    ).run(now, appVersion);
    return String(existing.installation_id);
  }

  const installationId = envId || randomUUID();
  db.prepare(
    `INSERT INTO local_installation (
      id, installation_id, organization_id, establishment_id, machine_id,
      initialized_at, last_started_at, app_version
    ) VALUES (1, ?, NULL, NULL, NULL, ?, ?, ?)`,
  ).run(installationId, now, now, appVersion);

  db.prepare(
    `INSERT OR IGNORE INTO sync_state (
      id, cloud_available, consecutive_failures
    ) VALUES (1, 0, 0)`,
  ).run();

  db.prepare(
    `INSERT OR IGNORE INTO local_number_sequences (name, prefix, next_value)
     VALUES ('orders', 'LOCAL-CAISSE', 1)`,
  ).run();

  return installationId;
}

/**
 * Open (or return) the SERVEUR_CAISSE SQLite singleton.
 * Never call from BrowserWindow / POSTE_TRAVAIL client code.
 */
export function getLocalDatabase(options: OpenOptions = {}): SqlDatabase {
  if (singleton) {
    return singleton;
  }

  if (!options.force && !isDesktopServerRuntime() && !options.userDataRoot) {
    throw new Error(
      "SQLite n’est disponible qu’en runtime desktop-server (SERVEUR_CAISSE).",
    );
  }

  const paths = resolveLocalDataPaths(options.userDataRoot);
  ensureLocalDataDirectories(paths);

  const dbExists = fs.existsSync(paths.databaseFile);
  appendDesktopLog("database", "info", "Opening local database", {
    exists: dbExists,
  });

  const db = openSqliteFile(paths.databaseFile);

  if (dbExists && !options.skipBackup) {
    try {
      backupLocalDatabase(db, paths);
    } catch (error) {
      appendDesktopLog("backup", "warn", "Startup backup failed", {
        error: String(error),
      });
    }
  }

  try {
    applyMigrations(db, loadMigrationDefinitions());
  } catch (error) {
    db.close();
    appendDesktopLog("database", "error", "Migration failure on open", {
      error: String(error),
    });
    throw new Error(
      "La base locale n’a pas pu être migrée. Contactez le support FasoBar.",
    );
  }

  ensureInstallationRow(db);

  singleton = db;
  singletonPaths = paths;
  return db;
}

export function getLocalDatabasePaths(): LocalDataPaths | null {
  return singletonPaths;
}

export function closeLocalDatabase(): void {
  if (singleton) {
    try {
      singleton.close();
    } catch {
      // ignore
    }
    singleton = null;
    singletonPaths = null;
  }
}

/** Test helper — reset singleton between cases. */
export function resetLocalDatabaseSingletonForTests(): void {
  closeLocalDatabase();
}

export function getLocalDbHealth(): LocalDbHealth {
  try {
    if (!isDesktopServerRuntime() && !singleton) {
      return {
        ok: false,
        schemaVersion: null,
        installationId: null,
        message: "not_desktop_server",
      };
    }
    const db = singleton ?? getLocalDatabase({ skipBackup: true });
    const schemaVersion = getAppliedSchemaVersion(db);
    const row = db
      .prepare("SELECT installation_id FROM local_installation WHERE id = 1")
      .get();
    return {
      ok: true,
      schemaVersion,
      installationId: row?.installation_id
        ? String(row.installation_id)
        : null,
    };
  } catch (error) {
    appendDesktopLog("database", "error", "Health check failed", {
      error: String(error),
    });
    return {
      ok: false,
      schemaVersion: null,
      installationId: null,
      message: "unavailable",
    };
  }
}

export function getJournalMode(db: SqlDatabase = getLocalDatabase({ skipBackup: true })): string {
  const row = db.prepare("PRAGMA journal_mode").get();
  return String(row?.journal_mode ?? row?.JOURNAL_MODE ?? "").toLowerCase();
}

export function foreignKeysEnabled(
  db: SqlDatabase = getLocalDatabase({ skipBackup: true }),
): boolean {
  const row = db.prepare("PRAGMA foreign_keys").get();
  const value = row?.foreign_keys ?? row?.FOREIGN_KEYS;
  return Number(value) === 1;
}
