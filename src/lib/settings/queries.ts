import "server-only";

import { cache } from "react";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { parseServiceScope, type ServiceScope } from "@/lib/settings/service-scope";
import type { EstablishmentSettings, EstablishmentSettingsResult } from "@/lib/settings/types";
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
  logo_url?: string | null;
  service_scope?: string | null;
};

function mapSettings(row: EstablishmentSettingsRow): EstablishmentSettings {
  return {
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
    logoUrl: row.logo_url ?? null,
    serviceScope: parseServiceScope(row.service_scope),
  };
}

/**
 * Lit les paramètres de l'établissement (adresse, reçu, devise, seuil stock…).
 * Si la migration ajoutant ces colonnes n'a pas encore été appliquée, retourne
 * `migrationMissing: true` au lieu de faire planter la page.
 */
export const getEstablishmentSettings = cache(async function getEstablishmentSettings(
  workspace: WorkspaceContext,
): Promise<EstablishmentSettingsResult> {
  const supabase = await createClient();

  const selects = [
    "id, name, address, phone, currency, timezone, receipt_header, receipt_footer, thank_you_message, default_minimum_stock, logo_url, service_scope",
    "id, name, address, phone, currency, timezone, receipt_header, receipt_footer, thank_you_message, default_minimum_stock, logo_url",
    "id, name, address, phone, currency, timezone, receipt_header, receipt_footer, thank_you_message, default_minimum_stock",
  ];

  for (const [index, columns] of selects.entries()) {
    const { data, error } = await supabase
      .from("establishments")
      .select(columns)
      .eq("id", workspace.establishmentId)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error) && index < selects.length - 1) {
        continue;
      }
      if (isMissingColumnError(error)) {
        return { settings: null, migrationMissing: true };
      }
      return { settings: null, migrationMissing: false };
    }

    if (!data) {
      return { settings: null, migrationMissing: false };
    }

    // Select dynamique (fallback colonnes) → typage Supabase trop large ; normaliser.
    const row = data as unknown as EstablishmentSettingsRow;

    return {
      settings: mapSettings(row),
      migrationMissing: false,
    };
  }

  return { settings: null, migrationMissing: true };
});

export async function getEstablishmentServiceScope(
  establishmentId: string,
): Promise<ServiceScope> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("establishments")
    .select("service_scope")
    .eq("id", establishmentId)
    .maybeSingle();

  if (error || !data) {
    return "BOTH";
  }

  return parseServiceScope((data as { service_scope?: string }).service_scope);
}
