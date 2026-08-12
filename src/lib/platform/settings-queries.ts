import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PlatformSettingsRow = {
  orangeMoneyNumber: string;
  currency: string;
  trialDurationDays: number;
  trialEnabled: boolean;
  warningDaysBeforeExpiry: number;
  offlineGraceDays: number;
  deletionRecoveryDays: number;
  subscriptionReferencePrefix: string;
  paymentInstructions: string | null;
  licenseMinAppVersion: string | null;
  updatedAt: string | null;
};

export type PlatformPlanAdminRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billingPeriod: string;
  durationMonths: number;
  priceXof: number;
  maxMachines: number;
  isActive: boolean;
  sortOrder: number;
};

export type PlatformSettingsResult = {
  settings: PlatformSettingsRow | null;
  plans: PlatformPlanAdminRow[];
  error: string | null;
};

function isMissingTableError(message: string): boolean {
  return /Could not find the table|schema cache|does not exist|PGRST205/i.test(
    message,
  );
}

const DEFAULT_SETTINGS: PlatformSettingsRow = {
  orangeMoneyNumber: "+22657537299",
  currency: "XOF",
  trialDurationDays: 7,
  trialEnabled: true,
  warningDaysBeforeExpiry: 7,
  offlineGraceDays: 3,
  deletionRecoveryDays: 30,
  subscriptionReferencePrefix: "FSB",
  paymentInstructions: null,
  licenseMinAppVersion: null,
  updatedAt: null,
};

export async function getPlatformSettings(): Promise<PlatformSettingsResult> {
  try {
    const supabase = await createClient();

    const [settingsResult, plansResult] = await Promise.all([
      supabase
        .from("platform_settings")
        .select(
          "orange_money_number, currency, trial_duration_days, trial_duration_months, trial_enabled, warning_days_before_expiry, offline_grace_days, deletion_recovery_days, subscription_reference_prefix, payment_instructions, license_min_app_version, updated_at",
        )
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("subscription_plans")
        .select(
          "id, code, name, description, billing_period, duration_months, price_xof, max_machines, is_active, sort_order",
        )
        .order("sort_order", { ascending: true }),
    ]);

    let settingsRow = settingsResult.data;
    let settingsError = settingsResult.error;

    if (
      settingsError &&
      /trial_duration_days/i.test(settingsError.message)
    ) {
      const fallback = await supabase
        .from("platform_settings")
        .select(
          "orange_money_number, currency, trial_duration_months, trial_enabled, warning_days_before_expiry, offline_grace_days, deletion_recovery_days, subscription_reference_prefix, payment_instructions, license_min_app_version, updated_at",
        )
        .eq("id", 1)
        .maybeSingle();
      settingsRow = fallback.data
        ? { ...fallback.data, trial_duration_days: 7 }
        : null;
      settingsError = fallback.error;
    }

    if (settingsError && !isMissingTableError(settingsError.message)) {
      console.error(
        "[platform] getPlatformSettings:",
        settingsError.message,
      );
      return {
        settings: null,
        plans: [],
        error: settingsError.message,
      };
    }

    const row = settingsRow;
    const settings: PlatformSettingsRow = row
      ? {
          orangeMoneyNumber: row.orange_money_number,
          currency: row.currency,
          trialDurationDays:
            typeof row.trial_duration_days === "number" &&
            row.trial_duration_days > 0
              ? row.trial_duration_days
              : 7,
          trialEnabled: row.trial_enabled,
          warningDaysBeforeExpiry: row.warning_days_before_expiry,
          offlineGraceDays: row.offline_grace_days,
          deletionRecoveryDays: row.deletion_recovery_days,
          subscriptionReferencePrefix: row.subscription_reference_prefix,
          paymentInstructions: row.payment_instructions,
          licenseMinAppVersion: row.license_min_app_version,
          updatedAt: row.updated_at,
        }
      : DEFAULT_SETTINGS;

    const plans: PlatformPlanAdminRow[] = (plansResult.data ?? []).map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      billingPeriod: p.billing_period,
      durationMonths: p.duration_months,
      priceXof: p.price_xof,
      maxMachines: p.max_machines,
      isActive: p.is_active,
      sortOrder: p.sort_order,
    }));

    return { settings, plans, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inattendue.";
    console.error("[platform] getPlatformSettings failed:", error);
    return { settings: null, plans: [], error: message };
  }
}
