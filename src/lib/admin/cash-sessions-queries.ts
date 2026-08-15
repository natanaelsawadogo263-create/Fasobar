import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type { PaymentMethod } from "@/lib/payments/schemas";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type AdminCashSessionListItem = {
  id: string;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  openingCashAmount: number;
  cashCollected: number;
  expectedCashAmount: number;
  countedCashAmount: number | null;
  cashDifference: number | null;
};

export type AdminCashSessionsPageData = {
  sessions: AdminCashSessionListItem[];
  openCount: number;
  closedCount: number;
  totalCashCollected: number;
};

export type AdminCashSessionPayment = {
  id: string;
  method: PaymentMethod;
  amountApplied: number;
  amountReceived: number | null;
  changeGiven: number;
  status: string;
  receivedAt: string;
  receivedByName: string | null;
  orderNumber: number | null;
  receiptId: string | null;
};

export type AdminCashSessionDetail = AdminCashSessionListItem & {
  openingNote: string | null;
  closingNote: string | null;
  closedByName: string | null;
  payments: AdminCashSessionPayment[];
};

type CashSessionRow = {
  id: string;
  status: string;
  opening_cash_amount: number;
  expected_cash_amount: number;
  counted_cash_amount: number | null;
  cash_difference: number | null;
  opened_at: string;
  closed_at: string | null;
  opening_note: string | null;
  closing_note: string | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

function mapSessionRow(
  row: CashSessionRow,
  cashCollectedBySession: Map<string, number>,
): AdminCashSessionListItem {
  const profile = readSingle(row.profiles);
  const cashCollected = cashCollectedBySession.get(row.id) ?? 0;

  return {
    id: row.id,
    status: row.status as AdminCashSessionListItem["status"],
    cashierName: profile?.full_name ?? "—",
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openingCashAmount: row.opening_cash_amount,
    cashCollected,
    expectedCashAmount: row.expected_cash_amount,
    countedCashAmount: row.counted_cash_amount,
    cashDifference: row.cash_difference,
  };
}

/** Supervision Admin (lecture seule) de toutes les sessions de caisse de l'établissement. */
export async function listAdminCashSessions(
  workspace: WorkspaceContext,
  options: { from?: string; to?: string } = {},
): Promise<AdminCashSessionsPageData> {
  const supabase = await createClient();

  let query = supabase
    .from("cash_register_sessions")
    .select(
      "id, status, opening_cash_amount, expected_cash_amount, counted_cash_amount, cash_difference, opened_at, closed_at, opening_note, closing_note, profiles!cash_register_sessions_opened_by_fkey(full_name)",
    )
    .eq("establishment_id", workspace.establishmentId)
    .eq("organization_id", workspace.organizationId)
    .order("opened_at", { ascending: false })
    .limit(200);

  if (options.from) {
    query = query.gte("opened_at", `${options.from}T00:00:00.000Z`);
  }
  if (options.to) {
    query = query.lte("opened_at", `${options.to}T23:59:59.999Z`);
  }

  const [{ data, error }, openOutside] = await Promise.all([
    query,
    options.from || options.to
      ? supabase
          .from("cash_register_sessions")
          .select(
            "id, status, opening_cash_amount, expected_cash_amount, counted_cash_amount, cash_difference, opened_at, closed_at, opening_note, closing_note, profiles!cash_register_sessions_opened_by_fkey(full_name)",
          )
          .eq("establishment_id", workspace.establishmentId)
          .eq("organization_id", workspace.organizationId)
          .eq("status", "OPEN")
          .order("opened_at", { ascending: false })
      : Promise.resolve({ data: [] as CashSessionRow[], error: null }),
  ]);

  if (error || !data) {
    return { sessions: [], openCount: 0, closedCount: 0, totalCashCollected: 0 };
  }

  const byId = new Map<string, CashSessionRow>();
  for (const row of [...(openOutside.data ?? []), ...data] as CashSessionRow[]) {
    byId.set(row.id, row);
  }
  const merged = Array.from(byId.values()).sort(
    (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime(),
  );

  const sessionIds = merged.map((row) => row.id);

  const { data: cashPayments } = await supabase
    .from("payments")
    .select("cash_register_session_id, amount_applied")
    .in("cash_register_session_id", sessionIds.length > 0 ? sessionIds : [""])
    .eq("method", "CASH")
    .eq("status", "CONFIRMED");

  const cashCollectedBySession = new Map<string, number>();
  for (const payment of cashPayments ?? []) {
    if (!payment.cash_register_session_id) continue;
    const current = cashCollectedBySession.get(payment.cash_register_session_id) ?? 0;
    cashCollectedBySession.set(
      payment.cash_register_session_id,
      current + payment.amount_applied,
    );
  }

  const sessions = merged.map((row) =>
    mapSessionRow(row, cashCollectedBySession),
  );

  return {
    sessions,
    openCount: sessions.filter((session) => session.status === "OPEN").length,
    closedCount: sessions.filter((session) => session.status === "CLOSED").length,
    totalCashCollected: sessions.reduce((sum, session) => sum + session.cashCollected, 0),
  };
}

/** Détail lecture seule d'une session (paiements, reçus) pour la modale Admin. */
export async function getAdminCashSessionDetail(
  workspace: WorkspaceContext,
  sessionId: string,
): Promise<AdminCashSessionDetail | null> {
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("cash_register_sessions")
    .select(
      "id, status, opening_cash_amount, expected_cash_amount, counted_cash_amount, cash_difference, opened_at, closed_at, opening_note, closing_note, profiles!cash_register_sessions_opened_by_fkey(full_name), closed_profile:profiles!cash_register_sessions_closed_by_fkey(full_name)",
    )
    .eq("id", sessionId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();

  if (error || !session) {
    return null;
  }

  const { data: payments } = await supabase
    .from("payments")
    .select(
      "id, order_id, method, amount_applied, amount_received, change_given, status, received_at, profiles!payments_received_by_fkey(full_name), orders(order_number)",
    )
    .eq("cash_register_session_id", sessionId)
    .order("received_at", { ascending: false });

  const orderIds = Array.from(new Set((payments ?? []).map((payment) => payment.order_id)));

  const { data: receiptRows } = await supabase
    .from("receipts")
    .select("id, order_id")
    .in("order_id", orderIds.length > 0 ? orderIds : [""]);

  const receiptIdByOrderId = new Map<string, string>();
  for (const receipt of receiptRows ?? []) {
    receiptIdByOrderId.set(receipt.order_id, receipt.id);
  }

  const profile = readSingle(
    session.profiles as { full_name: string } | { full_name: string }[] | null,
  );
  const closedProfile = readSingle(
    session.closed_profile as { full_name: string } | { full_name: string }[] | null,
  );

  const cashCollected = (payments ?? [])
    .filter((payment) => payment.method === "CASH" && payment.status === "CONFIRMED")
    .reduce((sum, payment) => sum + payment.amount_applied, 0);

  return {
    id: session.id,
    status: session.status as AdminCashSessionListItem["status"],
    cashierName: profile?.full_name ?? "—",
    openedAt: session.opened_at,
    closedAt: session.closed_at,
    openingCashAmount: session.opening_cash_amount,
    cashCollected,
    expectedCashAmount: session.expected_cash_amount,
    countedCashAmount: session.counted_cash_amount,
    cashDifference: session.cash_difference,
    openingNote: session.opening_note,
    closingNote: session.closing_note,
    closedByName: closedProfile?.full_name ?? null,
    payments: (payments ?? []).map((payment) => {
      const paymentProfile = readSingle(
        payment.profiles as { full_name: string } | { full_name: string }[] | null,
      );
      const order = readSingle(
        payment.orders as { order_number: number } | { order_number: number }[] | null,
      );

      return {
        id: payment.id,
        method: payment.method as PaymentMethod,
        amountApplied: payment.amount_applied,
        amountReceived: payment.amount_received,
        changeGiven: payment.change_given,
        status: payment.status,
        receivedAt: payment.received_at,
        receivedByName: paymentProfile?.full_name ?? null,
        orderNumber: order?.order_number ?? null,
        receiptId: receiptIdByOrderId.get(payment.order_id) ?? null,
      };
    }),
  };
}
