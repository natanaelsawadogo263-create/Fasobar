import "server-only";

import { randomUUID } from "node:crypto";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { getLocalDatabase } from "@/lib/local-db/database";
import type { SqlDatabase } from "@/lib/local-db/types";
import { withTransaction } from "@/lib/local-db/transaction";
import { getLocalActiveCashSession, ensureLocalImplicitAdminCashSession } from "@/lib/local-domain/cash-sessions";
import { getLocalDeviceId, moneyXof } from "@/lib/local-domain/device";
import { nextLocalNumber } from "@/lib/local-domain/numbering";
import { getLocalOrderById } from "@/lib/local-domain/orders-local";
import { calculateChange } from "@/lib/payments/constants";
import type { PaymentMethod } from "@/lib/payments/schemas";
import type { PaymentActionState, ReceiptDetail } from "@/lib/payments/types";
import { enqueueOutboxEvent } from "@/lib/sync/outbox";

export type LocalPaymentLine = {
  method: PaymentMethod;
  amountApplied: number;
  amountReceived?: number | null;
  provider?: string | null;
  notes?: string | null;
  transactionReference?: string | null;
};

function paidAmountForOrder(db: SqlDatabase, orderId: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(COALESCE(amount_applied, amount)), 0) AS total
       FROM local_payments
       WHERE order_id = ? AND status = 'CONFIRMED'`,
    )
    .get(orderId);
  return moneyXof(Number(row?.total ?? 0));
}

export function getLocalReceiptById(
  db: SqlDatabase,
  workspace: WorkspaceContext,
  receiptId: string,
): ReceiptDetail | null {
  const row = db
    .prepare(
      `SELECT * FROM local_receipts
       WHERE id = ? AND establishment_id = ?`,
    )
    .get(receiptId, workspace.establishmentId);
  if (!row) {
    return null;
  }

  if (row.payload_json) {
    try {
      return JSON.parse(String(row.payload_json)) as ReceiptDetail;
    } catch {
      // fall through
    }
  }

  const order = getLocalOrderById(db, workspace, String(row.order_id));
  if (!order) {
    return null;
  }

  return {
    id: String(row.id),
    receiptNumber: Number(String(row.local_reference).replace(/\D/g, "") || 0),
    orderId: order.id,
    orderNumber: order.orderNumber,
    issuedAt: String(row.created_at),
    subtotal: order.subtotal,
    discount: order.discountAmount,
    total: order.totalAmount,
    paid: order.totalAmount,
    change: moneyXof(Number(row.change_given ?? 0)),
    establishmentName: workspace.establishmentName,
    establishmentAddress: null,
    establishmentPhone: null,
    logoUrl: null,
    currency: "XOF",
    cashierName: (row.cashier_name as string | null) ?? workspace.ownerName,
    tableReference: order.tableReference,
    customerReference: order.customerReference,
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    payments: [],
  };
}

export function getLocalReceiptByOrderId(
  db: SqlDatabase,
  workspace: WorkspaceContext,
  orderId: string,
): ReceiptDetail | null {
  const row = db
    .prepare(
      `SELECT id FROM local_receipts WHERE order_id = ? AND establishment_id = ? LIMIT 1`,
    )
    .get(orderId, workspace.establishmentId);
  if (!row?.id) {
    return null;
  }
  return getLocalReceiptById(db, workspace, String(row.id));
}

export function recordLocalPayments(
  workspace: WorkspaceContext,
  input: {
    orderId: string;
    payments: LocalPaymentLine[];
    idempotencyKey: string;
  },
): PaymentActionState {
  if (!workspace.canOperateCashRegister) {
    throw new Error("Permission insuffisante pour encaisser.");
  }

  const hasCash = input.payments.some((p) => p.method === "CASH");
  if (hasCash) {
    ensureLocalImplicitAdminCashSession(workspace);
  }

  const db = getLocalDatabase({ skipBackup: true });
  const deviceId = getLocalDeviceId(db);

  return withTransaction(db, () => {
    const existingByKey = db
      .prepare(
        `SELECT order_id, id FROM local_payments
         WHERE establishment_id = ? AND idempotency_key = ?
         LIMIT 1`,
      )
      .get(workspace.establishmentId, input.idempotencyKey);

    if (existingByKey?.order_id) {
      const receipt = getLocalReceiptByOrderId(
        db,
        workspace,
        String(existingByKey.order_id),
      );
      return {
        success: "Cette commande est déjà payée.",
        orderId: String(existingByKey.order_id),
        receiptId: receipt?.id,
        fullyPaid: true,
        changeGiven: receipt?.change ?? 0,
      };
    }

    const order = getLocalOrderById(db, workspace, input.orderId);
    if (!order) {
      throw new Error("Commande introuvable.");
    }
    if (order.status === "CANCELLED") {
      throw new Error("Impossible d'encaisser une commande annulée.");
    }
    if (order.paymentStatus === "PAID") {
      const receipt = getLocalReceiptByOrderId(db, workspace, input.orderId);
      return {
        success: "Cette commande est déjà payée.",
        orderId: input.orderId,
        receiptId: receipt?.id,
        fullyPaid: true,
        changeGiven: 0,
      };
    }

    const alreadyPaid = paidAmountForOrder(db, input.orderId);
    const remaining = moneyXof(order.totalAmount - alreadyPaid);
    if (remaining <= 0) {
      throw new Error("Cette commande est déjà totalement payée.");
    }

    const session = getLocalActiveCashSession(db, workspace);
    const hasCashPayment = input.payments.some((p) => p.method === "CASH");
    if (hasCashPayment && !session) {
      throw new Error("Ouvrez une session de caisse pour encaisser en espèces.");
    }

    const appliedSum = moneyXof(
      input.payments.reduce((sum, p) => sum + moneyXof(p.amountApplied), 0),
    );
    if (appliedSum <= 0) {
      throw new Error("Le montant à encaisser doit être strictement positif.");
    }
    if (appliedSum > remaining) {
      throw new Error("Le montant dépasse le solde restant à payer.");
    }

    const now = new Date().toISOString();
    const paymentRows: Array<Record<string, unknown>> = [];
    let changeGivenTotal = 0;

    input.payments.forEach((payment, index) => {
      const amountApplied = moneyXof(payment.amountApplied);
      const amountReceived =
        payment.amountReceived == null
          ? amountApplied
          : moneyXof(payment.amountReceived);
      if (payment.method === "CASH" && amountReceived < amountApplied) {
        throw new Error("Le montant reçu doit couvrir le total à payer.");
      }
      const changeGiven =
        payment.method === "CASH"
          ? calculateChange(amountReceived, amountApplied)
          : 0;
      changeGivenTotal += changeGiven;

      const paymentId = randomUUID();
      const clientMutationId =
        index === 0 ? input.idempotencyKey : randomUUID();
      const idempotencyKey =
        index === 0
          ? input.idempotencyKey
          : `${input.idempotencyKey}-${index + 1}`;

      db.prepare(
        `INSERT INTO local_payments (
          id, cloud_id, client_mutation_id, organization_id, establishment_id,
          order_id, session_id, amount, method, created_at, device_id, sync_status,
          amount_applied, amount_received, change_given, status, idempotency_key, provider, notes
        ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, 'CONFIRMED', ?, ?, ?)`,
      ).run(
        paymentId,
        clientMutationId,
        workspace.organizationId,
        workspace.establishmentId,
        input.orderId,
        payment.method === "CASH" ? session?.id ?? null : session?.id ?? null,
        amountApplied,
        payment.method,
        now,
        deviceId,
        amountApplied,
        amountReceived,
        changeGiven,
        idempotencyKey,
        payment.provider ?? payment.method,
        payment.notes?.trim() || null,
      );

      paymentRows.push({
        payment_id: paymentId,
        client_mutation_id: clientMutationId,
        idempotency_key: idempotencyKey,
        method: payment.method,
        amount_applied: amountApplied,
        amount_received: amountReceived,
        change_given: changeGiven,
        provider: payment.provider ?? payment.method,
        notes: payment.notes?.trim() || null,
        session_id: payment.method === "CASH" ? session?.id ?? null : null,
        received_at: now,
        received_by: workspace.userId,
      });
    });

    const newPaid = alreadyPaid + appliedSum;
    const fullyPaid = newPaid >= order.totalAmount;
    const paymentStatus = fullyPaid
      ? "PAID"
      : newPaid > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

    db.prepare(
      `UPDATE local_orders SET
        payment_status = ?,
        status = CASE WHEN ? = 1 THEN 'READY_TO_PAY' ELSE status END,
        updated_at = ?,
        sync_status = 'PENDING',
        cash_session_id = COALESCE(cash_session_id, ?)
       WHERE id = ?`,
    ).run(
      paymentStatus,
      fullyPaid ? 1 : 0,
      now,
      session?.id ?? null,
      input.orderId,
    );

    let receiptId: string | undefined;
    let receiptPayload: ReceiptDetail | null = null;

    if (fullyPaid) {
      receiptId = randomUUID();
      const receiptMutationId = randomUUID();
      const localReference = nextLocalNumber(db, "receipts", "LOCAL-RECU");
      const receiptNumber = Number(localReference.replace(/\D/g, "") || 0);
      receiptPayload = {
        id: receiptId,
        receiptNumber,
        orderId: order.id,
        orderNumber: order.orderNumber,
        issuedAt: now,
        subtotal: order.subtotal,
        discount: order.discountAmount,
        total: order.totalAmount,
        paid: newPaid,
        change: changeGivenTotal,
        establishmentName: workspace.establishmentName,
        establishmentAddress: null,
        establishmentPhone: null,
        logoUrl: null,
        currency: "XOF",
        cashierName: workspace.ownerName,
        tableReference: order.tableReference,
        customerReference: order.customerReference,
        items: order.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        payments: paymentRows.map((p) => ({
          method: String(p.method) as PaymentMethod,
          amountApplied: Number(p.amount_applied),
          changeGiven: Number(p.change_given),
        })),
      };

      db.prepare(
        `INSERT INTO local_receipts (
          id, cloud_id, client_mutation_id, organization_id, establishment_id,
          order_id, local_reference, cloud_reference, created_at, sync_status,
          payload_json, change_given, total_amount, cashier_name
        ) VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, ?, 'PENDING', ?, ?, ?, ?)`,
      ).run(
        receiptId,
        receiptMutationId,
        workspace.organizationId,
        workspace.establishmentId,
        input.orderId,
        localReference,
        now,
        JSON.stringify(receiptPayload),
        changeGivenTotal,
        order.totalAmount,
        workspace.ownerName,
      );
    }

    const orderRow = db
      .prepare(`SELECT client_mutation_id, cash_session_id FROM local_orders WHERE id = ?`)
      .get(input.orderId);

    enqueueOutboxEvent(db, {
      clientMutationId: input.idempotencyKey,
      organizationId: workspace.organizationId,
      establishmentId: workspace.establishmentId,
      deviceId,
      aggregateType: "payment",
      aggregateId: input.orderId,
      eventType: "PAYMENT_RECORDED",
      payload: {
        order_id: input.orderId,
        order_client_mutation_id: orderRow?.client_mutation_id
          ? String(orderRow.client_mutation_id)
          : null,
        cash_session_id: session?.id ?? orderRow?.cash_session_id ?? null,
        organization_id: workspace.organizationId,
        establishment_id: workspace.establishmentId,
        received_by: workspace.userId,
        payments: paymentRows,
        fully_paid: fullyPaid,
        payment_status: paymentStatus,
        receipt: receiptPayload
          ? {
              receipt_id: receiptPayload.id,
              local_reference: receiptPayload.receiptNumber,
              issued_at: receiptPayload.issuedAt,
              subtotal: receiptPayload.subtotal,
              discount: receiptPayload.discount,
              total: receiptPayload.total,
              paid: receiptPayload.paid,
              change: receiptPayload.change,
              establishment_name: receiptPayload.establishmentName,
              cashier_name: receiptPayload.cashierName,
              currency: "XOF",
            }
          : null,
      },
    });

    return {
      success: fullyPaid
        ? "Commande entièrement encaissée."
        : "Paiement enregistré.",
      orderId: input.orderId,
      receiptId,
      fullyPaid,
      changeGiven: changeGivenTotal,
    };
  });
}
