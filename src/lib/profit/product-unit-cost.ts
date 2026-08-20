import "server-only";

import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Coût d’achat d’UNE unité de stock pour un produit,
 * issu de la ligne d’appro rattachée à CE produit
 * (= purchase_price / conversion_factor), jamais le total du bon d’appro.
 */
export function unitCostFromSupplyLine(input: {
  purchasePrice: number;
  conversionFactor: number;
}): number {
  const price = Math.max(0, Number(input.purchasePrice) || 0);
  const factor = Number(input.conversionFactor) || 1;
  if (!(price > 0)) return 0;
  if (factor > 1) {
    return Math.round(price / factor);
  }
  return Math.round(price);
}

/**
 * Charge le dernier coût unitaire d’appro par produit
 * (ligne supply_receipt_lines du produit, sinon mouvement PURCHASE du stock lié).
 */
export async function loadProductUnitCostsFromSupply(
  establishmentId: string,
  productIds: string[],
): Promise<Map<string, number>> {
  const unitCostByProduct = new Map<string, number>();
  if (productIds.length === 0) return unitCostByProduct;

  const supabase = await createClient();
  const client = isAdminClientConfigured() ? createAdminClient() : supabase;

  // 1) Source de vérité : ligne d’appro du produit (pas le total du bon).
  const { data: supplyLines } = await client
    .from("supply_receipt_lines")
    .select(
      "product_id, purchase_price, conversion_factor, created_at, supply_receipts!inner(status, validated_at)",
    )
    .eq("establishment_id", establishmentId)
    .in("product_id", productIds)
    .eq("supply_receipts.status", "VALIDATED")
    .order("created_at", { ascending: false })
    .limit(Math.min(productIds.length * 8, 800));

  for (const row of supplyLines ?? []) {
    const productId = row.product_id as string | null;
    if (!productId || unitCostByProduct.has(productId)) continue;
    const unitCost = unitCostFromSupplyLine({
      purchasePrice: Number(row.purchase_price),
      conversionFactor: Number(row.conversion_factor),
    });
    if (unitCost > 0) {
      unitCostByProduct.set(productId, unitCost);
    }
  }

  const missingProducts = productIds.filter((id) => !unitCostByProduct.has(id));
  if (missingProducts.length === 0) {
    return unitCostByProduct;
  }

  // 2) Repli : unit_cost du mouvement PURCHASE du stock lié à CE produit.
  const { data: stockRows } = await client
    .from("stock_items")
    .select("id, product_id")
    .eq("establishment_id", establishmentId)
    .in("product_id", missingProducts);

  const stockIdByProduct = new Map<string, string>();
  for (const row of stockRows ?? []) {
    if (row.product_id && !stockIdByProduct.has(row.product_id)) {
      stockIdByProduct.set(row.product_id as string, row.id as string);
    }
  }

  const stockIds = [...stockIdByProduct.values()];
  if (stockIds.length === 0) {
    return unitCostByProduct;
  }

  const { data: movements } = await client
    .from("stock_movements")
    .select("stock_item_id, unit_cost, created_at")
    .eq("establishment_id", establishmentId)
    .in("stock_item_id", stockIds)
    .eq("type", "PURCHASE")
    .not("unit_cost", "is", null)
    .gt("unit_cost", 0)
    .order("created_at", { ascending: false })
    .limit(Math.min(stockIds.length * 5, 500));

  const unitCostByStock = new Map<string, number>();
  for (const row of movements ?? []) {
    if (row.unit_cost != null && !unitCostByStock.has(row.stock_item_id)) {
      unitCostByStock.set(row.stock_item_id, Number(row.unit_cost));
    }
  }

  for (const [productId, stockId] of stockIdByProduct) {
    if (unitCostByProduct.has(productId)) continue;
    const cost = unitCostByStock.get(stockId);
    if (cost != null && cost > 0) {
      unitCostByProduct.set(productId, cost);
    }
  }

  return unitCostByProduct;
}

export function stockQtySold(item: {
  quantity: number;
  stock_quantity?: number | null;
  sale_unit_factor?: number | null;
}): number {
  if (Number(item.stock_quantity) > 0) {
    return Number(item.stock_quantity);
  }
  return Number(item.quantity) * (Number(item.sale_unit_factor) || 1);
}
