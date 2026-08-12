import "server-only";

import type { SyncUiStatus } from "@/lib/local-db/types";
import type { SqlDatabase } from "@/lib/local-db/types";
import { countOutboxByStatus } from "@/lib/sync/outbox";

export type SyncStateRow = {
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  cloudAvailable: boolean;
  consecutiveFailures: number;
  pullCursor: string | null;
  nextSyncAt: string | null;
  catalogUpdatedAt: string | null;
};

export type ResolveSyncUiStatusOptions = {
  /**
   * Live Supabase reachability from a network probe.
   * When provided, overrides stale `sync_state.cloud_available`.
   */
  cloudReachable?: boolean;
};

export function readSyncState(db: SqlDatabase): SyncStateRow {
  const row = db.prepare("SELECT * FROM sync_state WHERE id = 1").get();
  if (!row) {
    return {
      lastPushAt: null,
      lastPullAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null,
      cloudAvailable: false,
      consecutiveFailures: 0,
      pullCursor: null,
      nextSyncAt: null,
      catalogUpdatedAt: null,
    };
  }

  return {
    lastPushAt: (row.last_push_at as string | null) ?? null,
    lastPullAt: (row.last_pull_at as string | null) ?? null,
    lastSuccessAt: (row.last_success_at as string | null) ?? null,
    lastErrorAt: (row.last_error_at as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    cloudAvailable: Number(row.cloud_available) === 1,
    consecutiveFailures: Number(row.consecutive_failures ?? 0),
    pullCursor: (row.pull_cursor as string | null) ?? null,
    nextSyncAt: (row.next_sync_at as string | null) ?? null,
    catalogUpdatedAt: (row.catalog_updated_at as string | null) ?? null,
  };
}

export function markCloudAvailability(
  db: SqlDatabase,
  available: boolean,
  error?: string | null,
): void {
  const now = new Date().toISOString();
  if (available) {
    db.prepare(
      `UPDATE sync_state SET
        cloud_available = 1,
        consecutive_failures = 0,
        last_success_at = ?,
        last_error = NULL
       WHERE id = 1`,
    ).run(now);
  } else {
    db.prepare(
      `UPDATE sync_state SET
        cloud_available = 0,
        consecutive_failures = consecutive_failures + 1,
        last_error_at = ?,
        last_error = ?
       WHERE id = 1`,
    ).run(now, error ?? "cloud_unavailable");
  }
}

export function markCatalogPulled(
  db: SqlDatabase,
  catalogUpdatedAt: string,
  pullCursor?: string | null,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE sync_state SET
      last_pull_at = ?,
      last_success_at = ?,
      cloud_available = 1,
      consecutive_failures = 0,
      catalog_updated_at = ?,
      pull_cursor = COALESCE(?, pull_cursor),
      last_error = NULL
     WHERE id = 1`,
  ).run(now, now, catalogUpdatedAt, pullCursor ?? null);
}

/**
 * Connectivity (live probe) and local sync state are separate:
 * unreachable => always OFFLINE (never stale ONLINE_SYNCED).
 */
export function resolveSyncUiStatus(
  db: SqlDatabase,
  options: ResolveSyncUiStatusOptions = {},
): SyncUiStatus {
  const state = readSyncState(db);
  const cloudReachable =
    typeof options.cloudReachable === "boolean"
      ? options.cloudReachable
      : state.cloudAvailable;

  if (!cloudReachable) {
    return "OFFLINE";
  }

  const pending = countOutboxByStatus(db, "PENDING");
  const processing = countOutboxByStatus(db, "PROCESSING");

  if (processing > 0) {
    return "SYNCING";
  }
  if (state.lastError && state.consecutiveFailures >= 3) {
    return "ERROR";
  }
  if (pending > 0) {
    return "ONLINE_PENDING";
  }
  return "ONLINE_SYNCED";
}
