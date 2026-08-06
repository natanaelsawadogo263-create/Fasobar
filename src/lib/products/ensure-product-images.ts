import "server-only";

import { getLocalProductImage } from "@/lib/fasobar/product-images";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { createClient } from "@/lib/supabase/server";

/**
 * Pour les produits catalogue sans image : assigne l'image locale FasoBar.
 * Les nouvelles images restent gérées par upload admin (fond blanc).
 */
export async function ensureProductImages(workspace: WorkspaceContext): Promise<void> {
  if (!workspace.establishmentId || !workspace.canManageProducts) {
    return;
  }

  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name")
    .eq("establishment_id", workspace.establishmentId)
    .or("image_url.is.null,image_url.eq.");

  if (error) {
    console.warn("[ensureProductImages]", error.message);
    return;
  }

  if (!products?.length) {
    return;
  }

  for (const product of products) {
    const local = getLocalProductImage(product.name);
    if (!local) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({
        image_url: local,
        updated_by: workspace.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id)
      .eq("establishment_id", workspace.establishmentId);

    if (updateError) {
      console.error("[ensureProductImages] update", product.name, updateError.message);
    }
  }
}
