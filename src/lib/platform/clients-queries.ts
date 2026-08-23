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

export type PlatformClientsResult = {
  clients: PlatformClientRow[];
  error: string | null;
};

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
          console.error("[platform] email fetch failed for", userId, error);
        }
      }),
    );
  } catch (error) {
    console.error("[platform] admin client unavailable for emails:", error);
  }

  return emails;
}

/**
 * Liste des clients = OWNER principal par organisation.
 * Requêtes plates (pas de joins PostgREST fragiles) pour éviter les 500 RSC.
 */
export async function listPlatformClients(): Promise<PlatformClientsResult> {
  try {
    const supabase = await createClient();

    const [
      statesResult,
      orgsResult,
      ownersResult,
      trialsResult,
      establishmentsResult,
      establishmentMembershipsResult,
    ] = await Promise.all([
      supabase
        .from("organization_platform_states")
        .select("organization_id, status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("organizations").select("id, name, created_at"),
      supabase
        .from("organization_memberships")
        .select("organization_id, user_id")
        .eq("role", "OWNER")
        .eq("status", "ACTIVE"),
      supabase.from("organization_trials").select("organization_id, status, ends_at"),
      supabase.from("establishments").select("id, organization_id"),
      supabase
        .from("establishment_memberships")
        .select("establishment_id, user_id")
        .eq("status", "ACTIVE"),
    ]);

    const firstError =
      statesResult.error?.message ||
      orgsResult.error?.message ||
      ownersResult.error?.message ||
      trialsResult.error?.message ||
      establishmentsResult.error?.message ||
      establishmentMembershipsResult.error?.message ||
      null;

    if (firstError) {
      console.error("[platform] listPlatformClients query error:", firstError);
      return { clients: [], error: firstError };
    }

    const orgById = new Map(
      (orgsResult.data ?? []).map((org) => [org.id, org] as const),
    );

    // Ne charge que les profils des propriétaires réellement affichés (un par
    // organisation), jamais la table profiles entière — avec beaucoup d'établissements
    // (donc beaucoup d'employés), un select() sans filtre y devient un vrai goulot
    // d'étranglement alors que seuls les OWNER sont utilisés ici.
    const ownerUserIds = [
      ...new Set((ownersResult.data ?? []).map((row) => row.user_id)),
    ];
    const profilesResult =
      ownerUserIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name, phone")
            .in("id", ownerUserIds)
        : { data: [], error: null };

    if (profilesResult.error) {
      console.error("[platform] listPlatformClients query error:", profilesResult.error.message);
      return { clients: [], error: profilesResult.error.message };
    }

    const profileById = new Map(
      (profilesResult.data ?? []).map((profile) => [profile.id, profile] as const),
    );

    const ownersByOrg = new Map<string, string>();
    for (const row of ownersResult.data ?? []) {
      ownersByOrg.set(row.organization_id, row.user_id);
    }

    const emailsByUserId = await fetchOwnerEmails([...ownersByOrg.values()]);

    const trialEndsByOrg = new Map<string, string>();
    for (const trial of trialsResult.data ?? []) {
      if (trial.status === "ACTIVE") {
        trialEndsByOrg.set(trial.organization_id, trial.ends_at);
      }
    }
    for (const trial of trialsResult.data ?? []) {
      if (!trialEndsByOrg.has(trial.organization_id) && trial.ends_at) {
        trialEndsByOrg.set(trial.organization_id, trial.ends_at);
      }
    }

    const establishmentsCountByOrg = new Map<string, number>();
    const establishmentOrgById = new Map<string, string>();
    for (const est of establishmentsResult.data ?? []) {
      establishmentOrgById.set(est.id, est.organization_id);
      establishmentsCountByOrg.set(
        est.organization_id,
        (establishmentsCountByOrg.get(est.organization_id) ?? 0) + 1,
      );
    }

    const employeesByOrg = new Map<string, Set<string>>();
    for (const membership of establishmentMembershipsResult.data ?? []) {
      const organizationId = establishmentOrgById.get(membership.establishment_id);
      if (!organizationId) continue;

      const ownerUserId = ownersByOrg.get(organizationId);
      if (ownerUserId && membership.user_id === ownerUserId) continue;

      const set = employeesByOrg.get(organizationId) ?? new Set<string>();
      set.add(membership.user_id);
      employeesByOrg.set(organizationId, set);
    }

    const clients: PlatformClientRow[] = (statesResult.data ?? []).map((row) => {
      const org = orgById.get(row.organization_id);
      const ownerUserId = ownersByOrg.get(row.organization_id) ?? null;
      const profile = ownerUserId ? profileById.get(ownerUserId) : null;

      return {
        organizationId: row.organization_id,
        organizationName: org?.name ?? "Organisation",
        organizationCreatedAt: org?.created_at ?? row.created_at,
        accessStatus: row.status as PlatformAccessStatus,
        ownerUserId,
        ownerName: profile?.full_name ?? null,
        ownerEmail: ownerUserId ? (emailsByUserId.get(ownerUserId) ?? null) : null,
        ownerPhone: profile?.phone ?? null,
        establishmentsCount: establishmentsCountByOrg.get(row.organization_id) ?? 0,
        employeesCount: employeesByOrg.get(row.organization_id)?.size ?? 0,
        trialEndsAt: trialEndsByOrg.get(row.organization_id) ?? null,
      };
    });

    return { clients, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inattendue.";
    console.error("[platform] listPlatformClients failed:", error);
    return { clients: [], error: message };
  }
}
