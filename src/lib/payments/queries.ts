import "server-only";

import { cache } from "react";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { getOrderById } from "@/lib/orders/queries";
import type {
  CashSessionDetail,
  OrderAddition,
  OrderPaymentSummary,
  ReceiptDetail,
} from "@/lib/payments/types";
import type { PaymentMethod } from "@/lib/payments/schemas";
import { ORDER_TYPE_LABELS } from "@/lib/orders/constants";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Métadonnées session pour le shell (sans agrégation des encaissements). */
export async function getOwnOpenCashSessionMeta(
  workspace: WorkspaceContext,
): Promise<{ openedAt: string } | null> {
  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    const { getLocalDatabase } = await import("@/lib/local-db/database");
    const { getLocalActiveCashSession } = await import(
      "@/lib/local-domain/cash-sessions"
    );
    const session = getLocalActiveCashSession(
      getLocalDatabase({ skipBackup: true }),
      workspace,
    );
    return session ? { openedAt: session.openedAt } : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cash_register_sessions")
    .select("opened_at")
    .eq("establishment_id", workspace.establishmentId)
    .eq("opened_by", workspace.userId)
    .eq("status", "OPEN")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return { openedAt: data.opened_at };
}

export const getActiveCashSession = cache(async function getActiveCashSession(
  workspace: WorkspaceContext,
): Promise<CashSessionDetail | null> {
  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    const { getLocalDatabase } = await import("@/lib/local-db/database");
    const { getLocalActiveCashSession } = await import(
      "@/lib/local-domain/cash-sessions"
    );
    return getLocalActiveCashSession(
      getLocalDatabase({ skipBackup: true }),
      workspace,
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cash_register_sessions")
    .select(
      "id, status, opening_cash_amount, expected_cash_amount, counted_cash_amount, cash_difference, opening_note, closing_note, opened_at, closed_at, profiles!cash_register_sessions_opened_by_fkey(full_name)",
    )
    .eq("establishment_id", workspace.establishmentId)
    .eq("opened_by", workspace.userId)
    .eq("status", "OPEN")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const profile = readSingle(
    data.profiles as { full_name: string } | { full_name: string }[] | null,
  );

  const { data: cashPayments } = await supabase
    .from("payments")
    .select("amount_applied")
    .eq("cash_register_session_id", data.id)
    .eq("method", "CASH")
    .eq("status", "CONFIRMED");

  const cashCollected =
    cashPayments?.reduce((sum, row) => sum + row.amount_applied, 0) ?? 0;

  return {
    id: data.id,
    status: data.status,
    openingCashAmount: data.opening_cash_amount,
    expectedCashAmount: data.expected_cash_amount,
    countedCashAmount: data.counted_cash_amount,
    cashDifference: data.cash_difference,
    openingNote: data.opening_note,
    closingNote: data.closing_note,
    openedAt: data.opened_at,
    closedAt: data.closed_at,
    openedByName: profile?.full_name ?? workspace.ownerName,
    cashCollected,
  };
});

export async function getCashSessionById(
  workspace: WorkspaceContext,
  sessionId: string,
): Promise<CashSessionDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cash_register_sessions")
    .select(
      "id, status, opening_cash_amount, expected_cash_amount, counted_cash_amount, cash_difference, opening_note, closing_note, opened_at, closed_at, profiles!cash_register_sessions_opened_by_fkey(full_name)",
    )
    .eq("id", sessionId)
    .eq("establishment_id", workspace.establishmentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const profile = readSingle(
    data.profiles as { full_name: string } | { full_name: string }[] | null,
  );

  const { data: cashPayments } = await supabase
    .from("payments")
    .select("amount_applied")
    .eq("cash_register_session_id", data.id)
    .eq("method", "CASH")
    .eq("status", "CONFIRMED");

  const cashCollected =
    cashPayments?.reduce((sum, row) => sum + row.amount_applied, 0) ?? 0;

  return {
    id: data.id,
    status: data.status,
    openingCashAmount: data.opening_cash_amount,
    expectedCashAmount: data.expected_cash_amount,
    countedCashAmount: data.counted_cash_amount,
    cashDifference: data.cash_difference,
    openingNote: data.opening_note,
    closingNote: data.closing_note,
    openedAt: data.opened_at,
    closedAt: data.closed_at,
    openedByName: profile?.full_name ?? null,
    cashCollected,
  };
}

export async function getOrderPaymentSummary(
  workspace: WorkspaceContext,
  orderId: string,
): Promise<OrderPaymentSummary | null> {
  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    const { getLocalDatabase } = await import("@/lib/local-db/database");
    const { getLocalOrderById } = await import("@/lib/local-domain/orders-local");
    const db = getLocalDatabase({ skipBackup: true });
    const order = getLocalOrderById(db, workspace, orderId);
    if (!order) {
      return null;
    }
    const payments = db
      .prepare(
        `SELECT * FROM local_payments WHERE order_id = ? ORDER BY created_at`,
      )
      .all(orderId);
    const confirmed = payments.filter((p) => String(p.status) === "CONFIRMED");
    const paidAmount = confirmed.reduce(
      (sum, p) => sum + Number(p.amount_applied ?? p.amount ?? 0),
      0,
    );
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableReference: order.tableReference,
      customerReference: order.customerReference,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      paidAmount: Math.trunc(paidAmount),
      remainingAmount: Math.max(order.totalAmount - Math.trunc(paidAmount), 0),
      paymentStatus: order.paymentStatus,
      status: order.status,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      payments: payments.map((p) => ({
        id: String(p.id),
        method: String(p.method) as PaymentMethod,
        amountApplied: Number(p.amount_applied ?? p.amount ?? 0),
        amountReceived:
          p.amount_received == null ? null : Number(p.amount_received),
        changeGiven: Number(p.change_given ?? 0),
        status: String(p.status ?? "CONFIRMED"),
        receivedAt: String(p.created_at),
      })),
    };
  }

  const order = await getOrderById(workspace, orderId);

  if (!order) {
    return null;
  }

  const supabase = await createClient();

  const { data: payments, error } = await supabase
    .from("payments")
    .select("id, method, amount_applied, amount_received, change_given, status, received_at")
    .eq("order_id", orderId)
    .order("received_at");

  if (error) {
    return null;
  }

  const confirmedPayments = (payments ?? []).filter((p) => p.status === "CONFIRMED");
  const paidAmount = confirmedPayments.reduce((sum, p) => sum + p.amount_applied, 0);

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    tableReference: order.tableReference,
    customerReference: order.customerReference,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    totalAmount: order.totalAmount,
    paidAmount,
    remainingAmount: Math.max(order.totalAmount - paidAmount, 0),
    paymentStatus: order.paymentStatus,
    status: order.status,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    payments: (payments ?? []).map((p) => ({
      id: p.id,
      method: p.method as PaymentMethod,
      amountApplied: p.amount_applied,
      amountReceived: p.amount_received,
      changeGiven: p.change_given,
      status: p.status,
      receivedAt: p.received_at,
    })),
  };
}

export async function getReceiptById(
  workspace: WorkspaceContext,
  receiptId: string,
): Promise<ReceiptDetail | null> {
  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    const { getLocalDatabase } = await import("@/lib/local-db/database");
    const { getLocalReceiptById } = await import(
      "@/lib/local-domain/checkout-local"
    );
    const local = getLocalReceiptById(
      getLocalDatabase({ skipBackup: true }),
      workspace,
      receiptId,
    );
    if (!local) return null;

    let logoUrl = local.logoUrl ?? null;
    try {
      const { getEstablishmentSettings } = await import("@/lib/settings/queries");
      const { settings } = await getEstablishmentSettings(workspace);
      logoUrl = settings?.logoUrl ?? logoUrl;
    } catch {
      // offline
    }
    return { ...local, logoUrl };
  }

  const supabase = await createClient();

  const { data: receipt, error } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", receiptId)
    .eq("establishment_id", workspace.establishmentId)
    .maybeSingle();

  if (error || !receipt) {
    return null;
  }

  const { data: order } = await supabase
    .from("orders")
    .select("order_number, table_reference, customer_reference")
    .eq("id", receipt.order_id)
    .maybeSingle();

  const { data: items } = await supabase
    .from("order_items")
    .select("product_name_snapshot, quantity, unit_price_snapshot, line_total")
    .eq("order_id", receipt.order_id)
    .order("created_at");

  const { data: payments } = await supabase
    .from("payments")
    .select("method, amount_applied, change_given, status")
    .eq("order_id", receipt.order_id)
    .eq("status", "CONFIRMED");

  let logoUrl: string | null = null;
  try {
    const { getEstablishmentSettings } = await import("@/lib/settings/queries");
    const { settings } = await getEstablishmentSettings(workspace);
    logoUrl = settings?.logoUrl ?? null;
  } catch {
    // Settings optional for print
  }

  return {
    id: receipt.id,
    receiptNumber: receipt.receipt_number,
    orderId: receipt.order_id,
    orderNumber: order?.order_number ?? 0,
    issuedAt: receipt.issued_at,
    subtotal: receipt.subtotal_snapshot,
    discount: receipt.discount_snapshot,
    total: receipt.total_snapshot,
    paid: receipt.paid_snapshot,
    change: receipt.change_snapshot,
    establishmentName: receipt.establishment_name_snapshot,
    establishmentAddress: receipt.establishment_address_snapshot,
    establishmentPhone: receipt.establishment_phone_snapshot,
    logoUrl,
    currency: receipt.establishment_currency_snapshot,
    cashierName: receipt.cashier_name_snapshot,
    tableReference: order?.table_reference ?? null,
    customerReference: order?.customer_reference ?? null,
    items: (items ?? []).map((item) => ({
      productName: item.product_name_snapshot,
      quantity: Number(item.quantity),
      unitPrice: item.unit_price_snapshot,
      lineTotal: item.line_total,
    })),
    payments: (payments ?? []).map((p) => ({
      method: p.method as PaymentMethod,
      amountApplied: p.amount_applied,
      changeGiven: p.change_given,
    })),
  };
}

export async function getReceiptByOrderId(
  workspace: WorkspaceContext,
  orderId: string,
): Promise<ReceiptDetail | null> {
  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    const { getLocalDatabase } = await import("@/lib/local-db/database");
    const { getLocalReceiptByOrderId } = await import(
      "@/lib/local-domain/checkout-local"
    );
    return getLocalReceiptByOrderId(
      getLocalDatabase({ skipBackup: true }),
      workspace,
      orderId,
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("receipts")
    .select("id")
    .eq("order_id", orderId)
    .eq("establishment_id", workspace.establishmentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return getReceiptById(workspace, data.id);
}

/**
 * Addition client imprimable sans paiement.
 * Affiche tous les articles + prix pour montrer la note au client.
 */
export async function getOrderAddition(
  workspace: WorkspaceContext,
  orderId: string,
): Promise<OrderAddition | null> {
  const order = await getOrderById(workspace, orderId);
  if (!order || order.status === "CANCELLED") {
    return null;
  }

  let establishmentName = workspace.establishmentName;
  let establishmentAddress: string | null = null;
  let establishmentPhone: string | null = null;
  let logoUrl: string | null = null;

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: establishment } = await supabase
      .from("establishments")
      .select("name, address, phone, logo_url")
      .eq("id", workspace.establishmentId)
      .maybeSingle();

    if (establishment) {
      establishmentName = establishment.name || establishmentName;
      establishmentAddress = establishment.address ?? null;
      establishmentPhone = establishment.phone ?? null;
      logoUrl = establishment.logo_url ?? null;
    }
  } catch {
    try {
      const { getEstablishmentSettings } = await import("@/lib/settings/queries");
      const { settings } = await getEstablishmentSettings(workspace);
      if (settings) {
        establishmentName = settings.name || establishmentName;
        establishmentAddress = settings.address;
        establishmentPhone = settings.phone;
        logoUrl = settings.logoUrl;
      }
    } catch {
      // Settings may be unavailable offline — workspace name is enough.
    }
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    issuedAt: new Date().toISOString(),
    subtotal: order.subtotal,
    discount: order.discountAmount,
    total: order.totalAmount,
    paymentStatus: order.paymentStatus,
    establishmentName,
    establishmentAddress,
    establishmentPhone,
    logoUrl,
    tableReference: order.tableReference,
    customerReference: order.customerReference,
    orderTypeLabel: ORDER_TYPE_LABELS[order.orderType] ?? order.orderType,
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
  };
}
