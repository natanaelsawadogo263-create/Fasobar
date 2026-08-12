import type { ServiceScope } from "@/lib/settings/service-scope";

export type EstablishmentSettingsActionState = {
  error?: string;
  success?: string;
};

export type EstablishmentSettings = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  currency: string;
  timezone: string;
  receiptHeader: string | null;
  receiptFooter: string | null;
  thankYouMessage: string | null;
  defaultMinimumStock: number;
  logoUrl: string | null;
  serviceScope: ServiceScope;
};

export type EstablishmentSettingsResult = {
  settings: EstablishmentSettings | null;
  /** true si les colonnes de paramètres n'existent pas encore (migration non appliquée). */
  migrationMissing: boolean;
};
