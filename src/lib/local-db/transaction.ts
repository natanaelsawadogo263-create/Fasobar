import "server-only";

import type { SqlDatabase } from "@/lib/local-db/types";

export function withTransaction<T>(
  db: SqlDatabase,
  fn: () => T,
): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw error;
  }
}
