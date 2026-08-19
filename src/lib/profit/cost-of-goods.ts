import "server-only";

import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type OrderItemLine = {
  product_id: string;
  quantity: number;
  department_id?: string | null;
  stock_quantity?: number | null;
  sale_unit_factor?: number | null;
};

export type SoldGoodsCostOptions = {
  /** Limite le coût aux articles d’un espace (Bar ou Cuisine). */
  departmentCode?: "BAR" | "KITCHEN";
};

/**
 * Coût d’achat des articles vendus sur les commandes données
 * (dernier prix d’appro par unité de stock, sinon purchase_price produit).
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
    .select("product_id, quantity, department_id, stock_quantity, sale_unit_factor")
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

  const [{ data: stockRows }, { data: productRows }] = await Promise.all([
    itemsClient
      .from("stock_items")
      .select("id, product_id")
      .eq("establishment_id", establishmentId)
      .in("product_id", productIds),
    itemsClient
      .from("products")
      .select("id, purchase_price")
      .eq("establishment_id", establishmentId)
      .in("id", productIds),
  ]);

  const stockIdByProduct = new Map<string, string>();
  for (const row of stockRows ?? []) {
    if (row.product_id && !stockIdByProduct.has(row.product_id)) {
      stockIdByProduct.set(row.product_id as string, row.id as string);
    }
  }

  const stockIds = [...stockIdByProduct.values()];
  const unitCostByStock = new Map<string, number>();
  if (stockIds.length > 0) {
    const { data: movements } = await itemsClient
      .from("stock_movements")
      .select("stock_item_id, unit_cost")
      .eq("establishment_id", establishmentId)
      .in("stock_item_id", stockIds)
      .not("unit_cost", "is", null)
      .order("created_at", { ascending: false });
    for (const row of movements ?? []) {
      if (row.unit_cost != null && !unitCostByStock.has(row.stock_item_id)) {
        unitCostByStock.set(row.stock_item_id, Number(row.unit_cost));
      }
    }
  }

  const purchaseByProduct = new Map<string, number>();
  for (const row of productRows ?? []) {
    const price = Number(row.purchase_price ?? 0);
    if (price > 0) purchaseByProduct.set(row.id as string, price);
  }

  let total = 0;
  for (const item of items) {
    const stockQty =
      Number(item.stock_quantity) > 0
        ? Number(item.stock_quantity)
        : Number(item.quantity) * (Number(item.sale_unit_factor) || 1);
    if (!(stockQty > 0)) continue;
    const stockId = stockIdByProduct.get(item.product_id);
    const unitCost =
      (stockId ? unitCostByStock.get(stockId) : undefined) ??
      purchaseByProduct.get(item.product_id) ??
      0;
    total += Math.round(stockQty * unitCost);
  }
  return total;
}
