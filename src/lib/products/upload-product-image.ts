import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "product-images";

export async function uploadProductImageFile(
  workspace: WorkspaceContext,
  file: File,
): Promise<{ url: string } | { error: string }> {
  if (!file.size) {
    return { error: "Fichier image vide." };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "Image trop lourde (max. 5 Mo)." };
  }

  const allowed = ["image/png", "image/jpeg", "image/webp", "image/jpg"];
  if (file.type && !allowed.includes(file.type)) {
    return { error: "Format non supporté. Utilisez PNG, JPG ou WebP." };
  }

  const extension = file.type === "image/webp" ? "webp" : file.type === "image/jpeg" ? "jpg" : "png";
  const path = `${workspace.organizationId}/${workspace.establishmentId}/${crypto.randomUUID()}.${extension}`;

  const supabase = await createClient();
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || "image/png",
    upsert: false,
  });

  if (error) {
    return {
      error:
        error.message.includes("Bucket") || error.message.includes("not found")
          ? "Stockage images non configuré. Appliquez la migration product-images."
          : `Échec de l'upload : ${error.message}`,
    };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
