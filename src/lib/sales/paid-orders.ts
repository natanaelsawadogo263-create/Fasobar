import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Vente payée, datée au moment du paiement complet (émission du reçu). */
export type PaidOrder = {
  id: string;
  orderNumber: number;
  totalAmount: number;
  createdAt: string;
  createdBy: string;
  cashierName: string | null;
  /** Heure du paiement complet : même date pour tous les écrans (accueil, ventes, rapports). */
  paidAt: string;
};

type ReceiptRow = {
  issued_at: string;
  orders:
    | {
        id: string;
        order_number: number;
        total_amount: number;
        created_at: string;
        created_by: string;
        profiles: { full_name: string } | { full_name: string }[] | null;
      }
    | null;
};

const PAGE_SIZE = 1000;

function readSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Ventes payées dont le paiement a eu lieu dans [fromIso, toExclusiveIso[.
 * Datées par le reçu, et non par `orders.updated_at` qui bouge après le paiement
 * (préparation bar / cuisine, synchronisation hors ligne). Lues par pages : les
 * totaux d'une longue période ne sont jamais tronqués.
 */
export async function listPaidOrdersInRange(
  supabase: SupabaseServerClient,
  workspace: WorkspaceContext,
  options: { fromIso?: string; toExclusiveIso?: string; cashierId?: string } = {},
): Promise<PaidOrder[]> {
  const result: PaidOrder[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from("receipts")
      .select(
        "issued_at, orders!inner(id, order_number, total_amount, created_at, created_by, payment_status, profiles!orders_created_by_fkey(full_name))",
      )
      .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId)
      .eq("orders.payment_status", "PAID");

    if (options.fromIso) query = query.gte("issued_at", options.fromIso);
    if (options.toExclusiveIso) query = query.lt("issued_at", options.toExclusiveIso);
    if (options.cashierId) query = query.eq("orders.created_by", options.cashierId);

    const { data, error } = await query
      .order("issued_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[listPaidOrdersInRange]", error.message);
      break;
    }

    const rows = (data ?? []) as unknown as ReceiptRow[];
    for (const row of rows) {
      const order = row.orders;
      if (!order) continue;
      result.push({
        id: order.id,
        orderNumber: order.order_number,
        totalAmount: Number(order.total_amount) || 0,
        createdAt: order.created_at,
        createdBy: order.created_by,
        cashierName: readSingle(order.profiles)?.full_name ?? null,
        paidAt: row.issued_at,
      });
    }

    if (rows.length < PAGE_SIZE) break;
  }

  return result;
}

/** Bornes ISO d'une plage de jours AAAA-MM-JJ (heure de Ouagadougou = UTC), fin exclue. */
export function dayRangeToIso(from?: string, to?: string): {
  fromIso?: string;
  toExclusiveIso?: string;
} {
  const toExclusive = to ? new Date(`${to}T00:00:00.000Z`) : null;
  toExclusive?.setUTCDate(toExclusive.getUTCDate() + 1);
  return {
    fromIso: from ? `${from}T00:00:00.000Z` : undefined,
    toExclusiveIso: toExclusive?.toISOString(),
  };
}
