"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

import { mapAuthError, mapGenericError } from "@/lib/auth/errors";
import { toUserFacingError, USER_ERROR_MESSAGE } from "@/lib/errors/user-facing";
import { inviteSpaceToRole } from "@/lib/auth/roles";
import { createEmployeeAuthUser } from "@/lib/auth/employee-sign-in";
import { requireAdminMutationContext } from "@/lib/auth/workspace-context";
import { createClient } from "@/lib/supabase/server";
import { getCloudOfflineActionError } from "@/lib/desktop/require-cloud-online";
import { isInvitableSpaceAllowed } from "@/lib/settings/service-scope";
import {
  createEmployeeAccountSchema,
  deleteEmployeeAccountSchema,
  setMemberStatusSchema,
} from "@/lib/users/schemas";
import { resetTemporaryPasswordSchema } from "@/lib/users/password-policy";
import type { UsersActionState } from "@/lib/users/types";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const USERS_PATH = "/application/utilisateurs";

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function mapEmployeePurgeError(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  if (message.includes("propre compte")) {
    return "Vous ne pouvez pas supprimer votre propre compte.";
  }
  if (message.includes("propriétaire") || message.includes("proprietaire")) {
    return "Impossible de supprimer le compte propriétaire.";
  }
  if (message.includes("Permission insuffisante")) {
    return "Permission insuffisante pour supprimer cet employé.";
  }
  if (message.includes("motif")) {
    return "Le motif de suppression est obligatoire.";
  }
  if (message.includes("introuvable")) {
    return "Employé introuvable dans votre organisation.";
  }

  return toUserFacingError(message) === USER_ERROR_MESSAGE
    ? "Impossible de supprimer cet employé. Réessayez."
    : toUserFacingError(message);
}

async function removeEmployeeMemberships(params: {
  organizationId: string;
  userId: string;
}): Promise<{ error?: string }> {
  const userClient = await createClient();

  const { data: establishments, error: establishmentsError } = await userClient
    .from("establishments")
    .select("id")
    .eq("organization_id", params.organizationId);

  if (establishmentsError) {
    return { error: mapEmployeePurgeError(establishmentsError) };
  }

  const establishmentIds = (establishments ?? []).map((row) => row.id);
  const writer = isAdminClientConfigured() ? createAdminClient() : userClient;

  if (establishmentIds.length > 0) {
    const { error: establishmentMembershipError } = await writer
      .from("establishment_memberships")
      .delete()
      .eq("user_id", params.userId)
      .in("establishment_id", establishmentIds);

    if (establishmentMembershipError) {
      return { error: mapEmployeePurgeError(establishmentMembershipError) };
    }
  }

  const { error: organizationMembershipError } = await writer
    .from("organization_memberships")
    .delete()
    .eq("user_id", params.userId)
    .eq("organization_id", params.organizationId);

  if (organizationMembershipError) {
    return { error: mapEmployeePurgeError(organizationMembershipError) };
  }

  const { data: remaining } = await writer
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", params.userId)
    .limit(1);

  if (!remaining?.length && isAdminClientConfigured()) {
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({
        status: "INACTIVE",
      })
      .eq("id", params.userId);
  }

  return {};
}

async function disableEmployeeAuth(userId: string) {
  if (!isAdminClientConfigured()) {
    return;
  }

  try {
    const admin = createAdminClient();
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      await admin.auth.admin.updateUserById(userId, {
        ban_duration: "876600h",
        email: `deleted-${userId.slice(0, 8)}@users.fasobar.app`,
        email_confirm: true,
        password: `${randomUUID()}-Aa1!`,
      });
    }
  } catch {
    // Memberships already removed.
  }
}

export async function createEmployeeAccountAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const offlineError = await getCloudOfflineActionError();
  if (offlineError) {
    return { error: offlineError };
  }

  const workspace = await requireAdminMutationContext();

  const parsed = createEmployeeAccountSchema.safeParse({
    fullName: formData.get("fullName"),
    loginIdentifier: formData.get("loginIdentifier"),
    phone: formData.get("phone") || undefined,
    space: formData.get("space"),
    establishmentId: formData.get("establishmentId"),
    idempotencyKey: formData.get("idempotencyKey") || randomUUID(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (!isInvitableSpaceAllowed(parsed.data.space, workspace.serviceScope)) {
    return {
      error:
        "Cet espace employé n’est pas ouvert pour cet établissement. Modifiez les espaces dans Paramètres.",
    };
  }

  if (!isAdminClientConfigured()) {
    return {
      error:
        "Création de compte indisponible : configurez SUPABASE_SECRET_KEY côté serveur.",
    };
  }

  const supabase = await createClient();
  const { normalizeLoginIdentifier, withLoginIdentifierSuffix } = await import(
    "@/lib/auth/login-identifier"
  );

  let loginNormalized = normalizeLoginIdentifier(parsed.data.loginIdentifier);
  const role = inviteSpaceToRole(parsed.data.space);

  const { data: establishment } = await supabase
    .from("establishments")
    .select("id, organization_id")
    .eq("id", parsed.data.establishmentId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();

  if (!establishment) {
    return { error: "Établissement introuvable ou non autorisé." };
  }

  // Ensure unique login_identifier (retry with suffix if taken).
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate =
      attempt === 0
        ? loginNormalized
        : withLoginIdentifierSuffix(loginNormalized, randomUUID().slice(0, 4));
    const { data: existingLogin } = await supabase
      .from("profiles")
      .select("id")
      .eq("login_identifier_normalized", candidate)
      .maybeSingle();
    if (!existingLogin) {
      loginNormalized = candidate;
      break;
    }
    if (attempt === 5) {
      return { error: "Impossible de générer un identifiant FasoBar unique." };
    }
  }

  let createdUserId: string | null = null;

  try {
    const createdAuth = await createEmployeeAuthUser({
      loginNormalized,
      fullName: parsed.data.fullName,
    });

    if ("error" in createdAuth) {
      if ((createdAuth.error?.message ?? "").toLowerCase().includes("already")) {
        return { error: "Cet identifiant FasoBar est déjà utilisé." };
      }
      return { error: mapAuthError(createdAuth.error as never) };
    }

    createdUserId = createdAuth.userId;
    const admin = createAdminClient();

    const { error: provisionError } = await supabase.rpc("provision_employee_account", {
      p_user_id: createdUserId,
      p_organization_id: workspace.organizationId,
      p_establishment_id: parsed.data.establishmentId,
      p_role: role,
      p_full_name: parsed.data.fullName,
      p_phone: parsed.data.phone ?? null,
      p_created_by: workspace.userId,
      p_login_identifier: loginNormalized,
    });

    if (provisionError) {
      await admin.auth.admin.deleteUser(createdUserId);

      await supabase.rpc("log_employee_creation_compensated", {
        p_user_id: createdUserId,
        p_organization_id: workspace.organizationId,
        p_establishment_id: parsed.data.establishmentId,
        p_reason: provisionError.message,
      });

      return { error: mapGenericError(provisionError) };
    }
  } catch (error) {
    if (createdUserId) {
      try {
        const admin = createAdminClient();
        await admin.auth.admin.deleteUser(createdUserId);
        await supabase.rpc("log_employee_creation_compensated", {
          p_user_id: createdUserId,
          p_organization_id: workspace.organizationId,
          p_establishment_id: parsed.data.establishmentId,
          p_reason: error instanceof Error ? error.message : "Erreur inconnue",
        });
      } catch {
        // Compensation best-effort only.
      }
    }

    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible de créer le compte employé.",
    };
  }

  revalidatePath(USERS_PATH);
  return {
    success: "Compte employé créé avec succès.",
    userId: createdUserId ?? undefined,
    loginIdentifier: loginNormalized,
  };
}

export async function resetTemporaryPasswordAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const offlineError = await getCloudOfflineActionError();
  if (offlineError) {
    return { error: offlineError };
  }

  const workspace = await requireAdminMutationContext();

  const parsed = resetTemporaryPasswordSchema.safeParse({
    userId: formData.get("userId"),
    temporaryPassword: formData.get("temporaryPassword"),
    temporaryPasswordConfirmation: formData.get("temporaryPasswordConfirmation"),
    confirmed: parseCheckbox(formData.get("confirmed")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (!parsed.data.confirmed) {
    return { error: "Veuillez confirmer cette action." };
  }

  if (!isAdminClientConfigured()) {
    return { error: "Configuration serveur Supabase incomplète." };
  }

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("user_id, role")
    .eq("user_id", parsed.data.userId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();

  if (!membership) {
    return { error: "Employé introuvable dans votre organisation." };
  }

  if (membership.role === "OWNER") {
    return { error: "Impossible de réinitialiser le mot de passe d'un propriétaire." };
  }

  try {
    const admin = createAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(
      parsed.data.userId,
      { password: parsed.data.temporaryPassword },
    );

    if (updateError) {
      return { error: mapGenericError(updateError) };
    }

    const { error: markError } = await supabase.rpc("mark_temporary_password_reset", {
      p_target_user_id: parsed.data.userId,
    });

    if (markError) {
      return { error: mapGenericError(markError) };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Échec de la réinitialisation.",
    };
  }

  revalidatePath(USERS_PATH);
  return { success: "Mot de passe temporaire réinitialisé." };
}

export async function setMemberStatusAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const offlineError = await getCloudOfflineActionError();
  if (offlineError) {
    return { error: offlineError };
  }

  await requireAdminMutationContext();

  const parsed = setMemberStatusSchema.safeParse({
    userId: formData.get("userId"),
    active: formData.get("active") === "true",
    reason: formData.get("reason") || undefined,
    confirmed: parseCheckbox(formData.get("confirmed")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (!parsed.data.confirmed) {
    return { error: "Veuillez confirmer cette action." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("set_member_active_status", {
    p_target_user_id: parsed.data.userId,
    p_active: parsed.data.active,
    p_reason: parsed.data.reason ?? null,
  });

  if (error) {
    return { error: mapGenericError(error) };
  }

  if (parsed.data.active && isAdminClientConfigured()) {
    try {
      const admin = createAdminClient();
      await admin.auth.admin.updateUserById(parsed.data.userId, {
        ban_duration: "none",
      });
    } catch {
      // Réactivation métier déjà OK.
    }
  }

  revalidatePath(USERS_PATH);
  return {
    success: parsed.data.active ? "Compte réactivé." : "Compte désactivé.",
  };
}

export async function deleteEmployeeAccountAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const offlineError = await getCloudOfflineActionError();
  if (offlineError) {
    return { error: offlineError };
  }

  const workspace = await requireAdminMutationContext();

  const parsed = deleteEmployeeAccountSchema.safeParse({
    userId: formData.get("userId"),
    reason: formData.get("reason"),
    confirmed: parseCheckbox(formData.get("confirmed")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (!parsed.data.confirmed) {
    return { error: "Veuillez confirmer la suppression du compte." };
  }

  if (parsed.data.userId === workspace.userId) {
    return { error: "Vous ne pouvez pas supprimer votre propre compte." };
  }

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("user_id, role, status")
    .eq("user_id", parsed.data.userId)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();

  if (!membership) {
    return { error: "Employé introuvable dans votre organisation." };
  }

  if (membership.role === "OWNER") {
    return { error: "Impossible de supprimer le compte propriétaire." };
  }

  const { error: purgeError } = await supabase.rpc("purge_employee_account", {
    p_target_user_id: parsed.data.userId,
    p_reason: parsed.data.reason,
  });

  if (purgeError) {
    const mapped = mapEmployeePurgeError(purgeError);
    const isBusinessRule =
      mapped.includes("propre compte") ||
      mapped.includes("propriétaire") ||
      mapped.includes("Permission insuffisante") ||
      mapped.includes("motif de suppression") ||
      mapped.includes("introuvable");

    if (!isBusinessRule) {
      const fallback = await removeEmployeeMemberships({
        organizationId: workspace.organizationId,
        userId: parsed.data.userId,
      });
      if (!fallback.error) {
        await disableEmployeeAuth(parsed.data.userId);
        revalidatePath(USERS_PATH);
        return {
          success:
            "Employé supprimé définitivement. Il ne pourra plus se connecter.",
        };
      }
      return { error: fallback.error };
    }

    return { error: mapped };
  }

  await disableEmployeeAuth(parsed.data.userId);

  revalidatePath(USERS_PATH);
  return {
    success: "Employé supprimé définitivement. Il ne pourra plus se connecter.",
  };
}
