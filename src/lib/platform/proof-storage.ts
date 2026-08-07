import "server-only";

import { createClient } from "@/lib/supabase/server";

export const SUBSCRIPTION_PROOF_BUCKET = "subscription-payment-proofs";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export type ProofUploadInput = {
  organizationId: string;
  requestId: string;
  file: File;
};

export type ProofUploadResult =
  | { ok: true; storagePath: string }
  | { ok: false; error: string };

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function buildProofStoragePath(
  organizationId: string,
  requestId: string,
  filename: string,
): string {
  return `${organizationId}/${requestId}/${filename}`;
}

/** Upload d'une preuve Orange Money (OWNER). Chemin : org/request/file. */
export async function uploadSubscriptionPaymentProof(
  input: ProofUploadInput,
): Promise<ProofUploadResult> {
  const mime = input.file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return {
      ok: false,
      error: "Format non supporté. Utilisez JPEG, PNG ou WebP.",
    };
  }

  if (input.file.size > MAX_BYTES) {
    return { ok: false, error: "Fichier trop volumineux (max. 5 Mo)." };
  }

  const filename = `proof-${Date.now()}.${extensionForMime(mime)}`;
  const storagePath = buildProofStoragePath(
    input.organizationId,
    input.requestId,
    filename,
  );

  try {
    const supabase = await createClient();
    const buffer = Buffer.from(await input.file.arrayBuffer());
    const { error } = await supabase.storage
      .from(SUBSCRIPTION_PROOF_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mime,
        upsert: false,
      });

    if (error) {
      console.error("[platform] proof upload failed:", error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true, storagePath };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Échec du téléversement.";
    console.error("[platform] proof upload exception:", error);
    return { ok: false, error: message };
  }
}

/** URL signée courte pour consultation Super Admin. */
export async function createProofSignedUrl(
  storagePath: string,
  expiresInSeconds = 120,
): Promise<{ url: string | null; error: string | null }> {
  if (!storagePath.trim()) {
    return { url: null, error: "Chemin de preuve manquant." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(SUBSCRIPTION_PROOF_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      console.error("[platform] signed URL failed:", error.message);
      return { url: null, error: error.message };
    }

    return { url: data.signedUrl, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de signer l’URL.";
    console.error("[platform] signed URL exception:", error);
    return { url: null, error: message };
  }
}
