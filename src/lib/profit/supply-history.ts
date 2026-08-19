import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { createClient } from "@/lib/supabase/server";

/**
 * True dès que l’établissement peut calculer un coût d’achat :
 * approvisionnement, prix d’achat produit, ou entrée stock avec coût unitaire.
 */
export async function hasEstablishmentSupplyHistory(
  workspace: WorkspaceContext,
): Promise<boolean> {
  const supabase = await createClient();
  const org = workspace.organizationId;
  const est = workspace.establishmentId;

  const [purchaseMovements, costMovements, productsWithCost] = await Promise.all([
    supabase
      .from("stock_movements")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .eq("establishment_id", est)
      .eq("type", "PURCHASE")
      .limit(1),
    supabase
      .from("stock_movements")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .eq("establishment_id", est)
      .not("unit_cost", "is", null)
      .gt("unit_cost", 0)
      .limit(1),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .eq("establishment_id", est)
      .gt("purchase_price", 0)
      .limit(1),
  ]);

  if (purchaseMovements.error && costMovements.error && productsWithCost.error) {
    return false;
  }

  return (
    (purchaseMovements.count ?? 0) > 0 ||
    (costMovements.count ?? 0) > 0 ||
    (productsWithCost.count ?? 0) > 0
  );
}
