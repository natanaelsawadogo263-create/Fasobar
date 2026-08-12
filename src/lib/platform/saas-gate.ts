import "server-only";

import { cache } from "react";

import { probeSupabaseReachable } from "@/lib/desktop/cloud-reachability";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import { isActivePlatformAdmin } from "@/lib/platform/auth";
import {
  isBusinessAccessStatus,
  resolveSaasAppRedirect,
  type PlatformAccessStatus,
} from "@/lib/platform/access";
import {
  evaluateOfflineSaasAuthorization,
  isSaasAuthorizationGranted,
  normalizePlatformAccessStatus,
  reconcileCloudSaasAccess,
} from "@/lib/platform/saas-authorization";
import {
  readLocalSaasAuthorization,
  writeLocalSaasAuthorization,
} from "@/lib/platform/saas-local-store";
import { isPlatformAccessStatus } from "@/lib/platform/statuses";
import { createClient } from "@/lib/supabase/server";

export type OrganizationSaasAccess = {
  organizationId: string;
  status: PlatformAccessStatus;
  expiresAt: string | null;
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

function emptyAccess(
  organizationId: string,
  status: PlatformAccessStatus,
  expiresAt: string | null = null,
): OrganizationSaasAccess {
  return {
    organizationId,
    status,
    expiresAt,
    statusChangedAt: null,
    previousStatus: null,
    billingPhone: null,
    primaryOwnerUserId: null,
    deletionRequestedAt: null,
    deletionPurgeAfter: null,
  };
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
  reconciled?: { status: PlatformAccessStatus; expiresAt: string | null },
): OrganizationSaasAccess {
  // Never coerce a known status such as TRIAL into PENDING_CHOICE.
  const normalized = normalizePlatformAccessStatus(row?.status);
  const status: PlatformAccessStatus =
    reconciled?.status ?? normalized ?? "PENDING_CHOICE";

  const previousRaw = row?.previous_status ?? null;
  const previousStatus: PlatformAccessStatus | null =
    previousRaw && isPlatformAccessStatus(previousRaw) ? previousRaw : null;

  return {
    organizationId,
    status,
    expiresAt: reconciled?.expiresAt ?? null,
    statusChangedAt: row?.status_changed_at ?? null,
    previousStatus,
    billingPhone: row?.billing_phone ?? null,
    primaryOwnerUserId: row?.primary_owner_user_id ?? null,
    deletionRequestedAt: row?.deletion_requested_at ?? null,
    deletionPurgeAfter: row?.deletion_purge_after ?? null,
  };
}

function persistDesktopSaasAuthorization(access: OrganizationSaasAccess): void {
  if (!isDesktopServerRuntime()) return;
  try {
    writeLocalSaasAuthorization({
      organizationId: access.organizationId,
      status: access.status,
      expiresAt: access.expiresAt,
    });
  } catch (error) {
    console.error(
      "[platform] failed to persist local SaaS authorization:",
      error,
    );
  }
}

async function readCloudSaasEvidence(organizationId: string): Promise<{
  row: {
    status?: string | null;
    status_changed_at?: string | null;
    previous_status?: string | null;
    billing_phone?: string | null;
    primary_owner_user_id?: string | null;
    deletion_requested_at?: string | null;
    deletion_purge_after?: string | null;
  } | null;
  trial: { status: string; endsAt: string } | null;
  subscription: { status: string; endsAt: string } | null;
}> {
  const supabase = await createClient();

  const [stateResult, trialResult, subscriptionResult] = await Promise.all([
    supabase
      .from("organization_platform_states")
      .select(
        "organization_id, status, status_changed_at, previous_status, billing_phone, primary_owner_user_id, deletion_requested_at, deletion_purge_after",
      )
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("organization_trials")
      .select("status, ends_at")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("organization_subscriptions")
      .select("status, ends_at")
      .eq("organization_id", organizationId)
      .eq("is_current", true)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (stateResult.error) {
    console.error(
      "[platform] organization_platform_states read failed:",
      stateResult.error.message,
    );
  }
  if (trialResult.error) {
    console.error(
      "[platform] organization_trials read failed:",
      trialResult.error.message,
    );
  }
  if (subscriptionResult.error) {
    console.error(
      "[platform] organization_subscriptions read failed:",
      subscriptionResult.error.message,
    );
  }

  return {
    row: stateResult.data,
    trial: trialResult.data
      ? {
          status: String(trialResult.data.status),
          endsAt: String(trialResult.data.ends_at),
        }
      : null,
    subscription: subscriptionResult.data
      ? {
          status: String(subscriptionResult.data.status),
          endsAt: String(subscriptionResult.data.ends_at),
        }
      : null,
  };
}

async function readOrganizationPlatformState(
  organizationId: string,
): Promise<OrganizationSaasAccess> {
  const evidence = await readCloudSaasEvidence(organizationId);
  const reconciled = reconcileCloudSaasAccess({
    platformStatus: evidence.row?.status,
    trial: evidence.trial,
    subscription: evidence.subscription,
  });
  return mapPlatformStateRow(organizationId, evidence.row, reconciled);
}

function readOfflineOrganizationSaasAccess(
  organizationId: string,
): OrganizationSaasAccess {
  const local = readLocalSaasAuthorization(organizationId);
  const decision = evaluateOfflineSaasAuthorization(local);
  return emptyAccess(
    organizationId,
    decision.status,
    local?.expiresAt ?? null,
  );
}

/**
 * Lecture seule de l'état SaaS (sans RPC).
 * Suffisant pour navigations / redirections / bannières.
 */
export const getOrganizationSaasAccess = cache(
  async (organizationId: string): Promise<OrganizationSaasAccess> => {
    if (isDesktopServerRuntime()) {
      const reachable = await probeSupabaseReachable();
      if (!reachable) {
        return readOfflineOrganizationSaasAccess(organizationId);
      }
    }

    const access = await readOrganizationPlatformState(organizationId);
    persistDesktopSaasAuthorization(access);
    return access;
  },
);

/**
 * Rafraîchit l'état SaaS (RPC) puis lit l'état cloud.
 * Réserver aux pages / actions abonnement et au post-login — pas à chaque navigation.
 */
export const refreshAndGetOrganizationSaasAccess = cache(
  async (organizationId: string): Promise<OrganizationSaasAccess> => {
    if (isDesktopServerRuntime()) {
      const reachable = await probeSupabaseReachable();
      if (!reachable) {
        return readOfflineOrganizationSaasAccess(organizationId);
      }
    }

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
    }

    const access = await readOrganizationPlatformState(organizationId);
    persistDesktopSaasAuthorization(access);
    return access;
  },
);

/** Lève une erreur si l'org n'a pas d'accès métier (TRIAL/ACTIVE). */
export async function assertOrganizationBusinessAccess(
  organizationId: string,
): Promise<OrganizationSaasAccess> {
  const access = await getOrganizationSaasAccess(organizationId);
  if (
    !isSaasAuthorizationGranted(access.status, access.expiresAt) ||
    !isBusinessAccessStatus(access.status)
  ) {
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
  const access = await getOrganizationSaasAccess(organizationId);
  if (!isSaasAuthorizationGranted(access.status, access.expiresAt)) {
    return BUSINESS_ACCESS_DENIED;
  }
  return null;
}

/**
 * Redirection SaaS pour un utilisateur dans le contexte d'une organisation.
 */
export async function getSaasRedirectForUser(
  _userId: string,
  organizationId: string,
  isOwner: boolean,
): Promise<string | null> {
  const [isPlatformAdmin, access] = await Promise.all([
    isActivePlatformAdmin(),
    getOrganizationSaasAccess(organizationId),
  ]);

  if (
    isPlatformAdmin ||
    isSaasAuthorizationGranted(access.status, access.expiresAt)
  ) {
    return null;
  }

  return resolveSaasAppRedirect({
    status: access.status,
    isOwner,
    isPlatformAdmin,
  });
}
