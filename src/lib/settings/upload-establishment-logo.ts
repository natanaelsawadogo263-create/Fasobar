import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "establishment-logos";
const MAX_BYTES = 2 * 1024 * 1024;

export async function uploadEstablishmentLogoFile(
  workspace: WorkspaceContext,
  file: File,
): Promise<{ url: string } | { error: string }> {
  if (!file.size) {
    return { error: "Fichier logo vide." };
  }

  if (file.size > MAX_BYTES) {
    return { error: "Logo trop lourd (max. 2 Mo)." };
  }

  const allowed = ["image/png", "image/jpeg", "image/webp", "image/jpg"];
  if (file.type && !allowed.includes(file.type)) {
    return { error: "Format non supporté. Utilisez PNG, JPG ou WebP." };
  }

  const extension =
    file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
  const path = `${workspace.organizationId}/${workspace.establishmentId}/logo.${extension}`;

  const supabase = await createClient();
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || "image/png",
    upsert: true,
  });

  if (error) {
    return {
      error:
        error.message.includes("Bucket") || error.message.includes("not found")
          ? "Stockage logos non configuré. Appliquez la migration establishment-logos."
          : `Échec de l'upload : ${error.message}`,
    };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-buster pour forcer le refresh après remplacement
  return { url: `${data.publicUrl}?v=${Date.now()}` };
}
