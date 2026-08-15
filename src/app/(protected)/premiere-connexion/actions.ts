"use server";

import { redirect } from "next/navigation";

import { mapAuthError, mapGenericError } from "@/lib/auth/errors";
import { redirectAfterLogin } from "@/lib/auth/post-login";
import { firstLoginPasswordSchema } from "@/lib/users/password-policy";
import {
  createAdminClient,
  isAdminClientConfigured,
  SupabaseAdminConfigError,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type FirstLoginActionState = {
  error?: string;
};

export async function completeFirstLoginAction(
  _prev: FirstLoginActionState,
  formData: FormData,
): Promise<FirstLoginActionState> {
  const parsed = firstLoginPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // user_id uniquement depuis la session serveur — jamais depuis le formulaire.
  // Les employés n'ont pas forcément un e-mail réel (identifiant FasoBar).
  if (!user?.id) {
    return { error: "Session expirée. Veuillez vous reconnecter." };
  }

  const sessionUserId = user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", sessionUserId)
    .maybeSingle();

  if (!profile?.must_change_password) {
    redirect("/application");
  }

  if (!isAdminClientConfigured()) {
    return {
      error:
        "Finalisation indisponible : configurez SUPABASE_SECRET_KEY côté serveur.",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (updateError) {
    if (!isAdminClientConfigured()) {
      return { error: mapAuthError(updateError) };
    }
    const admin = createAdminClient();
    const { error: adminPasswordError } = await admin.auth.admin.updateUserById(
      sessionUserId,
      { password: parsed.data.password, email_confirm: true, ban_duration: "none" },
    );
    if (adminPasswordError) {
      return { error: mapAuthError(adminPasswordError) };
    }
  }

  try {
    const admin = createAdminClient();
    const { data: finalizeData, error: completeError } = await admin.rpc(
      "finalize_employee_password_change",
      { p_user_id: sessionUserId },
    );

    if (completeError) {
      return { error: mapGenericError(completeError) };
    }

    const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
    if (isDesktopServerRuntime()) {
      const version = Number(
        (finalizeData as { credential_version?: number } | null)
          ?.credential_version ?? 1,
      );
      const { activateOfflineCredentialsAfterPasswordChange } = await import(
        "@/lib/local-auth/login"
      );
      await activateOfflineCredentialsAfterPasswordChange(
        sessionUserId,
        parsed.data.password,
        version,
      );
    }
  } catch (error) {
    if (error instanceof SupabaseAdminConfigError) {
      return { error: error.message };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible de finaliser le changement de mot de passe.",
    };
  }

  return redirectAfterLogin(sessionUserId);
}
