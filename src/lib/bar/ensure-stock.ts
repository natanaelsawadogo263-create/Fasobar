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
    if (until > Date.now()) {
      return listStockItems(workspace, { tab: "bar", status: "all" });
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
          return existing;
        }
      } else {
        return existing;
      }
    }

    ensureOkUntil.set(cacheKey, Date.now() + ENSURE_TTL_MS);
    return listStockItems(workspace, { tab: "bar", status: "all" });
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
