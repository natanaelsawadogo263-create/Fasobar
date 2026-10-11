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
import { isInternalFasoBarAuthEmail } from "@/lib/auth/login-identifier";
import { signInEmployeeWithPassword } from "@/lib/auth/employee-sign-in";
import { checkEmailDeliverability } from "@/lib/auth/email-deliverability";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import {
  TENANT_ESTABLISHMENT_COOKIE,
  TENANT_ORGANIZATION_COOKIE,
} from "@/lib/auth/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  getClientIp,
  isRateLimited,
  RATE_LIMIT_MESSAGE,
  recordRateLimitHit,
  type RateLimitRule,
} from "@/lib/security/rate-limit";

const FIFTEEN_MINUTES = 15 * 60;

/** Échecs de connexion : par identifiant (anti-brute-force ciblé) et par IP. */
function signInRateLimitRules(identifier: string, ip: string): RateLimitRule[] {
  return [
    { scope: "login:id", key: identifier, max: 10, windowSeconds: FIFTEEN_MINUTES },
    { scope: "login:ip", key: ip, max: 50, windowSeconds: FIFTEEN_MINUTES },
  ];
}

function formDataToObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

/**
 * Inscription propriétaire avec confirmation obligatoire de l'e-mail :
 * Supabase envoie un lien, le compte ne peut pas se connecter avant le clic.
 * (Prérequis Supabase : Authentication → Email → « Confirm email » activé.)
 */
async function signUpWithEmailConfirmation(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<AuthActionState> {
  const headerStore = await headers();
  const origin = getAuthRedirectOrigin(headerStore);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?flow=signup`,
      data: {
        full_name: input.fullName,
      },
    },
  });

  if (error) {
    console.error("[signUp]", error.code, error.message);
    return { error: mapAuthError(error) };
  }

  if (data.session) {
    // Le projet Supabase confirme automatiquement les e-mails : la
    // vérification n'a pas eu lieu. On laisse passer pour ne pas bloquer les
    // inscriptions, mais c'est une erreur de configuration à corriger.
    console.error(
      "[signUp] « Confirm email » est désactivé dans Supabase : adresse non vérifiée.",
    );
    redirect("/onboarding");
  }

  // Message identique que l'adresse soit nouvelle ou déjà inscrite
  // (Supabase ne révèle pas les comptes existants).
  return {
    success: `Un e-mail de confirmation a été envoyé à ${input.email}. Cliquez sur le lien qu'il contient pour activer votre compte, puis connectez-vous.`,
    pendingConfirmationEmail: input.email,
  };
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

  // Anti-création massive de comptes : 10 inscriptions / heure / IP.
  const signUpRules: RateLimitRule[] = [
    { scope: "signup:ip", key: await getClientIp(), max: 10, windowSeconds: 60 * 60 },
  ];
  if (await isRateLimited(signUpRules)) {
    return { error: RATE_LIMIT_MESSAGE };
  }
  await recordRateLimitHit(signUpRules);

  const deliverability = await checkEmailDeliverability(parsed.data.email);
  if (!deliverability.ok) {
    return { error: deliverability.error };
  }

  return signUpWithEmailConfirmation({
    email: parsed.data.email,
    password: parsed.data.password,
    fullName: parsed.data.fullName,
  });
}

/** Renvoie l'e-mail de confirmation d'inscription (limité anti-abus). */
export async function resendSignUpConfirmationAction(
  email: string,
): Promise<AuthActionState> {
  const parsed = resetPasswordRequestSchema.safeParse({ email });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Adresse e-mail invalide." };
  }

  const resendRules: RateLimitRule[] = [
    { scope: "signup-resend:email", key: parsed.data.email, max: 3, windowSeconds: 60 * 60 },
    { scope: "signup-resend:ip", key: await getClientIp(), max: 10, windowSeconds: 60 * 60 },
  ];
  if (await isRateLimited(resendRules)) {
    return { error: RATE_LIMIT_MESSAGE };
  }
  await recordRateLimitHit(resendRules);

  const headerStore = await headers();
  const origin = getAuthRedirectOrigin(headerStore);
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback?flow=signup` },
  });

  if (error) {
    console.error("[signUp:resend]", error.code, error.message);
    return { error: mapAuthError(error) };
  }

  return { success: "E-mail de confirmation renvoyé. Pensez à vérifier vos spams." };
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

  const rateLimitRules = signInRateLimitRules(
    parsed.data.identifier,
    await getClientIp(),
  );
  if (await isRateLimited(rateLimitRules)) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  const result = await signInEmployeeWithPassword(
    parsed.data.identifier,
    parsed.data.password,
  );

  if (!result.ok) {
    await recordRateLimitHit(rateLimitRules);
    return { error: mapAuthError(result.error as never) };
  }

  return redirectAfterLogin(result.userId);
}

export async function signOutAction(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(TENANT_ORGANIZATION_COOKIE);
    cookieStore.delete(TENANT_ESTABLISHMENT_COOKIE);
  } catch {
    // ignore
  }

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

  // Sécurité : le lien de récupération donne un accès complet au compte.
  // Il ne doit JAMAIS être remis à un appelant anonyme (sinon n'importe qui
  // connaissant un e-mail prend le contrôle du compte). Autorisé uniquement :
  // - en développement local (`next dev`) ;
  // - à un utilisateur connecté, pour son propre e-mail.
  const isLocalDevelopment = process.env.NODE_ENV === "development";
  if (!isLocalDevelopment) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const sessionEmail = user?.email?.trim().toLowerCase();
    if (!sessionEmail || sessionEmail !== parsed.data.email.trim().toLowerCase()) {
      return {
        error: "Trop d'e-mails envoyés. Réessayez dans une heure.",
      };
    }
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
