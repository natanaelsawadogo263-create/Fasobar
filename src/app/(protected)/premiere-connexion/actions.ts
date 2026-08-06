"use server";

import { redirect } from "next/navigation";

import { mapAuthError, mapGenericError } from "@/lib/auth/errors";
import { resolveHomePathForRoles } from "@/lib/auth/roles";
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
  if (!user?.id || !user.email) {
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
    return { error: mapAuthError(updateError) };
  }

  try {
    const admin = createAdminClient();
    const { error: completeError } = await admin.rpc(
      "finalize_employee_password_change",
      { p_user_id: sessionUserId },
    );

    if (completeError) {
      return { error: mapGenericError(completeError) };
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

  const { data: orgMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("user_id", sessionUserId)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();

  const { data: estMembership } = await supabase
    .from("establishment_memberships")
    .select("role")
    .eq("user_id", sessionUserId)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();

  redirect(
    resolveHomePathForRoles(
      orgMembership?.role ?? "ADMIN",
      estMembership?.role ?? orgMembership?.role ?? "ADMIN",
    ),
  );
}
