import "server-only";

import { cache } from "react";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { getDepartmentIdByCode, listProducts } from "@/lib/products/queries";
import { listStockItems } from "@/lib/stock/queries";
import type { StockListItem } from "@/lib/stock/types";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Évite de resynchroniser le stock bar à chaque navigation (TTL process). */
const ENSURE_TTL_MS = 90_000;
const ensureOkUntil = new Map<string, number>();

/**
 * Dans FasoBar, un produit BAR = un article de stock.
 * Crée automatiquement les articles manquants pour les produits BAR actifs.
 * Dédupliqué par requête + court TTL pour ne pas ralentir Stock / Appro.
 */
export const ensureBarStockItemsFromProducts = cache(
  async function ensureBarStockItemsFromProducts(
    workspace: WorkspaceContext,
  ): Promise<StockListItem[]> {
    const cacheKey = workspace.establishmentId;
    const until = ensureOkUntil.get(cacheKey) ?? 0;
    // Warm TTL : no-op (appelé en fire-and-forget depuis stock/appro).
    if (until > Date.now()) {
      return [];
    }

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

    const existingNames = new Set(
      existing.map((item) => item.name.trim().toLowerCase()),
    );

    const missing = activeProducts.filter((product) => {
      if (linkedProductIds.has(product.id)) return false;
      if (existingNames.has(product.name.trim().toLowerCase())) return false;
      return true;
    });

    if (missing.length === 0) {
      ensureOkUntil.set(cacheKey, Date.now() + ENSURE_TTL_MS);
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

    void (async () => {
      const { error } = await writeClient.from("stock_items").insert(rows);
      if (error) {
        console.error("[ensureBarStockItemsFromProducts]", error.message, error.code);
        if (writeClient !== supabase) {
          const retry = await supabase.from("stock_items").insert(rows);
          if (retry.error) {
            console.error(
              "[ensureBarStockItemsFromProducts] retry",
              retry.error.message,
            );
          }
        }
      }
      ensureOkUntil.set(cacheKey, Date.now() + ENSURE_TTL_MS);
    })();

    ensureOkUntil.set(cacheKey, Date.now() + 15_000);
    return existing;
  },
);

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
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .eq("product_id", product.id)
    .maybeSingle();

  if (existing?.id) {
    await writeClient
      .from("stock_items")
      .update({
        name: product.name,
        unit: product.unit,
        minimum_quantity: product.minimumStock ?? 0,
        active: product.active,
      })
      .eq("id", existing.id);
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
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Impossible de créer l'article de stock." };
  }

  ensureOkUntil.delete(workspace.establishmentId);
  return { id: data.id };
}

/** Enregistre le stock déjà présent à la création du produit (mouvement d’entrée manuelle). */
export async function recordInitialStockForProduct(
  workspace: WorkspaceContext,
  productId: string,
  quantity: number,
  options: { unitCost?: number | null; reason?: string } = {},
): Promise<{ ok: true } | { error: string }> {
  if (!(quantity > 0)) {
    return { ok: true };
  }

  const supabase = await createClient();
  const writeClient = isAdminClientConfigured() ? createAdminClient() : supabase;

  const { data: stockRow } = await writeClient
    .from("stock_items")
    .select("id")
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("product_id", productId)
    .maybeSingle();

  if (!stockRow?.id) {
    return { error: "Article de stock introuvable." };
  }

  const qty = Math.round(quantity * 1000) / 1000;
  const { error } = await supabase.rpc("record_stock_entry", {
    p_stock_item_id: stockRow.id,
    p_movement_type: "MANUAL_ENTRY",
    p_quantity: qty,
    p_purchased_quantity: qty,
    p_conversion_factor: 1,
    p_unit_cost: options.unitCost && options.unitCost > 0 ? options.unitCost : null,
    p_supplier_id: null,
    p_reference: null,
    p_reason: options.reason ?? "Stock actuel à la création du produit",
  });

  if (error) {
    return { error: error.message };
  }

  ensureOkUntil.delete(workspace.establishmentId);
  return { ok: true };
}
