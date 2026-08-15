import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import {
  loginIdentifierToAuthEmails,
  loginKeyFromIdentifier,
} from "@/lib/auth/login-identifier";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD } from "@/lib/users/constants";

type AuthErrorLike = { message?: string; code?: string } | null;

export type EmployeeSignInResult =
  | { ok: true; userId: string }
  | { ok: false; error: AuthErrorLike };

function createProbeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Configuration Supabase manquante.");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function findEmployeeByLogin(loginKey: string): Promise<{
  userId: string;
  email: string | null;
  mustChangePassword: boolean;
} | null> {
  if (!isAdminClientConfigured() || !loginKey) {
    return null;
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, must_change_password")
    .eq("login_identifier_normalized", loginKey)
    .maybeSingle();

  if (!profile?.id) {
    return null;
  }

  const { data } = await admin.auth.admin.getUserById(profile.id);
  return {
    userId: profile.id,
    email: data.user?.email?.trim().toLowerCase() ?? null,
    mustChangePassword: Boolean(profile.must_change_password),
  };
}

export async function ensureEmployeeAuthReady(userId: string, password?: string) {
  if (!isAdminClientConfigured()) {
    return;
  }
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
    ban_duration: "none",
    ...(password ? { password } : {}),
  });
}

async function signInWithEmailPassword(email: string, password: string) {
  const probe = createProbeClient();
  return probe.auth.signInWithPassword({ email, password });
}

async function establishCookieSession(session: {
  access_token: string;
  refresh_token: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  return error;
}

async function bootstrapFirstLoginSession(email: string): Promise<EmployeeSignInResult> {
  if (!isAdminClientConfigured()) {
    return { ok: false, error: { message: "invalid_credentials" } };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const tokenHash = data.properties?.hashed_token;
  if (error || !tokenHash) {
    return { ok: false, error: error ?? { message: "invalid_credentials" } };
  }

  const supabase = await createClient();
  const { data: verified, error: otpError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  if (otpError || !verified.user) {
    return { ok: false, error: otpError ?? { message: "invalid_credentials" } };
  }

  if (verified.session) {
    await establishCookieSession(verified.session);
  }

  return { ok: true, userId: verified.user.id };
}

/**
 * Connexion employé : identifiant FasoBar + mot de passe.
 * Première connexion : FasoBar@11111, même si Auth a un e-mail interne.
 */
export async function signInEmployeeWithPassword(
  identifierOrEmail: string,
  password: string,
): Promise<EmployeeSignInResult> {
  const { isEmail, loginKey } = loginKeyFromIdentifier(identifierOrEmail);
  if (!loginKey || !password) {
    return {
      ok: false,
      error: { message: "invalid_credentials", code: "invalid_credentials" },
    };
  }

  const emails: string[] = [];
  let employee: Awaited<ReturnType<typeof findEmployeeByLogin>> = null;

  if (!isEmail) {
    employee = await findEmployeeByLogin(loginKey);
    if (employee?.email) {
      emails.push(employee.email);
    }
    for (const derived of loginIdentifierToAuthEmails(loginKey)) {
      if (!emails.includes(derived)) emails.push(derived);
    }
  } else {
    emails.push(loginKey);
  }

  let lastError: AuthErrorLike = null;

  for (const email of emails) {
    const { data, error } = await signInWithEmailPassword(email, password);
    if (!error && data.user && data.session) {
      const cookieError = await establishCookieSession(data.session);
      if (cookieError) {
        lastError = cookieError;
        continue;
      }
      return { ok: true, userId: data.user.id };
    }
    lastError = error;
  }

  const typedTemporaryPassword = password === DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD;
  if (employee && typedTemporaryPassword && employee.mustChangePassword) {
    await ensureEmployeeAuthReady(employee.userId, DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD);
    const email = employee.email ?? emails[0];
    if (email) {
      const retry = await signInWithEmailPassword(
        email,
        DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD,
      );
      if (!retry.error && retry.data.user && retry.data.session) {
        await establishCookieSession(retry.data.session);
        return { ok: true, userId: retry.data.user.id };
      }
      return bootstrapFirstLoginSession(email);
    }
  }

  return { ok: false, error: lastError };
}

export async function createEmployeeAuthUser(input: {
  loginNormalized: string;
  fullName: string;
}): Promise<{ userId: string; email: string } | { error: AuthErrorLike }> {
  const admin = createAdminClient();
  const authEmails = loginIdentifierToAuthEmails(input.loginNormalized);
  let created: { id: string; email?: string } | null = null;
  let createError: AuthErrorLike = null;

  for (const authEmail of authEmails) {
    const result = await admin.auth.admin.createUser({
      email: authEmail,
      password: DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName,
        login_identifier: input.loginNormalized,
      },
    });
    if (!result.error && result.data.user) {
      created = result.data.user;
      createError = null;
      break;
    }
    createError = result.error;
    const message = (result.error?.message ?? "").toLowerCase();
    const rejectedEmail =
      result.error?.code === "email_address_invalid" ||
      (message.includes("email address") && message.includes("invalid"));
    if (!rejectedEmail) {
      break;
    }
  }

  if (!created?.id) {
    return { error: createError };
  }

  await ensureEmployeeAuthReady(created.id, DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD);

  const { data: refreshed } = await admin.auth.admin.getUserById(created.id);
  const email = refreshed.user?.email ?? created.email ?? authEmails[0]!;

  return { userId: created.id, email };
}
