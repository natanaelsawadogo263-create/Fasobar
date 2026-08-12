import "server-only";

import type { SqlDatabase } from "@/lib/local-db/types";

/** Stable device / installation id used in outbox + local rows. */
export function getLocalDeviceId(db: SqlDatabase): string {
  const row = db
    .prepare("SELECT installation_id FROM local_installation WHERE id = 1")
    .get();
  if (!row?.installation_id) {
    throw new Error("Installation locale introuvable.");
  }
  return String(row.installation_id);
}

export function moneyXof(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.trunc(value);
}
