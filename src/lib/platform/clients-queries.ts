import "server-only";

import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PlatformAccessStatus } from "@/lib/platform/statuses";

export type PlatformClientRow = {
  organizationId: string;
  organizationName: string;
  organizationCreatedAt: string;
  accessStatus: PlatformAccessStatus;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  establishmentsCount: number;
  employeesCount: number;
  trialEndsAt: string | null;
};

type OwnerMembershipRow = {
  organization_id: string;
  user_id: string;
  profiles:
    | { full_name: string | null; phone: string | null }
    | { full_name: string | null; phone: string | null }[]
    | null;
};

function readSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function fetchOwnerEmails(userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  if (!isAdminClientConfigured() || userIds.length === 0) {
    return emails;
  }

  const admin = createAdminClient();
  await Promise.all(
    userIds.map(async (userId) => {
      const { data } = await admin.auth.admin.getUserById(userId);
      if (data.user?.email) {
        emails.set(userId, data.user.email.toLowerCase());
      }
    }),
  );

  return emails;
}

export async function listPlatformClients(): Promise<PlatformClientRow[]> {
  const supabase = await createClient();

  const [statesResult, ownersResult, trialsResult, establishmentsResult, membershipsResult] =
    await Promise.all([
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
        .from("organization_memberships")
        .select(
          `
          organization_id,
          user_id,
          profiles!inner (
            full_name,
            phone
          )
        `,
        )
        .eq("role", "OWNER")
        .eq("status", "ACTIVE"),
      supabase
        .from("organization_trials")
        .select("organization_id, status, ends_at")
        .order("ends_at", { ascending: false }),
      supabase.from("establishments").select("id, organization_id"),
      supabase
        .from("establishment_memberships")
        .select(
          `
          user_id,
          status,
          establishments!inner (
            id,
            organization_id
          )
        `,
        )
        .eq("status", "ACTIVE"),
    ]);

  if (statesResult.error) {
    throw new Error(`Clients états: ${statesResult.error.message}`);
  }
  if (ownersResult.error) {
    throw new Error(`Clients owners: ${ownersResult.error.message}`);
  }
  if (trialsResult.error) {
    throw new Error(`Clients essais: ${trialsResult.error.message}`);
  }
  if (establishmentsResult.error) {
    throw new Error(`Clients établissements: ${establishmentsResult.error.message}`);
  }
  if (membershipsResult.error) {
    throw new Error(`Clients memberships établissement: ${membershipsResult.error.message}`);
  }

  const ownersByOrg = new Map<
    string,
    { userId: string; full_name: string | null; phone: string | null }
  >();

  for (const row of (ownersResult.data ?? []) as OwnerMembershipRow[]) {
    const profile = readSingle(row.profiles);
    ownersByOrg.set(row.organization_id, {
      userId: row.user_id,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
    });
  }

  const ownerIds = [...ownersByOrg.values()].map((o) => o.userId);
  const emailsByUserId = await fetchOwnerEmails(ownerIds);

  /** Fin d'essai la plus pertinente : essai ACTIVE en cours, sinon dernière date connue */
  const trialEndsByOrg = new Map<string, string>();
  for (const trial of trialsResult.data ?? []) {
    if (trialEndsByOrg.has(trial.organization_id)) continue;
    if (trial.status === "ACTIVE" || trial.status === "EXPIRED" || trial.status === "CONVERTED") {
      trialEndsByOrg.set(trial.organization_id, trial.ends_at);
    }
  }
  // Second pass: prefer ACTIVE over others
  for (const trial of trialsResult.data ?? []) {
    if (trial.status === "ACTIVE") {
      trialEndsByOrg.set(trial.organization_id, trial.ends_at);
    }
  }

  const establishmentsCountByOrg = new Map<string, number>();
  for (const est of establishmentsResult.data ?? []) {
    establishmentsCountByOrg.set(
      est.organization_id,
      (establishmentsCountByOrg.get(est.organization_id) ?? 0) + 1,
    );
  }

  /** Employés = memberships établissement ACTIVE, hors OWNER principal */
  const employeesByOrg = new Map<string, Set<string>>();
  for (const membership of membershipsResult.data ?? []) {
    const establishment = readSingle(
      membership.establishments as
        | { id: string; organization_id: string }
        | { id: string; organization_id: string }[]
        | null,
    );
    if (!establishment) continue;

    const owner = ownersByOrg.get(establishment.organization_id);
    if (owner && membership.user_id === owner.userId) continue;

    const set = employeesByOrg.get(establishment.organization_id) ?? new Set<string>();
    set.add(membership.user_id);
    employeesByOrg.set(establishment.organization_id, set);
  }

  return (statesResult.data ?? []).map((row) => {
    const org = readSingle(
      row.organizations as
        | { id: string; name: string; created_at: string }
        | { id: string; name: string; created_at: string }[]
        | null,
    );
    const owner = ownersByOrg.get(row.organization_id);

    return {
      organizationId: row.organization_id,
      organizationName: org?.name ?? "Organisation",
      organizationCreatedAt: org?.created_at ?? row.created_at,
      accessStatus: row.status as PlatformAccessStatus,
      ownerUserId: owner?.userId ?? null,
      ownerName: owner?.full_name ?? null,
      ownerEmail: owner ? (emailsByUserId.get(owner.userId) ?? null) : null,
      ownerPhone: owner?.phone ?? null,
      establishmentsCount: establishmentsCountByOrg.get(row.organization_id) ?? 0,
      employeesCount: employeesByOrg.get(row.organization_id)?.size ?? 0,
      trialEndsAt: trialEndsByOrg.get(row.organization_id) ?? null,
    };
  });
}
