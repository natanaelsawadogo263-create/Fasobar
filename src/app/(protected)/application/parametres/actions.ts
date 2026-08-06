"use server";

import { revalidatePath } from "next/cache";

import { mapGenericError } from "@/lib/auth/errors";
import { requireAdminContext } from "@/lib/auth/workspace-context";
import { updateEstablishmentSettingsSchema } from "@/lib/settings/schemas";
import type { EstablishmentSettingsActionState } from "@/lib/settings/types";
import { createClient } from "@/lib/supabase/server";

export async function updateEstablishmentSettingsAction(
  _prev: EstablishmentSettingsActionState,
  formData: FormData,
): Promise<EstablishmentSettingsActionState> {
  const workspace = await requireAdminContext();

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
  });

  if (error) {
    if (error.message?.toLowerCase().includes("does not exist")) {
      return { error: "Migration paramètres non appliquée. Contactez un administrateur technique." };
    }
    return { error: error.message || mapGenericError(error) };
  }

  revalidatePath("/application/parametres");
  revalidatePath("/application/tableau-de-bord");
  return { success: "Paramètres enregistrés." };
}
