"use server";

import { revalidatePath } from "next/cache";

import { mapGenericError } from "@/lib/auth/errors";
import { requireAdminMutationContext } from "@/lib/auth/workspace-context";
import { getCloudOfflineActionError } from "@/lib/desktop/require-cloud-online";
import { updateEstablishmentSettingsSchema } from "@/lib/settings/schemas";
import type { EstablishmentSettingsActionState } from "@/lib/settings/types";
import { uploadEstablishmentLogoFile } from "@/lib/settings/upload-establishment-logo";
import { createClient } from "@/lib/supabase/server";

export async function updateEstablishmentSettingsAction(
  _prev: EstablishmentSettingsActionState,
  formData: FormData,
): Promise<EstablishmentSettingsActionState> {
  const offlineError = await getCloudOfflineActionError();
  if (offlineError) {
    return { error: offlineError };
  }

  const workspace = await requireAdminMutationContext();

  const parsed = updateEstablishmentSettingsSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    phone: formData.get("phone") || undefined,
    currency: formData.get("currency") || "XOF",
    timezone: formData.get("timezone") || "Africa/Ouagadougou",
    receiptHeader: formData.get("receiptHeader") || undefined,
    receiptFooter: formData.get("receiptFooter") || undefined,
    thankYouMessage: formData.get("thankYouMessage") || undefined,
    defaultMinimumStock: formData.get("defaultMinimumStock") || 5,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const removeLogo = formData.get("removeLogo") === "1";
  const currentLogoUrl = String(formData.get("currentLogoUrl") || "").trim() || null;
  const logoFile = formData.get("logo");

  let logoUrl: string | null = currentLogoUrl;

  if (removeLogo) {
    logoUrl = null;
  } else if (logoFile instanceof File && logoFile.size > 0) {
    const uploaded = await uploadEstablishmentLogoFile(workspace, logoFile);
    if ("error" in uploaded) {
      return { error: uploaded.error };
    }
    logoUrl = uploaded.url;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_establishment_settings", {
    p_establishment_id: workspace.establishmentId,
    p_name: parsed.data.name,
    p_address: parsed.data.address ?? null,
    p_phone: parsed.data.phone ?? null,
    p_currency: parsed.data.currency,
    p_timezone: parsed.data.timezone,
    p_receipt_header: parsed.data.receiptHeader ?? null,
    p_receipt_footer: parsed.data.receiptFooter ?? null,
    p_thank_you_message: parsed.data.thankYouMessage ?? null,
    p_default_minimum_stock: parsed.data.defaultMinimumStock,
    p_logo_url: logoUrl,
  });

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("does not exist") || msg.includes("p_logo_url") || msg.includes("could not find")) {
      return {
        error:
          "Migration logo non appliquée. Exécutez 20260811130000_establishment_logo.sql sur Supabase.",
      };
    }
    return { error: error.message || mapGenericError(error) };
  }

  revalidatePath("/application/parametres");
  revalidatePath("/application/tableau-de-bord");
  revalidatePath("/application/caisse");
  return { success: "Paramètres enregistrés." };
}
