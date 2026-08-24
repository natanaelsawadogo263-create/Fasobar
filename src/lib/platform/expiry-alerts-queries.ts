import "server-only";

import { cache } from "react";

import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  SUBSCRIPTION_EXPIRY_CRITICAL_DAYS,
  SUBSCRIPTION_EXPIRY_WARNING_DAYS,
} from "@/lib/platform/access";
import type {
  PlatformExpiryAlert,
  PlatformExpiryAlertsResult,
} from "@/lib/platform/expiry-alerts-types";

export type {
  PlatformExpiryAlert,
  PlatformExpiryAlertsResult,
} from "@/lib/platform/expiry-alerts-types";

function daysUntil(iso: string, now: Date): number {
  return Math.ceil(
    (new Date(iso).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function isMissingTableError(message: string): boolean {
  return /Could not find the table|schema cache|does not exist|PGRST205/i.test(
    message,
  );
}

async function fetchOwnerEmails(userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  if (!isAdminClientConfigured() || userIds.length === 0) {
    return emails;
  }

  try {
    const admin = createAdminClient();
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const { data } = await admin.auth.admin.getUserById(userId);
          if (data.user?.email) {
            emails.set(userId, data.user.email.toLowerCase());
          }
        } catch (error) {
          console.error("[platform] expiry email fetch failed for", userId, error);
        }
      }),
    );
  } catch (error) {
    console.error("[platform] admin client unavailable for expiry emails:", error);
  }

  return emails;
}

/**
 * Alertes super admin : essais / abonnements qui expirent dans ≤ warningDays
 * (défaut 7 j, issu de platform_settings).
 * Cache React : 1 seule exécution par requête (layout + dashboard).
 */
export const listPlatformExpiryAlerts = cache(
  async (): Promise<PlatformExpiryAlertsResult> => {
  try {
    const supabase = await createClient();
    const now = new Date();

    const [
      settingsResult,
      orgsResult,
      statesResult,
      trialsResult,
      subsResult,
      plansResult,
      ownersResult,
    ] = await Promise.all([
      supabase
        .from("platform_settings")
        .select("warning_days_before_expiry")
        .limit(1)
        .maybeSingle(),
      supabase.from("organizations").select("id, name"),
      supabase
        .from("organization_platform_states")
        .select("organization_id, billing_phone, status"),
      supabase
        .from("organization_trials")
        .select("id, organization_id, status, ends_at")
        .eq("status", "ACTIVE"),
      supabase
        .from("organization_subscriptions")
        .select("id, organization_id, plan_id, status, ends_at, is_current")
        .eq("status", "ACTIVE")
        .eq("is_current", true),
      supabase.from("subscription_plans").select("id, name"),
      supabase
        .from("organization_memberships")
        .select("organization_id, user_id")
        .eq("role", "OWNER")
        .eq("status", "ACTIVE"),
    ]);

    const hardError =
      orgsResult.error?.message ||
      statesResult.error?.message ||
      trialsResult.error?.message ||
      ownersResult.error?.message ||
      null;

    if (hardError) {
      console.error("[platform] expiry alerts query error:", hardError);
      return {
        warningDays: SUBSCRIPTION_EXPIRY_WARNING_DAYS,
        alerts: [],
        error: hardError,
      };
    }

    const softError =
      (subsResult.error && !isMissingTableError(subsResult.error.message)
        ? subsResult.error.message
        : null) ||
      (settingsResult.error && !isMissingTableError(settingsResult.error.message)
        ? settingsResult.error.message
        : null);

    const warningDays = Math.max(
      1,
      Number(settingsResult.data?.warning_days_before_expiry) ||
        SUBSCRIPTION_EXPIRY_WARNING_DAYS,
    );
    const horizonMs = now.getTime() + warningDays * 24 * 60 * 60 * 1000;

    const orgById = new Map((orgsResult.data ?? []).map((o) => [o.id, o] as const));
    const billingByOrg = new Map(
      (statesResult.data ?? []).map((s) => [
        s.organization_id,
        s.billing_phone as string | null,
      ]),
    );
    // Une organisation en suppression programmée (PENDING_DELETION) reste en
    // base pendant le délai de récupération, mais ne doit plus déclencher
    // d'alerte d'échéance visible au quotidien — même logique que les autres
    // vues super admin (dashboard, clients, abonnements).
    const deletedOrgIds = new Set(
      (statesResult.data ?? [])
        .filter((s) => s.status === "PENDING_DELETION")
        .map((s) => s.organization_id),
    );
    const planById = new Map(
      (plansResult.data ?? []).map((p) => [p.id, p.name as string] as const),
    );
    const ownersByOrg = new Map<string, string>();
    for (const row of ownersResult.data ?? []) {
      ownersByOrg.set(row.organization_id, row.user_id);
    }

    const ownerUserIds = [...new Set(ownersByOrg.values())];
    const profilesResult =
      ownerUserIds.length === 0
        ? { data: [] as { id: string; full_name: string | null; phone: string | null }[], error: null }
        : await supabase
            .from("profiles")
            .select("id, full_name, phone")
            .in("id", ownerUserIds);

    if (profilesResult.error) {
      console.error(
        "[platform] expiry alerts profiles:",
        profilesResult.error.message,
      );
    }

    const profileById = new Map(
      (profilesResult.data ?? []).map((p) => [p.id, p] as const),
    );
    const emailsByUserId = await fetchOwnerEmails(ownerUserIds);

    const inWindow = (endsAt: string) => {
      const end = new Date(endsAt).getTime();
      return end >= now.getTime() && end <= horizonMs;
    };

    const alerts: PlatformExpiryAlert[] = [];

    for (const trial of trialsResult.data ?? []) {
      if (deletedOrgIds.has(trial.organization_id)) continue;
      if (!inWindow(trial.ends_at)) continue;
      const ownerUserId = ownersByOrg.get(trial.organization_id) ?? null;
      const profile = ownerUserId ? profileById.get(ownerUserId) : null;
      const daysRemaining = Math.max(0, daysUntil(trial.ends_at, now));
      alerts.push({
        id: `trial:${trial.id}`,
        kind: "trial",
        organizationId: trial.organization_id,
        organizationName:
          orgById.get(trial.organization_id)?.name ?? "Organisation",
        ownerUserId,
        ownerName: profile?.full_name ?? null,
        ownerPhone: profile?.phone ?? null,
        ownerEmail: ownerUserId
          ? (emailsByUserId.get(ownerUserId) ?? null)
          : null,
        billingPhone: billingByOrg.get(trial.organization_id) ?? null,
        planName: "Essai gratuit",
        endsAt: trial.ends_at,
        daysRemaining,
        urgency:
          daysRemaining <= SUBSCRIPTION_EXPIRY_CRITICAL_DAYS
            ? "critical"
            : "warning",
      });
    }

    for (const sub of subsResult.error ? [] : (subsResult.data ?? [])) {
      if (deletedOrgIds.has(sub.organization_id)) continue;
      if (!inWindow(sub.ends_at)) continue;
      const ownerUserId = ownersByOrg.get(sub.organization_id) ?? null;
      const profile = ownerUserId ? profileById.get(ownerUserId) : null;
      const daysRemaining = Math.max(0, daysUntil(sub.ends_at, now));
      alerts.push({
        id: `sub:${sub.id}`,
        kind: "subscription",
        organizationId: sub.organization_id,
        organizationName:
          orgById.get(sub.organization_id)?.name ?? "Organisation",
        ownerUserId,
        ownerName: profile?.full_name ?? null,
        ownerPhone: profile?.phone ?? null,
        ownerEmail: ownerUserId
          ? (emailsByUserId.get(ownerUserId) ?? null)
          : null,
        billingPhone: billingByOrg.get(sub.organization_id) ?? null,
        planName: planById.get(sub.plan_id) ?? "Abonnement",
        endsAt: sub.ends_at,
        daysRemaining,
        urgency:
          daysRemaining <= SUBSCRIPTION_EXPIRY_CRITICAL_DAYS
            ? "critical"
            : "warning",
      });
    }

    alerts.sort(
      (a, b) =>
        a.daysRemaining - b.daysRemaining || a.endsAt.localeCompare(b.endsAt),
    );

    return {
      warningDays,
      alerts,
      error: softError,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inattendue.";
    console.error("[platform] expiry alerts failed:", error);
    return {
      warningDays: SUBSCRIPTION_EXPIRY_WARNING_DAYS,
      alerts: [],
      error: message,
    };
  }
  },
);
