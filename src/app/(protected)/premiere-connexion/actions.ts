"use server";

import { redirect } from "next/navigation";

import { mapAuthError } from "@/lib/auth/errors";
import { resolveHomePathForRoles } from "@/lib/auth/roles";
import { firstLoginPasswordSchema } from "@/lib/users/password-policy";
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

  if (!user?.email) {
    return { error: "Session expirée. Veuillez vous reconnecter." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.must_change_password) {
    redirect("/application");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (updateError) {
    return { error: mapAuthError(updateError) };
  }

  const { error: completeError } = await supabase.rpc("complete_password_change");

  if (completeError) {
    return { error: completeError.message };
  }

  const { data: orgMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();

  const { data: estMembership } = await supabase
    .from("establishment_memberships")
    .select("role")
    .eq("user_id", user.id)
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
