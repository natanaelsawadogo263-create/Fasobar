import "server-only";

import { randomUUID } from "node:crypto";

import type { SqlDatabase } from "@/lib/local-db/types";
import { withTransaction } from "@/lib/local-db/transaction";

export type OutboxEventInput = {
  clientMutationId: string;
  organizationId: string;
  establishmentId: string;
  deviceId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export type OutboxRow = {
  id: string;
  clientMutationId: string;
  organizationId: string;
  establishmentId: string;
  deviceId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: string;
  attempts: number;
};

export function enqueueOutboxEvent(
  db: SqlDatabase,
  input: OutboxEventInput,
): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO sync_outbox (
      id, client_mutation_id, organization_id, establishment_id, device_id,
      aggregate_type, aggregate_id, event_type, payload_json, created_at, status, attempts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0)`,
  ).run(
    id,
    input.clientMutationId,
    input.organizationId,
    input.establishmentId,
    input.deviceId,
    input.aggregateType,
    input.aggregateId,
    input.eventType,
    JSON.stringify(input.payload),
    now,
  );
  return id;
}

/**
 * Write domain row + outbox event in one SQLite transaction.
 */
export function writeWithOutbox<T>(
  db: SqlDatabase,
  write: () => T,
  outbox: OutboxEventInput,
): { result: T; outboxId: string } {
  return withTransaction(db, () => {
    const result = write();
    const outboxId = enqueueOutboxEvent(db, outbox);
    return { result, outboxId };
  });
}

export function countOutboxByStatus(
  db: SqlDatabase,
  status: string,
): number {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM sync_outbox WHERE status = ?")
    .get(status);
  return Number(row?.c ?? 0);
}

export function listPendingOutboxEvents(
  db: SqlDatabase,
  limit = 50,
): OutboxRow[] {
  const now = new Date().toISOString();
  return db
    .prepare(
      `SELECT * FROM sync_outbox
       WHERE status IN ('PENDING', 'FAILED')
         AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY created_at ASC
       LIMIT ?`,
    )
    .all(now, limit)
    .map((row) => ({
      id: String(row.id),
      clientMutationId: String(row.client_mutation_id),
      organizationId: String(row.organization_id),
      establishmentId: String(row.establishment_id),
      deviceId: String(row.device_id),
      aggregateType: String(row.aggregate_type),
      aggregateId: String(row.aggregate_id),
      eventType: String(row.event_type),
      payload: JSON.parse(String(row.payload_json || "{}")) as Record<
        string,
        unknown
      >,
      createdAt: String(row.created_at),
      status: String(row.status),
      attempts: Number(row.attempts ?? 0),
    }));
}

export function markOutboxProcessing(db: SqlDatabase, id: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE sync_outbox SET
      status = 'PROCESSING',
      attempts = attempts + 1,
      last_attempt_at = ?
     WHERE id = ?`,
  ).run(now, id);
}

export function markOutboxSynced(db: SqlDatabase, id: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE sync_outbox SET
      status = 'SYNCED',
      synced_at = ?,
      last_error = NULL,
      next_retry_at = NULL
     WHERE id = ?`,
  ).run(now, id);
}

export function markOutboxFailed(
  db: SqlDatabase,
  id: string,
  error: string,
  retryDelayMs = 15_000,
): void {
  const now = new Date().toISOString();
  const next = new Date(Date.now() + retryDelayMs).toISOString();
  db.prepare(
    `UPDATE sync_outbox SET
      status = 'FAILED',
      last_error = ?,
      last_attempt_at = ?,
      next_retry_at = ?
     WHERE id = ?`,
  ).run(error.slice(0, 500), now, next, id);
}

export function markAggregateSynced(
  db: SqlDatabase,
  aggregateType: string,
  aggregateId: string,
  cloudId?: string | null,
): void {
  if (aggregateType === "order") {
    db.prepare(
      `UPDATE local_orders SET sync_status = 'SYNCED', cloud_id = COALESCE(?, cloud_id, id)
       WHERE id = ?`,
    ).run(cloudId ?? null, aggregateId);
  } else if (aggregateType === "cash_register_session") {
    db.prepare(
      `UPDATE local_cash_register_sessions
       SET sync_status = 'SYNCED', cloud_id = COALESCE(?, cloud_id, id)
       WHERE id = ?`,
    ).run(cloudId ?? null, aggregateId);
  } else if (aggregateType === "payment") {
    db.prepare(
      `UPDATE local_payments SET sync_status = 'SYNCED', cloud_id = COALESCE(cloud_id, id)
       WHERE order_id = ?`,
    ).run(aggregateId);
    db.prepare(
      `UPDATE local_receipts SET sync_status = 'SYNCED', cloud_id = COALESCE(cloud_id, id)
       WHERE order_id = ?`,
    ).run(aggregateId);
    db.prepare(
      `UPDATE local_orders SET sync_status = 'SYNCED', cloud_id = COALESCE(cloud_id, id)
       WHERE id = ?`,
    ).run(aggregateId);
  }
}
