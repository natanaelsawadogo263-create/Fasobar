import "server-only";

import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  loadProductUnitCostsFromSupply,
  stockQtySold,
} from "@/lib/profit/product-unit-cost";

type OrderItemLine = {
  product_id: string;
  quantity: number;
  line_total?: number | null;
  department_id?: string | null;
  stock_quantity?: number | null;
  sale_unit_factor?: number | null;
};

export type SoldGoodsCostOptions = {
  /** Limite le coût aux articles d’un espace (Bar ou Cuisine). */
  departmentCode?: "BAR" | "KITCHEN";
};

/**
 * Coût d’achat des articles réellement vendus.
 * Pour chaque ligne : quantité stock vendue × coût unitaire d’appro de CE produit.
 * Ne soustrait jamais le montant total d’un bon d’approvisionnement.
 */
export async function sumSoldGoodsCost(
  establishmentId: string,
  orderIds: string[],
  options: SoldGoodsCostOptions = {},
): Promise<number> {
  if (orderIds.length === 0) return 0;

  const supabase = await createClient();
  const itemsClient = isAdminClientConfigured() ? createAdminClient() : supabase;

  const withStock = await itemsClient
    .from("order_items")
    .select(
      "product_id, quantity, line_total, department_id, stock_quantity, sale_unit_factor",
    )
    .eq("establishment_id", establishmentId)
    .in("order_id", orderIds);

  let items: OrderItemLine[] = (withStock.data ?? []) as OrderItemLine[];
  if (withStock.error) {
    const fallback = await itemsClient
      .from("order_items")
      .select("product_id, quantity, department_id")
      .eq("establishment_id", establishmentId)
      .in("order_id", orderIds);
    items = (fallback.data ?? []) as OrderItemLine[];
  }

  if (options.departmentCode) {
    const departmentIds = [
      ...new Set(items.map((item) => item.department_id).filter(Boolean)),
    ] as string[];

    if (departmentIds.length === 0) return 0;

    const { data: departments } = await itemsClient
      .from("departments")
      .select("id, code")
      .in("id", departmentIds);

    const allowedIds = new Set(
      (departments ?? [])
        .filter((row) => row.code === options.departmentCode)
        .map((row) => row.id as string),
    );

    items = items.filter(
      (item) => item.department_id && allowedIds.has(item.department_id),
    );
  }

  const productIds = [
    ...new Set(items.map((item) => item.product_id).filter(Boolean)),
  ];
  if (productIds.length === 0) return 0;

  const unitCostByProduct = await loadProductUnitCostsFromSupply(
    establishmentId,
    productIds,
  );

  let total = 0;
  for (const item of items) {
    const stockQty = stockQtySold(item);
    if (!(stockQty > 0)) continue;
    const unitCost = unitCostByProduct.get(item.product_id) ?? 0;
    if (!(unitCost > 0)) continue;
    total += Math.round(stockQty * unitCost);
  }
  return total;
}
