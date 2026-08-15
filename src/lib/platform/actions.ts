"use server";

import { revalidatePath } from "next/cache";

import {
  mapRpcFailure,
  okResult,
  type PlatformActionResult,
} from "@/lib/platform/action-result";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { createProofSignedUrl } from "@/lib/platform/proof-storage";
import { createClient } from "@/lib/supabase/server";

async function callAdminRpc(
  name: string,
  params: Record<string, unknown>,
  revalidatePaths: string[] = [],
): Promise<PlatformActionResult> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc(name, params);

  if (error) {
    console.error(`[platform] ${name} failed:`, error.message);
    return mapRpcFailure(error.message);
  }

  for (const path of revalidatePaths) {
    revalidatePath(path);
  }

  return okResult();
}

export async function extendOrganizationTrialAction(input: {
  organizationId: string;
  extraDays: number;
  note?: string;
}): Promise<PlatformActionResult> {
  if (!Number.isFinite(input.extraDays) || input.extraDays <= 0) {
    return { ok: false, error: "Le nombre de jours doit être supérieur à 0." };
  }

  return callAdminRpc(
    "extend_organization_trial",
    {
      p_organization_id: input.organizationId,
      p_extra_days: Math.floor(input.extraDays),
      p_note: input.note?.trim() || null,
    },
    [
      `/platform/clients/${input.organizationId}`,
      "/platform/clients",
      "/platform",
    ],
  );
}

export async function reviewSubscriptionRequestAction(input: {
  requestId: string;
  note?: string;
}): Promise<PlatformActionResult> {
  return callAdminRpc(
    "review_subscription_request",
    {
      p_request_id: input.requestId,
      p_note: input.note?.trim() || null,
    },
    ["/platform/demandes-abonnement", "/platform"],
  );
}

export async function requestNewPaymentProofAction(input: {
  requestId: string;
  note?: string;
}): Promise<PlatformActionResult> {
  return callAdminRpc(
    "request_new_payment_proof",
    {
      p_request_id: input.requestId,
      p_note: input.note?.trim() || null,
    },
    ["/platform/demandes-abonnement", "/platform"],
  );
}

export async function approveSubscriptionPaymentAction(input: {
  requestId: string;
  note?: string;
}): Promise<PlatformActionResult> {
  return callAdminRpc(
    "approve_subscription_payment",
    {
      p_request_id: input.requestId,
      p_note: input.note?.trim() || null,
    },
    [
      "/platform/demandes-abonnement",
      "/platform/abonnements",
      "/platform",
      "/platform/clients",
    ],
  );
}

export async function rejectSubscriptionPaymentAction(input: {
  requestId: string;
  reason: string;
}): Promise<PlatformActionResult> {
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, error: "Le motif de refus est obligatoire." };
  }

  return callAdminRpc(
    "reject_subscription_payment",
    {
      p_request_id: input.requestId,
      p_reason: reason,
    },
    ["/platform/demandes-abonnement", "/platform"],
  );
}

export async function suspendClientOrganizationAction(input: {
  organizationId: string;
  reason: string;
}): Promise<PlatformActionResult> {
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, error: "Le motif de suspension est obligatoire." };
  }

  return callAdminRpc(
    "suspend_client_organization",
    {
      p_organization_id: input.organizationId,
      p_reason: reason,
    },
    [
      `/platform/clients/${input.organizationId}`,
      "/platform/clients",
      "/platform",
    ],
  );
}

export async function reactivateClientOrganizationAction(input: {
  organizationId: string;
  comment?: string;
}): Promise<PlatformActionResult> {
  return callAdminRpc(
    "reactivate_client_organization",
    {
      p_organization_id: input.organizationId,
      p_comment: input.comment?.trim() || null,
    },
    [
      `/platform/clients/${input.organizationId}`,
      "/platform/clients",
      "/platform",
    ],
  );
}

export async function scheduleClientDeletionAction(input: {
  organizationId: string;
  reason?: string;
}): Promise<PlatformActionResult> {
  return callAdminRpc(
    "schedule_client_deletion",
    {
      p_organization_id: input.organizationId,
      p_reason: input.reason?.trim() || null,
    },
    [
      `/platform/clients/${input.organizationId}`,
      "/platform/clients",
      "/platform",
    ],
  );
}

export async function restoreClientBeforeDeletionAction(input: {
  organizationId: string;
}): Promise<PlatformActionResult> {
  return callAdminRpc(
    "restore_client_before_deletion",
    { p_organization_id: input.organizationId },
    [
      `/platform/clients/${input.organizationId}`,
      "/platform/clients",
      "/platform",
    ],
  );
}

export async function purgeClientOrganizationAction(input: {
  organizationId: string;
  confirmationName: string;
}): Promise<PlatformActionResult> {
  const name = input.confirmationName.trim();
  if (!name) {
    return {
      ok: false,
      error: "Saisissez le nom exact de l'organisation pour confirmer.",
    };
  }

  return callAdminRpc(
    "purge_client_organization",
    {
      p_organization_id: input.organizationId,
      p_confirmation_name: name,
    },
    ["/platform/clients", "/platform"],
  );
}

export async function purgeClientOrganizationMemberAction(input: {
  organizationId: string;
  userId: string;
  reason: string;
}): Promise<PlatformActionResult> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    return { ok: false, error: "Le motif de suppression est obligatoire." };
  }

  const result = await callAdminRpc(
    "purge_org_member_as_platform",
    {
      p_organization_id: input.organizationId,
      p_target_user_id: input.userId,
      p_reason: reason,
    },
    [
      `/platform/clients/${input.organizationId}`,
      "/platform/clients",
    ],
  );

  if (!result.ok) {
    return result;
  }

  try {
    const { createAdminClient, isAdminClientConfigured } = await import(
      "@/lib/supabase/admin"
    );
    const { randomUUID } = await import("node:crypto");
    if (isAdminClientConfigured()) {
      const admin = createAdminClient();
      const { error: deleteAuthError } = await admin.auth.admin.deleteUser(
        input.userId,
      );
      if (deleteAuthError) {
        await admin.auth.admin.updateUserById(input.userId, {
          ban_duration: "876600h",
          email: `deleted-${input.userId.slice(0, 8)}@users.fasobar.app`,
          email_confirm: true,
          password: `${randomUUID()}-Aa1!`,
        });
      }
    }
  } catch {
    // Memberships already removed.
  }

  return result;
}

export async function deactivateClientOwnerAccountAction(input: {
  organizationId: string;
  reason: string;
}): Promise<PlatformActionResult> {
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, error: "Motif de désactivation obligatoire." };
  }

  return callAdminRpc(
    "deactivate_client_owner_account",
    {
      p_organization_id: input.organizationId,
      p_reason: reason,
    },
    [
      `/platform/clients/${input.organizationId}`,
      "/platform/clients",
      "/platform",
    ],
  );
}

export async function reactivateClientOwnerAccountAction(input: {
  organizationId: string;
  note?: string;
}): Promise<PlatformActionResult> {
  return callAdminRpc(
    "reactivate_client_owner_account",
    {
      p_organization_id: input.organizationId,
      p_note: input.note?.trim() || null,
    },
    [
      `/platform/clients/${input.organizationId}`,
      "/platform/clients",
      "/platform",
    ],
  );
}

export async function removePlatformAdminAction(input: {
  userId: string;
}): Promise<PlatformActionResult> {
  return callAdminRpc(
    "remove_platform_admin",
    { p_user_id: input.userId.trim() },
    ["/platform/super-admins", "/platform"],
  );
}

export async function revokeMachineAction(input: {
  machineId: string;
  reason?: string;
}): Promise<PlatformActionResult> {
  return callAdminRpc(
    "revoke_machine",
    {
      p_machine_id: input.machineId,
      p_reason: input.reason?.trim() || null,
    },
    ["/platform/machines", "/platform/clients"],
  );
}

export async function reactivateMachineAction(input: {
  machineId: string;
}): Promise<PlatformActionResult> {
  return callAdminRpc(
    "reactivate_machine",
    { p_machine_id: input.machineId },
    ["/platform/machines", "/platform/clients"],
  );
}

export async function updatePlatformSettingsAction(input: {
  orangeMoneyNumber?: string;
  currency?: string;
  trialDurationDays?: number;
  trialEnabled?: boolean;
  warningDaysBeforeExpiry?: number;
  offlineGraceDays?: number;
  deletionRecoveryDays?: number;
  subscriptionReferencePrefix?: string;
  paymentInstructions?: string | null;
  licenseMinAppVersion?: string | null;
}): Promise<PlatformActionResult> {
  const patch: Record<string, unknown> = {};

  if (input.orangeMoneyNumber !== undefined) {
    patch.orange_money_number = input.orangeMoneyNumber.trim();
  }
  if (input.currency !== undefined) {
    patch.currency = input.currency.trim();
  }
  if (input.trialDurationDays !== undefined) {
    const days = Math.floor(Number(input.trialDurationDays));
    if (!Number.isFinite(days) || days <= 0) {
      return {
        ok: false,
        error: "La durée d’essai doit être d’au moins 1 jour.",
      };
    }
    patch.trial_duration_days = days;
    // Compatibilité colonnes historiques (mois ≈ ceil jours / 30)
    patch.trial_duration_months = Math.max(1, Math.ceil(days / 30));
  }
  if (input.trialEnabled !== undefined) {
    patch.trial_enabled = input.trialEnabled;
  }
  if (input.warningDaysBeforeExpiry !== undefined) {
    patch.warning_days_before_expiry = input.warningDaysBeforeExpiry;
  }
  if (input.offlineGraceDays !== undefined) {
    patch.offline_grace_days = input.offlineGraceDays;
  }
  if (input.deletionRecoveryDays !== undefined) {
    patch.deletion_recovery_days = input.deletionRecoveryDays;
  }
  if (input.subscriptionReferencePrefix !== undefined) {
    patch.subscription_reference_prefix =
      input.subscriptionReferencePrefix.trim();
  }
  if (input.paymentInstructions !== undefined) {
    patch.payment_instructions = input.paymentInstructions;
  }
  if (input.licenseMinAppVersion !== undefined) {
    patch.license_min_app_version = input.licenseMinAppVersion;
  }

  return callAdminRpc(
    "update_platform_settings",
    { p_patch: patch },
    ["/platform/parametres", "/abonnement"],
  );
}

export async function addPlatformAdminAction(input: {
  userId: string;
}): Promise<PlatformActionResult> {
  if (!input.userId.trim()) {
    return { ok: false, error: "Identifiant utilisateur obligatoire." };
  }

  return callAdminRpc(
    "add_platform_admin",
    { p_user_id: input.userId.trim() },
    ["/platform/super-admins"],
  );
}

export async function setPlatformAdminStatusAction(input: {
  userId: string;
  status: "ACTIVE" | "INACTIVE";
}): Promise<PlatformActionResult> {
  return callAdminRpc(
    "set_platform_admin_status",
    {
      p_user_id: input.userId,
      p_status: input.status,
    },
    ["/platform/super-admins"],
  );
}

export async function updateSubscriptionPlanAdminAction(input: {
  planId: string;
  patch: {
    name?: string;
    description?: string | null;
    priceXof?: number;
    durationMonths?: number;
    maxMachines?: number;
    isActive?: boolean;
    sortOrder?: number;
    billingPeriod?: "MONTHLY" | "YEARLY";
  };
}): Promise<PlatformActionResult> {
  const patch: Record<string, unknown> = {};
  if (input.patch.name !== undefined) patch.name = input.patch.name;
  if (input.patch.description !== undefined) {
    patch.description = input.patch.description;
  }
  if (input.patch.priceXof !== undefined) patch.price_xof = input.patch.priceXof;
  if (input.patch.durationMonths !== undefined) {
    patch.duration_months = input.patch.durationMonths;
  }
  if (input.patch.maxMachines !== undefined) {
    patch.max_machines = input.patch.maxMachines;
  }
  if (input.patch.isActive !== undefined) patch.is_active = input.patch.isActive;
  if (input.patch.sortOrder !== undefined) {
    patch.sort_order = input.patch.sortOrder;
  }
  if (input.patch.billingPeriod !== undefined) {
    patch.billing_period = input.patch.billingPeriod;
  }

  return callAdminRpc(
    "update_subscription_plan_admin",
    {
      p_plan_id: input.planId,
      p_patch: patch,
    },
    ["/platform/parametres", "/platform/abonnements", "/abonnement"],
  );
}

export async function cancelOrganizationSubscriptionAction(input: {
  organizationId: string;
  reason?: string;
}): Promise<PlatformActionResult> {
  return callAdminRpc(
    "cancel_organization_subscription",
    {
      p_organization_id: input.organizationId,
      p_reason: input.reason?.trim() || null,
    },
    [
      `/platform/clients/${input.organizationId}`,
      "/platform/abonnements",
      "/platform",
    ],
  );
}

export async function getProofSignedUrlAction(input: {
  storagePath: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requirePlatformAdmin();
  const result = await createProofSignedUrl(input.storagePath);
  if (result.error || !result.url) {
    return { ok: false, error: result.error ?? "URL indisponible." };
  }
  return { ok: true, url: result.url };
}
