import "server-only";

import { cache } from "react";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { createClient } from "@/lib/supabase/server";

const SUPPLY_HISTORY_TTL_MS = 60_000;
const supplyHistoryUntil = new Map<string, { until: number; value: boolean }>();

/**
 * True si au moins un produit a un coût d’achat unitaire via appro validé.
 */
export const hasEstablishmentSupplyHistory = cache(
  async function hasEstablishmentSupplyHistory(
    workspace: WorkspaceContext,
  ): Promise<boolean> {
    const key = workspace.establishmentId;
    const warm = supplyHistoryUntil.get(key);
    if (warm && warm.until > Date.now()) {
      return warm.value;
    }

    const supabase = await createClient();
    const org = workspace.organizationId;
    const est = workspace.establishmentId;

    const [supplyLines, purchaseMovements] = await Promise.all([
      supabase
        .from("supply_receipt_lines")
        .select("id, supply_receipts!inner(status)", { count: "exact", head: true })
        .eq("organization_id", org)
        .eq("establishment_id", est)
        .eq("supply_receipts.status", "VALIDATED")
        .gt("purchase_price", 0)
        .limit(1),
      supabase
        .from("stock_movements")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org)
        .eq("establishment_id", est)
        .eq("type", "PURCHASE")
        .not("unit_cost", "is", null)
        .gt("unit_cost", 0)
        .limit(1),
    ]);

    if (supplyLines.error && purchaseMovements.error) {
      supplyHistoryUntil.set(key, { until: Date.now() + 15_000, value: false });
      return false;
    }

    const value =
      (supplyLines.count ?? 0) > 0 || (purchaseMovements.count ?? 0) > 0;

    supplyHistoryUntil.set(key, {
      until: Date.now() + SUPPLY_HISTORY_TTL_MS,
      value,
    });
    return value;
  },
);

/**
 * Le bénéfice n’a de sens qu’après une vente ET un coût d’achat produit connu.
 */
export function isProfitReady(options: {
  hasSales: boolean;
  hasSupplyCost: boolean;
}): boolean {
  return options.hasSales && options.hasSupplyCost;
}
