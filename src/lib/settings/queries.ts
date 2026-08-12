import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type { EstablishmentSettingsResult } from "@/lib/settings/types";
import { createClient } from "@/lib/supabase/server";

function isMissingColumnError(error: { message?: string; code?: string }): boolean {
  const message = error.message ?? "";
  const code = error.code ?? "";
  return code === "42703" || message.toLowerCase().includes("does not exist");
}

type EstablishmentSettingsRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  currency: string;
  timezone: string;
  receipt_header: string | null;
  receipt_footer: string | null;
  thank_you_message: string | null;
  default_minimum_stock: number;
  logo_url: string | null;
};

/**
 * Lit les paramètres de l'établissement (adresse, reçu, devise, seuil stock…).
 * Si la migration ajoutant ces colonnes n'a pas encore été appliquée, retourne
 * `migrationMissing: true` au lieu de faire planter la page.
 */
export async function getEstablishmentSettings(
  workspace: WorkspaceContext,
): Promise<EstablishmentSettingsResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("establishments")
    .select(
      "id, name, address, phone, currency, timezone, receipt_header, receipt_footer, thank_you_message, default_minimum_stock, logo_url",
    )
    .eq("id", workspace.establishmentId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) {
      // Fallback sans logo_url si seule cette colonne manque
      const fallback = await supabase
        .from("establishments")
        .select(
          "id, name, address, phone, currency, timezone, receipt_header, receipt_footer, thank_you_message, default_minimum_stock",
        )
        .eq("id", workspace.establishmentId)
        .maybeSingle();

      if (fallback.error) {
        if (isMissingColumnError(fallback.error)) {
          return { settings: null, migrationMissing: true };
        }
        return { settings: null, migrationMissing: false };
      }

      if (!fallback.data) {
        return { settings: null, migrationMissing: false };
      }

      const row = fallback.data as Omit<EstablishmentSettingsRow, "logo_url">;
      return {
        settings: {
          id: row.id,
          name: row.name,
          address: row.address,
          phone: row.phone,
          currency: row.currency,
          timezone: row.timezone,
          receiptHeader: row.receipt_header,
          receiptFooter: row.receipt_footer,
          thankYouMessage: row.thank_you_message,
          defaultMinimumStock: row.default_minimum_stock,
          logoUrl: null,
        },
        migrationMissing: false,
      };
    }
    return { settings: null, migrationMissing: false };
  }

  if (!data) {
    return { settings: null, migrationMissing: false };
  }

  const row = data as EstablishmentSettingsRow;

  return {
    settings: {
      id: row.id,
      name: row.name,
      address: row.address,
      phone: row.phone,
      currency: row.currency,
      timezone: row.timezone,
      receiptHeader: row.receipt_header,
      receiptFooter: row.receipt_footer,
      thankYouMessage: row.thank_you_message,
      defaultMinimumStock: row.default_minimum_stock,
      logoUrl: row.logo_url,
    },
    migrationMissing: false,
  };
}
