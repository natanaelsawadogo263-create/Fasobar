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

export type SaleLineSurplus = {
  productName: string;
  quantity: number;
  /** Prix de vente unitaire du produit (snapshot caisse). */
  unitSalePrice: number;
  /** Coût d’achat unitaire de CE produit à l’appro (pas le total du bon). */
  unitCostPrice: number;
  saleAmount: number;
  costAmount: number;
  surplus: number;
  hasCost: boolean;
};

export type SaleOrderSurplus = {
  orderId: string;
  orderNumber: number;
  paidAt: string;
  cashierName: string | null;
  saleAmount: number;
  costAmount: number;
  surplus: number;
  lines: SaleLineSurplus[];
};

type OrderMeta = {
  id: string;
  orderNumber: number;
  paidAt: string;
  cashierName: string | null;
};

type OrderItemRow = {
  order_id: string;
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  line_total: number;
  unit_price_snapshot?: number | null;
  stock_quantity?: number | null;
  sale_unit_factor?: number | null;
};

/**
 * Surplus = pour chaque produit vendu :
 * (prix de vente de ce produit) − (coût unitaire d’appro de ce même produit).
 * Jamais : total des ventes − total d’un bon d’approvisionnement.
 */
export async function listSaleOrderSurpluses(
  establishmentId: string,
  orders: OrderMeta[],
): Promise<SaleOrderSurplus[]> {
  if (orders.length === 0) return [];

  const supabase = await createClient();
  const client = isAdminClientConfigured() ? createAdminClient() : supabase;
  const orderIds = orders.map((order) => order.id);

  const withPrice = await client
    .from("order_items")
    .select(
      "order_id, product_id, product_name_snapshot, quantity, line_total, unit_price_snapshot, stock_quantity, sale_unit_factor",
    )
    .eq("establishment_id", establishmentId)
    .in("order_id", orderIds);

  let items: OrderItemRow[] = (withPrice.data ?? []) as OrderItemRow[];
  if (withPrice.error) {
    const fallback = await client
      .from("order_items")
      .select(
        "order_id, product_id, product_name_snapshot, quantity, line_total, stock_quantity, sale_unit_factor",
      )
      .eq("establishment_id", establishmentId)
      .in("order_id", orderIds);
    items = (fallback.data ?? []) as OrderItemRow[];
  }

  const productIds = [
    ...new Set(items.map((item) => item.product_id).filter(Boolean)),
  ];
  const unitCostByProduct = await loadProductUnitCostsFromSupply(
    establishmentId,
    productIds,
  );

  const linesByOrder = new Map<string, SaleLineSurplus[]>();

  for (const item of items) {
    const quantity = Number(item.quantity) || 0;
    const saleAmount = Math.round(Number(item.line_total) || 0);
    const unitSalePrice =
      Number(item.unit_price_snapshot) > 0
        ? Math.round(Number(item.unit_price_snapshot))
        : quantity > 0
          ? Math.round(saleAmount / quantity)
          : 0;

    const stockQty = stockQtySold(item);
    const unitCostPrice = unitCostByProduct.get(item.product_id) ?? 0;
    const hasCost = unitCostPrice > 0;
    // Coût des unités vendues de CE produit uniquement.
    const costAmount = hasCost ? Math.round(stockQty * unitCostPrice) : 0;
    const surplus = saleAmount - costAmount;

    const line: SaleLineSurplus = {
      productName: item.product_name_snapshot || "Produit",
      quantity,
      unitSalePrice,
      unitCostPrice,
      saleAmount,
      costAmount,
      surplus,
      hasCost,
    };

    const existing = linesByOrder.get(item.order_id) ?? [];
    existing.push(line);
    linesByOrder.set(item.order_id, existing);
  }

  return orders
    .map((order) => {
      const lines = linesByOrder.get(order.id) ?? [];
      const saleAmount = lines.reduce((sum, line) => sum + line.saleAmount, 0);
      const costAmount = lines.reduce((sum, line) => sum + line.costAmount, 0);
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paidAt: order.paidAt,
        cashierName: order.cashierName,
        saleAmount,
        costAmount,
        surplus: saleAmount - costAmount,
        lines,
      } satisfies SaleOrderSurplus;
    })
    .filter((order) => order.lines.length > 0);
}
