import "server-only";

import { createHash } from "node:crypto";

import { appendDesktopLog } from "@/lib/desktop/logger";
import type { SqlDatabase } from "@/lib/local-db/types";
import { LOCAL_SCHEMA_VERSION } from "@/lib/local-db/types";
import { MIGRATION_001_SQL } from "@/lib/local-db/migrations/001_initial";
import { MIGRATION_002_SQL } from "@/lib/local-db/migrations/002_local_auth";
import { MIGRATION_003_SQL } from "@/lib/local-db/migrations/003_offline_caisse";
import { MIGRATION_004_SQL } from "@/lib/local-db/migrations/004_saas_authorization";
import { MIGRATION_005_SQL } from "@/lib/local-db/migrations/005_order_item_prepared_quantity";

export type MigrationDefinition = {
  version: number;
  name: string;
  sql: string;
  checksum: string;
};

function checksumOf(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Ordered migrations — SQL embedded for standalone Electron packaging. */
export function loadMigrationDefinitions(): MigrationDefinition[] {
  const entries: Array<{ version: number; name: string; sql: string }> = [
    { version: 1, name: "initial", sql: MIGRATION_001_SQL },
    { version: 2, name: "local_auth", sql: MIGRATION_002_SQL },
    { version: 3, name: "offline_caisse", sql: MIGRATION_003_SQL },
    { version: 4, name: "saas_authorization", sql: MIGRATION_004_SQL },
    { version: 5, name: "order_item_prepared_quantity", sql: MIGRATION_005_SQL },
  ];

  return entries.map((entry) => ({
    ...entry,
    checksum: checksumOf(entry.sql),
  }));
}

export function applyMigrations(
  db: SqlDatabase,
  migrations: MigrationDefinition[] = loadMigrationDefinitions(),
): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS local_schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      checksum TEXT
    );
  `);

  const applied = db
    .prepare("SELECT version FROM local_schema_migrations ORDER BY version")
    .all()
    .map((row) => Number(row.version));

  let latest = applied.length > 0 ? Math.max(...applied) : 0;

  for (const migration of migrations.sort((a, b) => a.version - b.version)) {
    if (applied.includes(migration.version)) {
      continue;
    }

    appendDesktopLog("migrations", "info", "Applying migration", {
      version: migration.version,
      name: migration.name,
    });

    try {
      db.exec("BEGIN IMMEDIATE");
      db.exec(migration.sql);
      db.prepare(
        `INSERT INTO local_schema_migrations (version, name, applied_at, checksum)
         VALUES (?, ?, ?, ?)`,
      ).run(
        migration.version,
        migration.name,
        new Date().toISOString(),
        migration.checksum,
      );
      db.exec("COMMIT");
      latest = migration.version;
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // ignore
      }
      appendDesktopLog("migrations", "error", "Migration failed", {
        version: migration.version,
        name: migration.name,
        error: String(error),
      });
      throw error;
    }
  }

  return latest;
}

export function getAppliedSchemaVersion(db: SqlDatabase): number {
  try {
    const row = db
      .prepare(
        "SELECT COALESCE(MAX(version), 0) AS version FROM local_schema_migrations",
      )
      .get();
    return Number(row?.version ?? 0);
  } catch {
    return 0;
  }
}

export function expectedSchemaVersion(): number {
  return LOCAL_SCHEMA_VERSION;
}
