"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { mapAuthError } from "@/lib/auth/errors";
import {
  resetPasswordRequestSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/auth/schemas";
import { redirectAfterLogin } from "@/lib/auth/post-login";
import { getAuthRedirectOrigin } from "@/lib/auth/redirect-origin";
import type { AuthActionState } from "@/lib/auth/types";
import {
  isInternalFasoBarAuthEmail,
  resolveSupabaseAuthEmails,
} from "@/lib/auth/login-identifier";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function formDataToObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

async function signUpWithoutConfirmationEmail(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<AuthActionState> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
    },
  });

  if (error) {
    console.error("[signUp:admin]", error.code, error.message);
    return { error: mapAuthError(error) };
  }

  if (!data.user) {
    return { error: "Création du compte impossible. Veuillez réessayer." };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (signInError) {
    console.error("[signUp:signIn]", signInError.code, signInError.message);
    return {
      success:
        "Compte créé. Connectez-vous avec votre e-mail et votre mot de passe.",
    };
  }

  redirect("/onboarding");
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptTerms: formData.get("acceptTerms") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (!isAdminClientConfigured()) {
    return {
      error: "Création de compte indisponible. Réessayez plus tard.",
    };
  }

  return signUpWithoutConfirmationEmail({
    email: parsed.data.email,
    password: parsed.data.password,
    fullName: parsed.data.fullName,
  });
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");

  if (isDesktopServerRuntime()) {
    const identifier = String(
      formData.get("identifier") ?? formData.get("email") ?? "",
    ).trim();
    const password = String(formData.get("password") ?? "");

    const { desktopAuthenticate, syncEstablishmentUsersFromCloud } =
      await import("@/lib/local-auth/login");
    const result = await desktopAuthenticate(identifier, password);

    if (!result.ok) {
      return { error: result.error };
    }

    if (result.mustChangePassword) {
      redirect("/premiere-connexion");
    }

    try {
      const context = await (
        await import("@/lib/auth/workspace-context")
      ).getWorkspaceContext(result.userId);
      if (context && result.mode === "online") {
        await syncEstablishmentUsersFromCloud(context.establishmentId);
      }
    } catch {
      // Roster sync is best-effort; login already succeeded.
    }

    return redirectAfterLogin(result.userId);
  }

  const parsed = signInSchema.safeParse({
    identifier: String(
      formData.get("identifier") ?? formData.get("email") ?? "",
    ),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  let authEmails: string[];
  try {
    authEmails = resolveSupabaseAuthEmails(parsed.data.identifier);
  } catch {
    return { error: "Identifiant FasoBar invalide." };
  }

  const supabase = await createClient();
  let lastError: Awaited<
    ReturnType<typeof supabase.auth.signInWithPassword>
  >["error"] = null;
  let userId: string | null = null;

  for (const email of authEmails) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });
    if (!error && data.user) {
      userId = data.user.id;
      break;
    }
    lastError = error;
  }

  if (!userId) {
    return { error: mapAuthError(lastError) };
  }

  return redirectAfterLogin(userId);
}

export async function signOutAction(): Promise<void> {
  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    try {
      const { getLocalDatabase } = await import("@/lib/local-db/database");
      const {
        clearLocalSessionCookie,
        readLocalSessionTokenFromCookies,
        revokeLocalSession,
      } = await import("@/lib/local-auth/session");
      const token = await readLocalSessionTokenFromCookies();
      if (token) {
        revokeLocalSession(getLocalDatabase({ skipBackup: true }), token);
      }
      await clearLocalSessionCookie();
    } catch {
      // ignore local session cleanup errors
    }
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function generatePasswordRecoveryLinkAction(
  email: string,
): Promise<AuthActionState> {
  const parsed = resetPasswordRequestSchema.safeParse({ email });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (isInternalFasoBarAuthEmail(parsed.data.email)) {
    return {
      error:
        "Les comptes employés doivent passer par l'administrateur (Utilisateurs).",
    };
  }

  if (!isAdminClientConfigured()) {
    return {
      error: "Trop d'e-mails envoyés. Réessayez dans une heure.",
    };
  }

  const headerStore = await headers();
  const origin = getAuthRedirectOrigin(headerStore);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/nouveau-mot-de-passe")}`;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: parsed.data.email,
      options: { redirectTo },
    });

    if (error) {
      return { error: mapAuthError(error) };
    }

    const hashedToken = data.properties?.hashed_token;
    const link = hashedToken
      ? `${origin}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=recovery&next=${encodeURIComponent("/nouveau-mot-de-passe")}`
      : data.properties?.action_link;

    if (!link) {
      return { error: "Impossible de générer le lien." };
    }

    return { recoveryLink: link };
  } catch {
    return { error: "Trop d'e-mails envoyés. Réessayez dans une heure." };
  }
}

export async function updatePasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session expirée. Veuillez recommencer la procédure." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: mapAuthError(error) };
  }

  // Invalide les verifiers offline locaux (credential_version).
  const { error: bumpError } = await supabase.rpc("bump_own_credential_version");
  if (bumpError) {
    return {
      error:
        "Mot de passe mis à jour, mais la synchronisation des identifiants a échoué. Reconnectez-vous en ligne.",
    };
  }

  try {
    const cookieStore = await cookies();
    cookieStore.delete("fb_pw_recovery");
  } catch {
    // ignore
  }

  return redirectAfterLogin(user.id);
}
