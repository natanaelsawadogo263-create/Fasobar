import "server-only";

import {
  normalizeLoginIdentifier,
  resolveSupabaseAuthEmails,
} from "@/lib/auth/login-identifier";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

/**
 * E-mails Auth à essayer pour une connexion identifiant FasoBar.
 * Priorité : e-mail réel du compte Auth (lookup admin), puis e-mails dérivés.
 */
export async function resolveEmployeeSignInEmails(
  identifierOrEmail: string,
): Promise<string[]> {
  const derived = resolveSupabaseAuthEmails(identifierOrEmail);
  const trimmed = identifierOrEmail.trim();
  if (trimmed.includes("@") || !isAdminClientConfigured()) {
    return derived;
  }

  try {
    const admin = createAdminClient();
    const normalized = normalizeLoginIdentifier(trimmed);
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("login_identifier_normalized", normalized)
      .maybeSingle();

    if (!profile?.id) {
      return derived;
    }

    const { data } = await admin.auth.admin.getUserById(profile.id);
    const email = data.user?.email?.trim().toLowerCase();
    if (!email) {
      return derived;
    }

    if (data.user && !data.user.email_confirmed_at) {
      await admin.auth.admin.updateUserById(profile.id, { email_confirm: true });
    }

    return [email, ...derived.filter((item) => item !== email)];
  } catch {
    return derived;
  }
}
