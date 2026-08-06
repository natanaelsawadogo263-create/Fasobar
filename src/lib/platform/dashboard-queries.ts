import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PlatformAccessStatus =
  | "PENDING_CHOICE"
  | "TRIAL"
  | "TRIAL_EXPIRED"
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "PENDING_DELETION";

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
  recentClients: PlatformClientSummary[];
  trialsNearExpiry: PlatformTrialSummary[];
};

type OwnerRow = {
  organization_id: string;
  profiles:
    | { full_name: string | null; phone: string | null }
    | { full_name: string | null; phone: string | null }[]
    | null;
};

function unwrapOwner(profiles: OwnerRow["profiles"]) {
  if (!profiles) return { full_name: null, phone: null };
  if (Array.isArray(profiles)) {
    return profiles[0] ?? { full_name: null, phone: null };
  }
  return profiles;
}

function daysUntil(iso: string, now: Date): number {
  const end = new Date(iso).getTime();
  return Math.ceil((end - now.getTime()) / (1000 * 60 * 60 * 24));
}

export async function getPlatformDashboardData(): Promise<PlatformDashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const nearExpiryHorizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [statesResult, trialsResult, ownersResult] = await Promise.all([
    supabase
      .from("organization_platform_states")
      .select(
        `
        organization_id,
        status,
        created_at,
        organizations!inner (
          id,
          name,
          created_at
        )
      `,
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("organization_trials")
      .select("id, organization_id, status, starts_at, ends_at")
      .order("ends_at", { ascending: true }),
    supabase
      .from("organization_memberships")
      .select(
        `
        organization_id,
        profiles!inner (
          full_name,
          phone
        )
      `,
      )
      .eq("role", "OWNER")
      .eq("status", "ACTIVE"),
  ]);

  if (statesResult.error) {
    throw new Error(`Dashboard états: ${statesResult.error.message}`);
  }
  if (trialsResult.error) {
    throw new Error(`Dashboard essais: ${trialsResult.error.message}`);
  }
  if (ownersResult.error) {
    throw new Error(`Dashboard owners: ${ownersResult.error.message}`);
  }

  const ownersByOrg = new Map<string, { full_name: string | null; phone: string | null }>();
  for (const row of (ownersResult.data ?? []) as OwnerRow[]) {
    ownersByOrg.set(row.organization_id, unwrapOwner(row.profiles));
  }

  const clients: PlatformClientSummary[] = (statesResult.data ?? []).map((row) => {
    const orgRaw = row.organizations as
      | { id: string; name: string; created_at: string }
      | { id: string; name: string; created_at: string }[]
      | null;
    const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
    const owner = ownersByOrg.get(row.organization_id);

    return {
      organizationId: row.organization_id,
      organizationName: org?.name ?? "Organisation",
      organizationCreatedAt: org?.created_at ?? row.created_at,
      accessStatus: row.status as PlatformAccessStatus,
      ownerName: owner?.full_name ?? null,
      ownerPhone: owner?.phone ?? null,
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
      const owner = ownersByOrg.get(t.organization_id);
      return {
        trialId: t.id,
        organizationId: t.organization_id,
        organizationName: orgNameById.get(t.organization_id) ?? "Organisation",
        ownerName: owner?.full_name ?? null,
        status: t.status,
        startsAt: t.starts_at,
        endsAt: t.ends_at,
        daysRemaining: Math.max(0, daysUntil(t.ends_at, now)),
      };
    });

  return {
    totalClients: clients.length,
    pendingChoice: clients.filter((c) => c.accessStatus === "PENDING_CHOICE").length,
    activeTrials: activeTrials.length,
    expiredTrials: expiredTrials.length,
    activeClients: clients.filter((c) => c.accessStatus === "ACTIVE").length,
    suspendedClients: clients.filter((c) => c.accessStatus === "SUSPENDED").length,
    recentClients: clients.slice(0, 8),
    trialsNearExpiry,
  };
}
