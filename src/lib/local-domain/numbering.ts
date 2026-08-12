import "server-only";

import type { SqlDatabase } from "@/lib/local-db/types";

/**
 * Local printable references, independent from Supabase sequences.
 * Example: LOCAL-CAISSE-000001
 */
export function nextLocalNumber(
  db: SqlDatabase,
  sequenceName: string,
  prefixOverride?: string,
): string {
  const row = db
    .prepare(
      "SELECT name, prefix, next_value FROM local_number_sequences WHERE name = ?",
    )
    .get(sequenceName);

  if (!row) {
    const prefix = prefixOverride ?? `LOCAL-${sequenceName.toUpperCase()}`;
    db.prepare(
      `INSERT INTO local_number_sequences (name, prefix, next_value)
       VALUES (?, ?, 2)`,
    ).run(sequenceName, prefix);
    return `${prefix}-000001`;
  }

  const nextValue = Number(row.next_value);
  const prefix = prefixOverride ?? String(row.prefix);
  db.prepare(
    "UPDATE local_number_sequences SET next_value = ? WHERE name = ?",
  ).run(nextValue + 1, sequenceName);

  return `${prefix}-${String(nextValue).padStart(6, "0")}`;
}
