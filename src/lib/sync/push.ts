import "server-only";

import { appendDesktopLog } from "@/lib/desktop/logger";
import { probeSupabaseReachable } from "@/lib/desktop/cloud-reachability";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import { getLocalDatabase } from "@/lib/local-db/database";
import {
  listPendingOutboxEvents,
  markAggregateSynced,
  markOutboxFailed,
  markOutboxProcessing,
  markOutboxSynced,
} from "@/lib/sync/outbox";
import { markCloudAvailability } from "@/lib/sync/status";
import { createClient } from "@/lib/supabase/server";

export type PushOutboxResult = {
  attempted: number;
  synced: number;
  failed: number;
  skipped: boolean;
  reason?: string;
};

let pushInFlight: Promise<PushOutboxResult> | null = null;

/**
 * Push PENDING/FAILED outbox rows to Supabase (idempotent RPC).
 * Never deletes local sales on failure.
 */
export async function pushLocalOutboxToCloud(
  options: { limit?: number } = {},
): Promise<PushOutboxResult> {
  if (!isDesktopServerRuntime()) {
    return {
      attempted: 0,
      synced: 0,
      failed: 0,
      skipped: true,
      reason: "not_desktop",
    };
  }

  const reachable = await probeSupabaseReachable({ bypassCache: true });
  const db = getLocalDatabase({ skipBackup: true });

  if (!reachable) {
    markCloudAvailability(db, false, "cloud_unreachable");
    return {
      attempted: 0,
      synced: 0,
      failed: 0,
      skipped: true,
      reason: "offline",
    };
  }

  markCloudAvailability(db, true);

  const events = listPendingOutboxEvents(db, options.limit ?? 40);
  if (events.length === 0) {
    return { attempted: 0, synced: 0, failed: 0, skipped: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      attempted: 0,
      synced: 0,
      failed: 0,
      skipped: true,
      reason: "no_cloud_session",
    };
  }

  let synced = 0;
  let failed = 0;

  for (const event of events) {
    markOutboxProcessing(db, event.id);

    const { data, error } = await supabase.rpc("apply_desktop_outbox_event", {
      p_event_type: event.eventType,
      p_client_mutation_id: event.clientMutationId,
      p_payload: event.payload,
    });

    if (error) {
      failed += 1;
      markOutboxFailed(db, event.id, error.message);
      appendDesktopLog("sync-push", "warn", "Outbox event failed", {
        eventType: event.eventType,
        clientMutationId: event.clientMutationId,
        error: error.message,
      });
      continue;
    }

    const result = (data ?? {}) as {
      ok?: boolean;
      cloud_id?: string;
      duplicate?: boolean;
    };

    markOutboxSynced(db, event.id);
    markAggregateSynced(
      db,
      event.aggregateType,
      event.aggregateId,
      result.cloud_id ?? null,
    );
    synced += 1;
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE sync_state SET last_push_at = ?, last_success_at = CASE WHEN ? > 0 THEN ? ELSE last_success_at END WHERE id = 1`,
  ).run(now, synced, now);

  appendDesktopLog("sync-push", "info", "Outbox push complete", {
    attempted: events.length,
    synced,
    failed,
  });

  return {
    attempted: events.length,
    synced,
    failed,
    skipped: false,
  };
}

/** Deduped background push — safe to call after every local mutation. */
export function scheduleOutboxPush(): void {
  if (!isDesktopServerRuntime()) {
    return;
  }
  if (pushInFlight) {
    return;
  }
  pushInFlight = pushLocalOutboxToCloud()
    .catch((error) => {
      appendDesktopLog("sync-push", "error", "Outbox push crashed", {
        error: String(error),
      });
      return {
        attempted: 0,
        synced: 0,
        failed: 0,
        skipped: true,
        reason: "crash",
      } satisfies PushOutboxResult;
    })
    .finally(() => {
      pushInFlight = null;
    });
}
