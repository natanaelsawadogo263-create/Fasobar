import "server-only";

import { randomUUID } from "node:crypto";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { getLocalDatabase } from "@/lib/local-db/database";
import type { SqlDatabase } from "@/lib/local-db/types";
import { withTransaction } from "@/lib/local-db/transaction";
import { getLocalDeviceId, moneyXof } from "@/lib/local-domain/device";
import { nextLocalNumber } from "@/lib/local-domain/numbering";
import type {
  OpenOrderListItem,
  OrderDetail,
  OrderLineItem,
} from "@/lib/orders/types";
import type { OrderStatus, OrderType } from "@/lib/orders/schemas";
import { snapshotSaleLine } from "@/lib/catalog/sale-stock";
import { enqueueOutboxEvent } from "@/lib/sync/outbox";

export type SaveLocalOrderInput = {
  orderId?: string;
  targetStatus: OrderStatus;
  orderType: OrderType;
  tableReference?: string | null;
  customerReference?: string | null;
  notes?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
    notes?: string | null;
    departmentCode?: string;
    unitPrice?: number;
    productName?: string;
    saleUnitId?: string | null;
    stockFactor?: number;
  }>;
  cashSessionId?: string | null;
};

function parseLocalSeq(localOrderNumber: string): number {
  const match = localOrderNumber.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function loadItems(db: SqlDatabase, orderId: string): OrderLineItem[] {
  return db
    .prepare(
      `SELECT * FROM local_order_items WHERE order_id = ? ORDER BY rowid`,
    )
    .all(orderId)
    .map((row) => ({
      id: String(row.id),
      productId: String(row.product_id),
      productName: String(row.product_name_snapshot),
      unitPrice: moneyXof(Number(row.unit_price_snapshot)),
      quantity: Number(row.quantity),
      lineTotal: moneyXof(Number(row.line_total)),
      departmentCode: String(row.department_code),
      departmentName: String(row.department_code),
      notes: (row.notes as string | null) ?? null,
      saleUnitId: (row.unit_level_id as string | null) ?? null,
      saleUnitName: (row.sale_unit_name as string | null) ?? null,
      saleUnitFactor: row.sale_unit_factor == null ? null : Number(row.sale_unit_factor),
      stockQuantity: row.stock_quantity == null ? null : Number(row.stock_quantity),
    }));
}

function mapOrderDetail(
  row: Record<string, unknown>,
  items: OrderLineItem[],
  createdByName: string | null,
): OrderDetail {
  const localSeq = Number(row.local_seq ?? parseLocalSeq(String(row.local_order_number)));
  return {
    id: String(row.id),
    orderNumber: Number(row.cloud_order_number ?? localSeq),
    tableReference: (row.table_reference as string | null) ?? null,
    customerReference: (row.customer_reference as string | null) ?? null,
    orderType: (String(row.order_type ?? "ON_SITE") as OrderType),
    status: String(row.status) as OrderStatus,
    paymentStatus: String(row.payment_status ?? "UNPAID"),
    barStatus: null,
    kitchenStatus: null,
    subtotal: moneyXof(Number(row.subtotal ?? 0)),
    discountAmount: moneyXof(Number(row.discount_amount ?? 0)),
    totalAmount: moneyXof(Number(row.total_amount ?? 0)),
    notes: (row.notes as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    cancelledAt: null,
    cancellationReason: null,
    createdByName,
    items,
  };
}

function resolveProductSnapshot(
  db: SqlDatabase,
  establishmentId: string,
  item: {
    productId: string;
    departmentCode?: string;
    unitPrice?: number;
    productName?: string;
  },
): {
  name: string;
  unitPrice: number;
  departmentCode: string;
} {
  const product = db
    .prepare(
      `SELECT name, selling_price, department_code, active
       FROM local_products
       WHERE id = ? AND establishment_id = ?`,
    )
    .get(item.productId, establishmentId);

  if (!product || Number(product.active) !== 1) {
    throw new Error("Produit introuvable ou inactif.");
  }

  return {
    name: item.productName?.trim() || String(product.name),
    unitPrice: moneyXof(item.unitPrice ?? Number(product.selling_price)),
    departmentCode: String(product.department_code || item.departmentCode || "BAR"),
  };
}

function buildOrderPayload(
  orderRow: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
) {
  return {
    order_id: String(orderRow.id),
    client_mutation_id: String(orderRow.client_mutation_id),
    organization_id: String(orderRow.organization_id),
    establishment_id: String(orderRow.establishment_id),
    created_by: String(orderRow.created_by),
    order_type: String(orderRow.order_type ?? "ON_SITE"),
    status: String(orderRow.status),
    payment_status: String(orderRow.payment_status ?? "UNPAID"),
    table_reference: orderRow.table_reference ?? null,
    customer_reference: orderRow.customer_reference ?? null,
    notes: orderRow.notes ?? null,
    subtotal: moneyXof(Number(orderRow.subtotal ?? 0)),
    discount_amount: moneyXof(Number(orderRow.discount_amount ?? 0)),
    total_amount: moneyXof(Number(orderRow.total_amount ?? 0)),
    created_at: String(orderRow.created_at),
    updated_at: String(orderRow.updated_at),
    cash_session_id: orderRow.cash_session_id ?? null,
    local_order_number: String(orderRow.local_order_number),
    device_id: String(orderRow.device_id),
    items: items.map((item) => ({
      id: String(item.id),
      product_id: String(item.product_id),
      product_name_snapshot: String(item.product_name_snapshot),
      unit_price_snapshot: moneyXof(Number(item.unit_price_snapshot)),
      quantity: Number(item.quantity),
      prepared_quantity: Number(item.prepared_quantity ?? 0),
      line_total: moneyXof(Number(item.line_total)),
      department_code: String(item.department_code),
      notes: item.notes ?? null,
    })),
  };
}

function upsertPendingOrderOutbox(
  db: SqlDatabase,
  orderId: string,
  payload: Record<string, unknown>,
  meta: {
    clientMutationId: string;
    organizationId: string;
    establishmentId: string;
    deviceId: string;
  },
) {
  const pending = db
    .prepare(
      `SELECT id FROM sync_outbox
       WHERE aggregate_type = 'order'
         AND aggregate_id = ?
         AND event_type = 'ORDER_CREATED'
         AND status = 'PENDING'
       LIMIT 1`,
    )
    .get(orderId);

  if (pending?.id) {
    db.prepare(
      `UPDATE sync_outbox SET payload_json = ? WHERE id = ?`,
    ).run(JSON.stringify(payload), String(pending.id));
    return;
  }

  enqueueOutboxEvent(db, {
    clientMutationId: meta.clientMutationId,
    organizationId: meta.organizationId,
    establishmentId: meta.establishmentId,
    deviceId: meta.deviceId,
    aggregateType: "order",
    aggregateId: orderId,
    eventType: "ORDER_CREATED",
    payload,
  });
}

export function getLocalOrderById(
  db: SqlDatabase,
  workspace: WorkspaceContext,
  orderId: string,
): OrderDetail | null {
  const row = db
    .prepare(
      `SELECT * FROM local_orders
       WHERE id = ? AND establishment_id = ?`,
    )
    .get(orderId, workspace.establishmentId);
  if (!row) {
    return null;
  }
  return mapOrderDetail(row, loadItems(db, orderId), workspace.ownerName);
}

export function listLocalCashierOrders(
  db: SqlDatabase,
  workspace: WorkspaceContext,
  options: {
    includeFinalized?: boolean;
    sessionOpenedAt?: string | null;
  } = {},
): OpenOrderListItem[] {
  const includeFinalized = options.includeFinalized ?? true;
  const dayStart =
    options.sessionOpenedAt ??
    new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
      ),
    ).toISOString();

  const active = db
    .prepare(
      `SELECT o.*,
        (SELECT COUNT(*) FROM local_order_items i WHERE i.order_id = o.id) AS item_count,
        (SELECT r.id FROM local_receipts r WHERE r.order_id = o.id LIMIT 1) AS receipt_id
       FROM local_orders o
       WHERE o.establishment_id = ?
         AND o.status IN ('OPEN', 'READY_TO_PAY', 'DRAFT')
         AND o.payment_status <> 'PAID'
       ORDER BY o.created_at DESC`,
    )
    .all(workspace.establishmentId);

  const finalized = includeFinalized
    ? db
        .prepare(
          `SELECT o.*,
            (SELECT COUNT(*) FROM local_order_items i WHERE i.order_id = o.id) AS item_count,
            (SELECT r.id FROM local_receipts r WHERE r.order_id = o.id LIMIT 1) AS receipt_id
           FROM local_orders o
           WHERE o.establishment_id = ?
             AND o.payment_status = 'PAID'
             AND o.created_at >= ?
           ORDER BY o.created_at DESC`,
        )
        .all(workspace.establishmentId, dayStart)
    : [];

  const seen = new Set<string>();
  const rows = [...active, ...finalized].filter((row) => {
    const id = String(row.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return rows.map((row) => {
    const localSeq = Number(
      row.local_seq ?? parseLocalSeq(String(row.local_order_number)),
    );
    return {
      id: String(row.id),
      orderNumber: Number(row.cloud_order_number ?? localSeq),
      tableReference: (row.table_reference as string | null) ?? null,
      customerReference: (row.customer_reference as string | null) ?? null,
      status: String(row.status) as OrderStatus,
      paymentStatus: String(row.payment_status ?? "UNPAID") as
        | "UNPAID"
        | "PARTIALLY_PAID"
        | "PAID",
      barStatus: null,
      kitchenStatus: null,
      totalAmount: moneyXof(Number(row.total_amount ?? 0)),
      itemCount: Number(row.item_count ?? 0),
      createdAt: String(row.created_at),
      createdByName: workspace.ownerName,
      receiptId: (row.receipt_id as string | null) ?? null,
    };
  });
}

export function saveLocalOrder(
  workspace: WorkspaceContext,
  input: SaveLocalOrderInput,
): { orderId: string } {
  if (!workspace.canOperateCashRegister && !workspace.canManageOrders) {
    throw new Error("Permission insuffisante pour gérer une commande.");
  }

  if (
    (input.targetStatus === "OPEN" || input.targetStatus === "READY_TO_PAY") &&
    input.items.length === 0
  ) {
    throw new Error("Ajoutez au moins un article à la commande.");
  }

  const db = getLocalDatabase({ skipBackup: true });
  const deviceId = getLocalDeviceId(db);
  const now = new Date().toISOString();

  return withTransaction(db, () => {
    let orderId = input.orderId?.trim() || "";
    let clientMutationId: string = randomUUID();
    let isNew = false;

    if (orderId) {
      const existing = db
        .prepare(
          `SELECT * FROM local_orders WHERE id = ? AND establishment_id = ?`,
        )
        .get(orderId, workspace.establishmentId);
      if (!existing) {
        throw new Error("Commande introuvable.");
      }
      if (String(existing.payment_status) === "PAID") {
        throw new Error("Cette commande est payée et ne peut plus être modifiée.");
      }
      if (String(existing.status) === "CANCELLED") {
        throw new Error("Cette commande est annulée.");
      }
      clientMutationId = String(existing.client_mutation_id);
    } else {
      isNew = true;
      orderId = randomUUID();
      const localOrderNumber = nextLocalNumber(db, "orders", "LOCAL-CAISSE");
      const localSeq = parseLocalSeq(localOrderNumber);

      db.prepare(
        `INSERT INTO local_orders (
          id, cloud_id, client_mutation_id, organization_id, establishment_id,
          local_order_number, cloud_order_number, status, table_reference, customer_reference,
          subtotal, discount_amount, total_amount, created_by, device_id, created_at, updated_at,
          sync_status, order_type, payment_status, notes, cash_session_id, local_seq
        ) VALUES (?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, 'PENDING', ?, 'UNPAID', ?, ?, ?)`,
      ).run(
        orderId,
        clientMutationId,
        workspace.organizationId,
        workspace.establishmentId,
        localOrderNumber,
        input.targetStatus,
        input.tableReference?.trim() || null,
        input.customerReference?.trim() || null,
        workspace.userId,
        deviceId,
        now,
        now,
        input.orderType,
        input.notes?.trim() || null,
        input.cashSessionId ?? null,
        localSeq,
      );
    }

    const lineRows: Array<Record<string, unknown>> = [];
    let subtotal = 0;

    const preparedByLine = new Map<string, number>();
    for (const row of db
      .prepare(
        `SELECT product_id, unit_level_id, prepared_quantity FROM local_order_items WHERE order_id = ?`,
      )
      .all(orderId)) {
      preparedByLine.set(
        `${row.product_id}::${row.unit_level_id ?? ""}`,
        Number(row.prepared_quantity ?? 0),
      );
    }

    db.prepare(`DELETE FROM local_order_items WHERE order_id = ?`).run(orderId);

    for (const item of input.items) {
      const snap = resolveProductSnapshot(db, workspace.establishmentId, item);
      const quantity = Number(item.quantity);
      if (!(quantity > 0)) {
        throw new Error("Quantité invalide.");
      }
      const saleSnap = snapshotSaleLine({
        productId: item.productId,
        saleUnitId: item.saleUnitId,
        saleUnitName: snap.name,
        unitPrice: snap.unitPrice,
        quantity,
        conversionFactor: item.stockFactor ?? 1,
      });
      const lineTotal = moneyXof(snap.unitPrice * quantity);
      subtotal += lineTotal;
      const lineId = randomUUID();
      const preparedQuantity = Math.min(
        quantity,
        preparedByLine.get(`${item.productId}::${item.saleUnitId ?? ""}`) ?? 0,
      );
      db.prepare(
        `INSERT INTO local_order_items (
          id, order_id, product_id, product_name_snapshot, unit_price_snapshot,
          quantity, prepared_quantity, line_total, department_code, notes,
          unit_level_id, sale_unit_name, sale_unit_factor, stock_quantity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        lineId,
        orderId,
        item.productId,
        snap.name,
        snap.unitPrice,
        quantity,
        preparedQuantity,
        lineTotal,
        snap.departmentCode,
        item.notes?.trim() || null,
        item.saleUnitId ?? null,
        saleSnap.saleUnitName,
        saleSnap.conversionFactor,
        saleSnap.stockQuantity,
      );
      lineRows.push({
        id: lineId,
        product_id: item.productId,
        product_name_snapshot: snap.name,
        unit_price_snapshot: snap.unitPrice,
        quantity,
        prepared_quantity: preparedQuantity,
        line_total: lineTotal,
        department_code: snap.departmentCode,
        notes: item.notes?.trim() || null,
        unit_level_id: item.saleUnitId ?? null,
        sale_unit_name: saleSnap.saleUnitName,
        sale_unit_factor: saleSnap.conversionFactor,
        stock_quantity: saleSnap.stockQuantity,
      });
    }

    const discount = 0;
    const total = moneyXof(subtotal - discount);

    db.prepare(
      `UPDATE local_orders SET
        status = ?,
        order_type = ?,
        table_reference = ?,
        customer_reference = ?,
        notes = ?,
        subtotal = ?,
        discount_amount = ?,
        total_amount = ?,
        cash_session_id = COALESCE(?, cash_session_id),
        updated_at = ?,
        sync_status = 'PENDING'
       WHERE id = ?`,
    ).run(
      input.targetStatus,
      input.orderType,
      input.tableReference?.trim() || null,
      input.customerReference?.trim() || null,
      input.notes?.trim() || null,
      subtotal,
      discount,
      total,
      input.cashSessionId ?? null,
      now,
      orderId,
    );

    const orderRow = db
      .prepare(`SELECT * FROM local_orders WHERE id = ?`)
      .get(orderId);
    if (!orderRow) {
      throw new Error("Commande introuvable après enregistrement.");
    }

    const payload = buildOrderPayload(orderRow, lineRows);
    if (isNew) {
      upsertPendingOrderOutbox(db, orderId, payload, {
        clientMutationId,
        organizationId: workspace.organizationId,
        establishmentId: workspace.establishmentId,
        deviceId,
      });
    } else {
      // Keep a single ORDER_CREATED pending payload up to date before first sync.
      upsertPendingOrderOutbox(db, orderId, payload, {
        clientMutationId: randomUUID(),
        organizationId: workspace.organizationId,
        establishmentId: workspace.establishmentId,
        deviceId,
      });
    }

    return { orderId };
  });
}
