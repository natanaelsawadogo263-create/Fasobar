import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PlatformAccessStatus } from "@/lib/platform/statuses";

export type PlatformClientSummary = {
  organizationId: string;
  organizationName: string;
  organizationCreatedAt: string;
  accessStatus: PlatformAccessStatus;
  ownerName: string | null;
  ownerPhone: string | null;
};

export type PlatformTrialSummary = {
  trialId: string;
  organizationId: string;
  organizationName: string;
  ownerName: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  daysRemaining: number;
};

export type PlatformDashboardData = {
  totalClients: number;
  pendingChoice: number;
  activeTrials: number;
  expiredTrials: number;
  activeClients: number;
  suspendedClients: number;
  pendingRequests: number;
  paymentsThisMonth: number;
  revenueThisMonthXof: number;
  activeMachines: number;
  recentClients: PlatformClientSummary[];
  trialsNearExpiry: PlatformTrialSummary[];
  error: string | null;
};

function daysUntil(iso: string, now: Date): number {
  const end = new Date(iso).getTime();
  return Math.ceil((end - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isMissingTableError(message: string): boolean {
  return /Could not find the table|schema cache|does not exist|PGRST205/i.test(
    message,
  );
}

export async function getPlatformDashboardData(): Promise<PlatformDashboardData> {
  const empty: PlatformDashboardData = {
    totalClients: 0,
    pendingChoice: 0,
    activeTrials: 0,
    expiredTrials: 0,
    activeClients: 0,
    suspendedClients: 0,
    pendingRequests: 0,
    paymentsThisMonth: 0,
    revenueThisMonthXof: 0,
    activeMachines: 0,
    recentClients: [],
    trialsNearExpiry: [],
    error: null,
  };

  try {
    const supabase = await createClient();
    const now = new Date();
    const nearExpiryHorizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [
      statesResult,
      orgsResult,
      trialsResult,
      ownersResult,
      profilesResult,
      requestsResult,
      paymentsResult,
      machinesResult,
    ] = await Promise.all([
      supabase
        .from("organization_platform_states")
        .select("organization_id, status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("organizations").select("id, name, created_at"),
      supabase
        .from("organization_trials")
        .select("id, organization_id, status, starts_at, ends_at")
        .order("ends_at", { ascending: true }),
      supabase
        .from("organization_memberships")
        .select("organization_id, user_id")
        .eq("role", "OWNER")
        .eq("status", "ACTIVE"),
      supabase.from("profiles").select("id, full_name, phone"),
      supabase
        .from("subscription_requests")
        .select("id, status")
        .in("status", [
          "PENDING_PAYMENT",
          "PAYMENT_SUBMITTED",
          "UNDER_REVIEW",
          "NEEDS_NEW_PROOF",
        ]),
      supabase
        .from("platform_subscription_payments")
        .select("id, amount_xof, paid_at")
        .gte("paid_at", monthStart.toISOString()),
      supabase
        .from("registered_machines")
        .select("id, status")
        .eq("status", "ACTIVE"),
    ]);

    const firstError =
      statesResult.error?.message ||
      orgsResult.error?.message ||
      trialsResult.error?.message ||
      ownersResult.error?.message ||
      profilesResult.error?.message ||
      null;

    if (firstError) {
      console.error("[platform] dashboard query error:", firstError);
      return { ...empty, error: firstError };
    }

    const soft = (err: { message: string } | null) =>
      err && !isMissingTableError(err.message) ? err.message : null;

    const softError =
      soft(requestsResult.error) ||
      soft(paymentsResult.error) ||
      soft(machinesResult.error);

    if (softError) {
      console.error("[platform] dashboard soft KPI error:", softError);
    }

    const orgById = new Map((orgsResult.data ?? []).map((o) => [o.id, o] as const));
    const profileById = new Map((profilesResult.data ?? []).map((p) => [p.id, p] as const));
    const ownersByOrg = new Map<string, string>();
    for (const row of ownersResult.data ?? []) {
      ownersByOrg.set(row.organization_id, row.user_id);
    }

    const clients: PlatformClientSummary[] = (statesResult.data ?? []).map((row) => {
      const org = orgById.get(row.organization_id);
      const ownerUserId = ownersByOrg.get(row.organization_id);
      const profile = ownerUserId ? profileById.get(ownerUserId) : null;

      return {
        organizationId: row.organization_id,
        organizationName: org?.name ?? "Organisation",
        organizationCreatedAt: org?.created_at ?? row.created_at,
        accessStatus: row.status as PlatformAccessStatus,
        ownerName: profile?.full_name ?? null,
        ownerPhone: profile?.phone ?? null,
      };
    });

    const orgNameById = new Map(clients.map((c) => [c.organizationId, c.organizationName]));
    const trials = trialsResult.data ?? [];
    const activeTrials = trials.filter(
      (t) => t.status === "ACTIVE" && new Date(t.ends_at).getTime() >= now.getTime(),
    );
    const expiredTrials = trials.filter(
      (t) =>
        t.status === "EXPIRED" ||
        (t.status === "ACTIVE" && new Date(t.ends_at).getTime() < now.getTime()),
    );

    const trialsNearExpiry: PlatformTrialSummary[] = activeTrials
      .filter((t) => {
        const end = new Date(t.ends_at).getTime();
        return end >= now.getTime() && end <= nearExpiryHorizon.getTime();
      })
      .map((t) => {
        const ownerUserId = ownersByOrg.get(t.organization_id);
        const profile = ownerUserId ? profileById.get(ownerUserId) : null;
        return {
          trialId: t.id,
          organizationId: t.organization_id,
          organizationName: orgNameById.get(t.organization_id) ?? "Organisation",
          ownerName: profile?.full_name ?? null,
          status: t.status,
          startsAt: t.starts_at,
          endsAt: t.ends_at,
          daysRemaining: Math.max(0, daysUntil(t.ends_at, now)),
        };
      });

    const payments = paymentsResult.error ? [] : (paymentsResult.data ?? []);
    const revenueThisMonthXof = payments.reduce(
      (sum, p) => sum + (p.amount_xof ?? 0),
      0,
    );

    return {
      totalClients: clients.length,
      pendingChoice: clients.filter((c) => c.accessStatus === "PENDING_CHOICE").length,
      activeTrials: activeTrials.length,
      expiredTrials: expiredTrials.length,
      activeClients: clients.filter((c) => c.accessStatus === "ACTIVE").length,
      suspendedClients: clients.filter((c) => c.accessStatus === "SUSPENDED").length,
      pendingRequests: requestsResult.error ? 0 : (requestsResult.data ?? []).length,
      paymentsThisMonth: payments.length,
      revenueThisMonthXof,
      activeMachines: machinesResult.error ? 0 : (machinesResult.data ?? []).length,
      recentClients: clients.slice(0, 8),
      trialsNearExpiry,
      error: softError,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inattendue.";
    console.error("[platform] dashboard failed:", error);
    return { ...empty, error: message };
  }
}
