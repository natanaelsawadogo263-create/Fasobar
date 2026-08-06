import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { getDepartmentIdByCode, listProducts } from "@/lib/products/queries";
import { listStockItems } from "@/lib/stock/queries";
import type { StockListItem } from "@/lib/stock/types";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Dans FasoBar, un produit BAR = un article de stock.
 * Cette fonction crée automatiquement les articles manquants
 * pour tous les produits BAR actifs déjà enregistrés.
 */
export async function ensureBarStockItemsFromProducts(
  workspace: WorkspaceContext,
): Promise<StockListItem[]> {
  const [existing, products] = await Promise.all([
    listStockItems(workspace, { tab: "bar", status: "all" }),
    listProducts(workspace, { tab: "bar" }),
  ]);

  const activeProducts = products.filter((product) => product.active);
  const linkedProductIds = new Set(
    existing
      .map((item) => item.productId)
      .filter((id): id is string => Boolean(id)),
  );

  // Aussi lier par nom si un article existe sans product_id (créé manuellement)
  const existingNames = new Set(existing.map((item) => item.name.trim().toLowerCase()));

  const missing = activeProducts.filter((product) => {
    if (linkedProductIds.has(product.id)) return false;
    // Si un article porte déjà le même nom, on ne duplique pas
    if (existingNames.has(product.name.trim().toLowerCase())) return false;
    return true;
  });

  if (missing.length === 0) {
    return existing;
  }

  const departmentId = await getDepartmentIdByCode(workspace, "BAR");
  if (!departmentId) {
    return existing;
  }

  const supabase = await createClient();
  const writeClient = isAdminClientConfigured() ? createAdminClient() : supabase;

  const rows = missing.map((product) => ({
    organization_id: workspace.organizationId,
    establishment_id: workspace.establishmentId,
    department_id: departmentId,
    product_id: product.id,
    name: product.name,
    unit: product.unit,
    current_quantity: 0,
    minimum_quantity: product.minimumStock ?? 0,
    active: true,
  }));

  const { error } = await writeClient.from("stock_items").insert(rows);

  if (error) {
    console.error("[ensureBarStockItemsFromProducts]", error.message, error.code);
    // Retry session user si service role a échoué
    if (writeClient !== supabase) {
      const retry = await supabase.from("stock_items").insert(rows);
      if (retry.error) {
        console.error("[ensureBarStockItemsFromProducts] retry", retry.error.message);
        return existing;
      }
    } else {
      return existing;
    }
  }

  return listStockItems(workspace, { tab: "bar", status: "all" });
}

/** Crée (ou récupère) l'article de stock lié à un produit BAR. */
export async function ensureStockItemForBarProduct(
  workspace: WorkspaceContext,
  product: {
    id: string;
    name: string;
    unit: string;
    minimumStock: number;
    active: boolean;
  },
): Promise<{ id: string } | { error: string }> {
  if (!product.active) {
    return { error: "Produit inactif." };
  }

  const supabase = await createClient();
  const writeClient = isAdminClientConfigured() ? createAdminClient() : supabase;

  const { data: existing } = await writeClient
    .from("stock_items")
    .select("id")
    .eq("establishment_id", workspace.establishmentId)
    .eq("product_id", product.id)
    .maybeSingle();

  if (existing?.id) {
    return { id: existing.id };
  }

  const departmentId = await getDepartmentIdByCode(workspace, "BAR");
  if (!departmentId) {
    return { error: "Département BAR introuvable." };
  }

  const { data, error } = await writeClient
    .from("stock_items")
    .insert({
      organization_id: workspace.organizationId,
      establishment_id: workspace.establishmentId,
      department_id: departmentId,
      product_id: product.id,
      name: product.name,
      unit: product.unit,
      current_quantity: 0,
      minimum_quantity: product.minimumStock ?? 0,
      active: true,
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    console.error("[ensureStockItemForBarProduct]", error?.message);
    return { error: error?.message ?? "Impossible de créer l'article de stock." };
  }

  return { id: data.id };
}
