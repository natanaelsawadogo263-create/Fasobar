import "server-only";

import { isActivePlatformAdmin } from "@/lib/platform/auth";
import {
  isBusinessAccessStatus,
  resolveSaasAppRedirect,
  type PlatformAccessStatus,
} from "@/lib/platform/access";
import { isPlatformAccessStatus } from "@/lib/platform/statuses";
import { createClient } from "@/lib/supabase/server";

export type OrganizationSaasAccess = {
  organizationId: string;
  status: PlatformAccessStatus;
  statusChangedAt: string | null;
  previousStatus: PlatformAccessStatus | null;
  billingPhone: string | null;
  primaryOwnerUserId: string | null;
  deletionRequestedAt: string | null;
  deletionPurgeAfter: string | null;
};

const BUSINESS_ACCESS_DENIED =
  "L'accès SaaS de cette organisation n'est pas actif. Abonnement ou essai requis.";

function isMissingRpcError(message: string): boolean {
  return /Could not find the function|PGRST202|schema cache|does not exist/i.test(
    message,
  );
}

function mapPlatformStateRow(
  organizationId: string,
  row: {
    status?: string | null;
    status_changed_at?: string | null;
    previous_status?: string | null;
    billing_phone?: string | null;
    primary_owner_user_id?: string | null;
    deletion_requested_at?: string | null;
    deletion_purge_after?: string | null;
  } | null,
): OrganizationSaasAccess {
  const rawStatus = row?.status ?? "PENDING_CHOICE";
  const status: PlatformAccessStatus = isPlatformAccessStatus(rawStatus)
    ? rawStatus
    : "PENDING_CHOICE";

  const previousRaw = row?.previous_status ?? null;
  const previousStatus: PlatformAccessStatus | null =
    previousRaw && isPlatformAccessStatus(previousRaw) ? previousRaw : null;

  return {
    organizationId,
    status,
    statusChangedAt: row?.status_changed_at ?? null,
    previousStatus,
    billingPhone: row?.billing_phone ?? null,
    primaryOwnerUserId: row?.primary_owner_user_id ?? null,
    deletionRequestedAt: row?.deletion_requested_at ?? null,
    deletionPurgeAfter: row?.deletion_purge_after ?? null,
  };
}

async function readOrganizationPlatformState(
  organizationId: string,
): Promise<OrganizationSaasAccess> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_platform_states")
    .select(
      "organization_id, status, status_changed_at, previous_status, billing_phone, primary_owner_user_id, deletion_requested_at, deletion_purge_after",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error(
      "[platform] organization_platform_states read failed:",
      error.message,
    );
  }

  return mapPlatformStateRow(organizationId, data);
}

/**
 * Rafraîchit l'état SaaS (RPC) puis lit `organization_platform_states`.
 * Si la RPC est absente (migration pas encore appliquée), lit l'état tel quel.
 */
export async function refreshAndGetOrganizationSaasAccess(
  organizationId: string,
): Promise<OrganizationSaasAccess> {
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc(
    "refresh_organization_platform_access",
    { p_organization_id: organizationId },
  );

  if (rpcError) {
    if (!isMissingRpcError(rpcError.message)) {
      console.error(
        "[platform] refresh_organization_platform_access failed:",
        rpcError.message,
      );
    }
    // Soft-fallback : lecture seule de l'état courant.
  }

  return readOrganizationPlatformState(organizationId);
}

/** Lève une erreur si l'org n'a pas d'accès métier (TRIAL/ACTIVE). */
export async function assertOrganizationBusinessAccess(
  organizationId: string,
): Promise<OrganizationSaasAccess> {
  const access = await refreshAndGetOrganizationSaasAccess(organizationId);
  if (!isBusinessAccessStatus(access.status)) {
    throw new Error(BUSINESS_ACCESS_DENIED);
  }
  return access;
}

/**
 * Variante pour actions serveur : retourne un message d'erreur ou null si OK.
 */
export async function requireOrganizationBusinessAccess(
  organizationId: string,
): Promise<string | null> {
  const access = await refreshAndGetOrganizationSaasAccess(organizationId);
  if (!isBusinessAccessStatus(access.status)) {
    return BUSINESS_ACCESS_DENIED;
  }
  return null;
}

/**
 * Redirection SaaS pour un utilisateur dans le contexte d'une organisation.
 * `userId` est réservé à la signature API ; le check admin plateforme utilise le JWT courant.
 */
export async function getSaasRedirectForUser(
  _userId: string,
  organizationId: string,
  isOwner: boolean,
): Promise<string | null> {
  const [isPlatformAdmin, access] = await Promise.all([
    isActivePlatformAdmin(),
    refreshAndGetOrganizationSaasAccess(organizationId),
  ]);

  return resolveSaasAppRedirect({
    status: access.status,
    isOwner,
    isPlatformAdmin,
  });
}
