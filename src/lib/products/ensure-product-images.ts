import "server-only";

import { cache } from "react";

import { getLocalProductImage } from "@/lib/fasobar/product-images";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { createClient } from "@/lib/supabase/server";

const ENSURE_TTL_MS = 120_000;
const ensureOkUntil = new Map<string, number>();
const MAX_UPDATES_PER_REQUEST = 12;

/**
 * Pour les produits catalogue sans image : assigne l'image locale FasoBar.
 * Court TTL + lot limité pour ne pas bloquer la page Produits.
 */
export const ensureProductImages = cache(async function ensureProductImages(
  workspace: WorkspaceContext,
): Promise<void> {
  if (!workspace.establishmentId || !workspace.canManageProducts) {
    return;
  }

  const until = ensureOkUntil.get(workspace.establishmentId) ?? 0;
  if (until > Date.now()) {
    return;
  }

  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name")
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .or("image_url.is.null,image_url.eq.")
    .limit(MAX_UPDATES_PER_REQUEST);

  if (error) {
    console.warn("[ensureProductImages]", error.message);
    return;
  }

  if (!products?.length) {
    ensureOkUntil.set(workspace.establishmentId, Date.now() + ENSURE_TTL_MS);
    return;
  }

  const updates = products
    .map((product) => {
      const local = getLocalProductImage(product.name);
      if (!local) return null;
      return { id: product.id, imageUrl: local };
    })
    .filter((row): row is { id: string; imageUrl: string } => Boolean(row));

  if (updates.length === 0) {
    ensureOkUntil.set(workspace.establishmentId, Date.now() + ENSURE_TTL_MS);
    return;
  }

  await Promise.all(
    updates.map((row) =>
      supabase
        .from("products")
        .update({
          image_url: row.imageUrl,
          updated_by: workspace.userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId),
    ),
  );

  // S'il reste potentiellement des produits sans image, TTL court ; sinon plus long.
  const ttl =
    products.length >= MAX_UPDATES_PER_REQUEST
      ? 20_000
      : ENSURE_TTL_MS;
  ensureOkUntil.set(workspace.establishmentId, Date.now() + ttl);
});
