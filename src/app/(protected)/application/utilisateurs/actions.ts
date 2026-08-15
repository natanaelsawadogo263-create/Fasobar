"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

import { mapAuthError, mapGenericError } from "@/lib/auth/errors";
import { inviteSpaceToRole } from "@/lib/auth/roles";
import { requireAdminMutationContext } from "@/lib/auth/workspace-context";
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
import { DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD } from "@/lib/users/constants";
import { createClient } from "@/lib/supabase/server";

const USERS_PATH = "/application/utilisateurs";

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
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
  const {
    loginIdentifierToAuthEmails,
    normalizeLoginIdentifier,
    withLoginIdentifierSuffix,
  } = await import("@/lib/auth/login-identifier");

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

  const authEmails = loginIdentifierToAuthEmails(loginNormalized);
  let createdUserId: string | null = null;

  try {
    const admin = createAdminClient();
    let created: { user: { id: string } | null } | null = null;
    let createError: { message: string; code?: string } | null = null;

    for (const authEmail of authEmails) {
      const result = await admin.auth.admin.createUser({
        email: authEmail,
        password: DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: parsed.data.fullName,
          login_identifier: loginNormalized,
        },
      });
      if (!result.error && result.data.user) {
        created = result.data;
        createError = null;
        break;
      }
      createError = result.error;
      const message = (result.error?.message ?? "").toLowerCase();
      const rejectedEmail =
        result.error?.code === "email_address_invalid" ||
        (message.includes("email address") && message.includes("invalid"));
      if (!rejectedEmail) break;
    }

    if (createError || !created?.user) {
      if ((createError?.message ?? "").toLowerCase().includes("already")) {
        return { error: "Cet identifiant FasoBar est déjà utilisé." };
      }

      return { error: mapAuthError(createError as never) };
    }

    createdUserId = created.user.id;

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

  // Soft-delete métier : accès retiré, historique (commandes, paiements) conservé.
  const { error: statusError } = await supabase.rpc("set_member_active_status", {
    p_target_user_id: parsed.data.userId,
    p_active: false,
    p_reason: parsed.data.reason,
  });

  if (statusError) {
    return { error: mapGenericError(statusError) };
  }

  if (isAdminClientConfigured()) {
    try {
      const admin = createAdminClient();
      const { error: deleteAuthError } = await admin.auth.admin.deleteUser(
        parsed.data.userId,
      );

      // Si des FK historiques bloquent la suppression Auth, on ban le compte.
      if (deleteAuthError) {
        await admin.auth.admin.updateUserById(parsed.data.userId, {
          ban_duration: "876600h",
        });
      }
    } catch {
      // Soft-delete métier déjà appliqué : ne pas faire échouer l'action.
    }
  }

  revalidatePath(USERS_PATH);
  return {
    success:
      "Compte employé supprimé (accès retiré). L'historique des ventes et commandes est conservé.",
  };
}
