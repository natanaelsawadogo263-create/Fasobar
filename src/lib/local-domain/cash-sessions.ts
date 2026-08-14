import "server-only";

import { randomUUID } from "node:crypto";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { isHardwareAdminDirectSeller } from "@/lib/hardware/activity";
import { getLocalDatabase } from "@/lib/local-db/database";
import type { SqlDatabase } from "@/lib/local-db/types";
import { getLocalDeviceId, moneyXof } from "@/lib/local-domain/device";
import { enqueueOutboxEvent } from "@/lib/sync/outbox";
import { withTransaction } from "@/lib/local-db/transaction";
import type { CashSessionDetail } from "@/lib/payments/types";

function mapSessionRow(
  row: Record<string, unknown>,
  cashCollected: number,
  openedByName: string | null,
): CashSessionDetail {
  return {
    id: String(row.id),
    status: String(row.status),
    openingCashAmount: moneyXof(Number(row.opening_float ?? 0)),
    expectedCashAmount: moneyXof(
      Number(row.expected_cash ?? row.opening_float ?? 0),
    ),
    countedCashAmount:
      row.counted_cash == null ? null : moneyXof(Number(row.counted_cash)),
    cashDifference:
      row.cash_difference == null
        ? null
        : moneyXof(Number(row.cash_difference)),
    openingNote: (row.opening_note as string | null) ?? null,
    closingNote: (row.closing_note as string | null) ?? null,
    openedAt: String(row.opened_at),
    closedAt: (row.closed_at as string | null) ?? null,
    openedByName,
    cashCollected,
  };
}

function sessionCashCollected(db: SqlDatabase, sessionId: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(COALESCE(amount_applied, amount)), 0) AS total
       FROM local_payments
       WHERE session_id = ?
         AND method = 'CASH'
         AND status = 'CONFIRMED'`,
    )
    .get(sessionId);
  return moneyXof(Number(row?.total ?? 0));
}

export function getLocalActiveCashSession(
  db: SqlDatabase,
  workspace: WorkspaceContext,
): CashSessionDetail | null {
  const row = db
    .prepare(
      `SELECT * FROM local_cash_register_sessions
       WHERE establishment_id = ?
         AND opened_by = ?
         AND status = 'OPEN'
       LIMIT 1`,
    )
    .get(workspace.establishmentId, workspace.userId);

  if (!row) {
    return null;
  }

  return mapSessionRow(
    row,
    sessionCashCollected(db, String(row.id)),
    workspace.ownerName,
  );
}

export function openLocalCashSession(
  workspace: WorkspaceContext,
  input: { openingCashAmount: number; openingNote?: string | null },
): { sessionId: string; clientMutationId: string } {
  if (!workspace.canOperateCashRegister) {
    throw new Error("Permission insuffisante pour ouvrir une caisse.");
  }

  const db = getLocalDatabase({ skipBackup: true });
  const existing = getLocalActiveCashSession(db, workspace);
  if (existing) {
    throw new Error("Une session de caisse est déjà ouverte.");
  }

  const sessionId = randomUUID();
  const clientMutationId = randomUUID();
  const deviceId = getLocalDeviceId(db);
  const now = new Date().toISOString();
  const opening = moneyXof(input.openingCashAmount);

  withTransaction(db, () => {
    db.prepare(
      `INSERT INTO local_cash_register_sessions (
        id, cloud_id, client_mutation_id, organization_id, establishment_id,
        opened_by, opened_at, closed_at, opening_float, status, device_id, sync_status,
        opening_note, expected_cash
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, ?, 'OPEN', ?, 'PENDING', ?, ?)`,
    ).run(
      sessionId,
      clientMutationId,
      workspace.organizationId,
      workspace.establishmentId,
      workspace.userId,
      now,
      opening,
      deviceId,
      input.openingNote?.trim() || null,
      opening,
    );

    enqueueOutboxEvent(db, {
      clientMutationId,
      organizationId: workspace.organizationId,
      establishmentId: workspace.establishmentId,
      deviceId,
      aggregateType: "cash_register_session",
      aggregateId: sessionId,
      eventType: "CASH_SESSION_OPENED",
      payload: {
        session_id: sessionId,
        client_mutation_id: clientMutationId,
        organization_id: workspace.organizationId,
        establishment_id: workspace.establishmentId,
        opened_by: workspace.userId,
        opened_at: now,
        opening_cash_amount: opening,
        opening_note: input.openingNote?.trim() || null,
        device_id: deviceId,
      },
    });
  });

  return { sessionId, clientMutationId };
}

/** Session silencieuse (fond 0) pour que l’admin puisse encaisser sans écran d’ouverture. */
export function ensureLocalImplicitAdminCashSession(
  workspace: WorkspaceContext,
): CashSessionDetail | null {
  if (!isHardwareAdminDirectSeller(workspace)) {
    return getLocalActiveCashSession(
      getLocalDatabase({ skipBackup: true }),
      workspace,
    );
  }

  const db = getLocalDatabase({ skipBackup: true });
  const existing = getLocalActiveCashSession(db, workspace);
  if (existing) return existing;

  try {
    openLocalCashSession(workspace, {
      openingCashAmount: 0,
      openingNote: "Vente admin",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.toLowerCase().includes("déjà ouverte")) {
      throw error;
    }
  }

  return getLocalActiveCashSession(
    getLocalDatabase({ skipBackup: true }),
    workspace,
  );
}

export function closeLocalCashSession(
  workspace: WorkspaceContext,
  input: {
    sessionId: string;
    countedCashAmount: number;
    closingNote?: string | null;
  },
): { sessionId: string; clientMutationId: string; cashDifference: number } {
  if (!workspace.canOperateCashRegister) {
    throw new Error("Permission insuffisante pour fermer une caisse.");
  }

  const db = getLocalDatabase({ skipBackup: true });
  const row = db
    .prepare(
      `SELECT * FROM local_cash_register_sessions
       WHERE id = ? AND establishment_id = ?`,
    )
    .get(input.sessionId, workspace.establishmentId);

  if (!row) {
    throw new Error("Session de caisse introuvable.");
  }
  if (String(row.opened_by) !== workspace.userId) {
    throw new Error("Vous ne pouvez fermer que votre propre session de caisse.");
  }
  if (String(row.status) !== "OPEN") {
    throw new Error("Cette session de caisse est déjà fermée.");
  }

  const cashCollected = sessionCashCollected(db, input.sessionId);
  const opening = moneyXof(Number(row.opening_float ?? 0));
  const expected = opening + cashCollected;
  const counted = moneyXof(input.countedCashAmount);
  const difference = counted - expected;
  const clientMutationId = randomUUID();
  const deviceId = getLocalDeviceId(db);
  const now = new Date().toISOString();

  withTransaction(db, () => {
    db.prepare(
      `UPDATE local_cash_register_sessions SET
        status = 'CLOSED',
        closed_at = ?,
        closed_by = ?,
        expected_cash = ?,
        counted_cash = ?,
        cash_difference = ?,
        closing_note = ?,
        sync_status = 'PENDING'
       WHERE id = ?`,
    ).run(
      now,
      workspace.userId,
      expected,
      counted,
      difference,
      input.closingNote?.trim() || null,
      input.sessionId,
    );

    enqueueOutboxEvent(db, {
      clientMutationId,
      organizationId: workspace.organizationId,
      establishmentId: workspace.establishmentId,
      deviceId,
      aggregateType: "cash_register_session",
      aggregateId: input.sessionId,
      eventType: "CASH_SESSION_CLOSED",
      payload: {
        session_id: input.sessionId,
        client_mutation_id: clientMutationId,
        organization_id: workspace.organizationId,
        establishment_id: workspace.establishmentId,
        closed_by: workspace.userId,
        closed_at: now,
        counted_cash_amount: counted,
        expected_cash_amount: expected,
        cash_difference: difference,
        closing_note: input.closingNote?.trim() || null,
        open_client_mutation_id: String(row.client_mutation_id),
      },
    });
  });

  return {
    sessionId: input.sessionId,
    clientMutationId,
    cashDifference: difference,
  };
}
