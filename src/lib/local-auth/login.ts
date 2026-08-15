import "server-only";

import { normalizeLoginIdentifier } from "@/lib/auth/login-identifier";
import { signInEmployeeWithPassword } from "@/lib/auth/employee-sign-in";
import { probeSupabaseReachable } from "@/lib/desktop/cloud-reachability";
import { appendDesktopLog } from "@/lib/desktop/logger";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import { GENERIC_AUTH_ERROR } from "@/lib/local-auth/constants";
import {
  createLocalPasswordVerifier,
  verifyLocalPassword,
} from "@/lib/local-auth/password-verifier";
import {
  isLoginRateLimited,
  recordLoginAttempt,
} from "@/lib/local-auth/rate-limit";
import {
  createLocalSession,
  revokeAllSessionsForUser,
  setLocalSessionCookie,
} from "@/lib/local-auth/session";
import {
  findLocalUserByLoginNormalized,
  storeLocalPasswordVerifier,
  touchLocalUserLoginAt,
  upsertLocalUserRosterRow,
  type LocalUserRosterUpsert,
} from "@/lib/local-auth/users-repository";
import { getLocalDatabase } from "@/lib/local-db/database";
import { createClient } from "@/lib/supabase/server";

export type DesktopLoginResult =
  | {
      ok: true;
      mode: "online" | "offline";
      userId: string;
      mustChangePassword: boolean;
      redirectHint?: string;
    }
  | { ok: false; error: string };

type NamedEntity = {
  id?: string;
  name: string;
};

const MEMBERSHIP_ROLE_PRIORITY = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "BAR_MANAGER",
  "CASHIER_KITCHEN",
  "CASHIER",
  "KITCHEN_MANAGER",
] as const;

function readRelatedEntity<T extends NamedEntity>(
  relation: T | T[] | null | undefined,
): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function membershipRoleRank(role: string): number {
  const index = MEMBERSHIP_ROLE_PRIORITY.indexOf(
    role as (typeof MEMBERSHIP_ROLE_PRIORITY)[number],
  );
  return index === -1 ? MEMBERSHIP_ROLE_PRIORITY.length : index;
}

function pickPreferredMembership<T extends { role: string }>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort(
    (a, b) => membershipRoleRank(a.role) - membershipRoleRank(b.role),
  )[0]!;
}

function normalizeDesktopLoginKey(identifier: string): string {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }
  return normalizeLoginIdentifier(trimmed);
}

function authFailure(): DesktopLoginResult {
  return { ok: false, error: GENERIC_AUTH_ERROR };
}

export async function desktopAuthenticate(
  identifier: string,
  password: string,
): Promise<DesktopLoginResult> {
  if (!isDesktopServerRuntime()) {
    return {
      ok: false,
      error: "Authentification locale disponible uniquement sur le serveur caisse.",
    };
  }

  const normalized = normalizeDesktopLoginKey(identifier);
  if (!normalized || !password) {
    return authFailure();
  }

  const db = getLocalDatabase({ skipBackup: true });

  if (isLoginRateLimited(db, normalized)) {
    appendDesktopLog("local-auth", "warn", "Login rate limited", {
      login: normalized,
    });
    return authFailure();
  }

  const cloudReachable = await probeSupabaseReachable();

  if (cloudReachable) {
    return authenticateOnline(db, identifier, normalized, password);
  }

  return await authenticateOffline(db, normalized, password);
}

async function authenticateOnline(
  db: ReturnType<typeof getLocalDatabase>,
  identifier: string,
  normalized: string,
  password: string,
): Promise<DesktopLoginResult> {
  const signIn = await signInEmployeeWithPassword(identifier, password);
  if (!signIn.ok) {
    recordLoginAttempt(db, normalized, false, "online");
    return authFailure();
  }
  const userId = signIn.userId;
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "status, must_change_password, credential_version, permissions_version, login_identifier, login_identifier_normalized, full_name",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile || profile.status !== "ACTIVE") {
    recordLoginAttempt(db, normalized, false, "online");
    return authFailure();
  }

  const { data: establishmentMemberships, error: establishmentError } =
    await supabase
      .from("establishment_memberships")
      .select(
        "role, status, establishment_id, establishments(id, name, organization_id, status)",
      )
      .eq("user_id", userId)
      .eq("status", "ACTIVE");

  if (establishmentError || !establishmentMemberships?.length) {
    recordLoginAttempt(db, normalized, false, "online");
    return authFailure();
  }

  const { data: organizationMemberships, error: organizationError } =
    await supabase
      .from("organization_memberships")
      .select("role, status, organization_id, organizations(id, name, status)")
      .eq("user_id", userId)
      .eq("status", "ACTIVE");

  if (organizationError || !organizationMemberships?.length) {
    recordLoginAttempt(db, normalized, false, "online");
    return authFailure();
  }

  const organizationMembership = pickPreferredMembership(organizationMemberships);
  if (!organizationMembership) {
    recordLoginAttempt(db, normalized, false, "online");
    return authFailure();
  }

  const organization = readRelatedEntity(
    organizationMembership.organizations as
      | (NamedEntity & { status?: string })
      | Array<NamedEntity & { status?: string }>
      | null,
  );

  if (!organization?.id || organization.status === "INACTIVE") {
    recordLoginAttempt(db, normalized, false, "online");
    return authFailure();
  }

  const establishmentCandidates = establishmentMemberships.filter((row) => {
    const establishment = readRelatedEntity(
      row.establishments as
        | (NamedEntity & { organization_id?: string; status?: string })
        | Array<NamedEntity & { organization_id?: string; status?: string }>
        | null,
    );
    return (
      establishment?.status !== "INACTIVE" &&
      establishment?.organization_id === organizationMembership.organization_id
    );
  });

  const establishmentMembership = pickPreferredMembership(establishmentCandidates);
  if (!establishmentMembership) {
    recordLoginAttempt(db, normalized, false, "online");
    return authFailure();
  }

  const establishment = readRelatedEntity(
    establishmentMembership.establishments as
      | (NamedEntity & { status?: string })
      | Array<NamedEntity & { status?: string }>
      | null,
  );

  if (!establishment?.id || !establishment.name || establishment.status === "INACTIVE") {
    recordLoginAttempt(db, normalized, false, "online");
    return authFailure();
  }

  const loginIdentifier =
    (profile.login_identifier as string | null)?.trim() ||
    normalizeLoginIdentifier(identifier) ||
    normalized;
  const loginNormalized =
    (profile.login_identifier_normalized as string | null)?.trim() ||
    normalizeLoginIdentifier(loginIdentifier) ||
    normalized;

  const mustChangePassword = Boolean(profile.must_change_password);
  const credentialVersion = Number(profile.credential_version ?? 1);
  const permissionsVersion = Number(profile.permissions_version ?? 1);

  upsertLocalUserRosterRow(db, {
    id: userId,
    organizationId: organizationMembership.organization_id,
    establishmentId: establishmentMembership.establishment_id,
    organizationName: organization.name,
    establishmentName: establishment.name,
    loginIdentifier,
    loginIdentifierNormalized: loginNormalized,
    displayName: (profile.full_name as string | null)?.trim() || loginIdentifier,
    role: establishmentMembership.role,
    status: "ACTIVE",
    credentialVersion,
    permissionsVersion,
  });

  if (!mustChangePassword) {
    const verifier = createLocalPasswordVerifier(password);
    storeLocalPasswordVerifier(db, userId, verifier, credentialVersion);
  }

  const { token, expiresAt } = createLocalSession(db, userId);
  await setLocalSessionCookie(token, expiresAt);
  touchLocalUserLoginAt(db, userId);
  recordLoginAttempt(db, normalized, true, "online");

  appendDesktopLog("local-auth", "info", "Online login success", {
    userId,
    mustChangePassword,
  });

  return {
    ok: true,
    mode: "online",
    userId,
    mustChangePassword,
    redirectHint: mustChangePassword ? "/premiere-connexion" : undefined,
  };
}

async function authenticateOffline(
  db: ReturnType<typeof getLocalDatabase>,
  normalized: string,
  password: string,
): Promise<DesktopLoginResult> {
  const user = findLocalUserByLoginNormalized(db, normalized);

  if (
    !user ||
    user.status !== "ACTIVE" ||
    !user.offlineCredentialsReady ||
    !user.passwordSalt ||
    !user.passwordVerifier
  ) {
    recordLoginAttempt(db, normalized, false, "offline");
    return authFailure();
  }

  const ok = verifyLocalPassword(
    password,
    user.passwordSalt,
    user.passwordVerifier,
    user.passwordAlgorithm ?? undefined,
  );

  if (!ok) {
    recordLoginAttempt(db, normalized, false, "offline");
    return authFailure();
  }

  const { token, expiresAt } = createLocalSession(db, user.id);
  await setLocalSessionCookie(token, expiresAt);
  touchLocalUserLoginAt(db, user.id);
  recordLoginAttempt(db, normalized, true, "offline");

  appendDesktopLog("local-auth", "info", "Offline login success", {
    userId: user.id,
  });

  return {
    ok: true,
    mode: "offline",
    userId: user.id,
    mustChangePassword: false,
  };
}

/**
 * After premiere-connexion password change: enable offline verifier.
 */
export async function activateOfflineCredentialsAfterPasswordChange(
  userId: string,
  password: string,
  credentialVersion: number,
): Promise<void> {
  if (!isDesktopServerRuntime()) {
    return;
  }

  const db = getLocalDatabase({ skipBackup: true });
  const verifier = createLocalPasswordVerifier(password);
  storeLocalPasswordVerifier(db, userId, verifier, credentialVersion);
  appendDesktopLog("local-auth", "info", "Offline credentials activated", {
    userId,
    credentialVersion,
  });
}

type CloudSyncUserRow = {
  user_id: string;
  organization_id: string;
  establishment_id: string;
  login_identifier: string | null;
  display_name: string | null;
  role: string;
  status: string;
  credential_version: number;
  permissions_version: number;
  must_change_password?: boolean;
  organization_name: string | null;
  establishment_name: string | null;
  updated_at?: string | null;
};

/**
 * Pull establishment roster from cloud and upsert local_users.
 * Revokes local sessions for users marked INACTIVE.
 */
export async function syncEstablishmentUsersFromCloud(
  establishmentId: string,
): Promise<{ upserted: number; inactivated: number }> {
  if (!isDesktopServerRuntime()) {
    throw new Error("Sync roster disponible uniquement sur le serveur caisse.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_establishment_users_for_sync", {
    p_establishment_id: establishmentId,
  });

  if (error) {
    appendDesktopLog("local-auth", "error", "Roster sync failed", {
      establishmentId,
      error: error.message,
    });
    throw new Error("Impossible de synchroniser les utilisateurs locaux.");
  }

  const db = getLocalDatabase({ skipBackup: true });
  const rows = (data ?? []) as CloudSyncUserRow[];
  let upserted = 0;
  let inactivated = 0;

  for (const row of rows) {
    const loginIdentifier = (row.login_identifier ?? "").trim();
    if (!loginIdentifier) {
      continue;
    }

    const roster: LocalUserRosterUpsert = {
      id: String(row.user_id),
      organizationId: String(row.organization_id),
      establishmentId: String(row.establishment_id),
      organizationName: (row.organization_name ?? "").trim(),
      establishmentName: (row.establishment_name ?? "").trim(),
      loginIdentifier,
      displayName: (row.display_name ?? loginIdentifier).trim() || loginIdentifier,
      role: String(row.role),
      status: String(row.status),
      credentialVersion: Number(row.credential_version ?? 1),
      permissionsVersion: Number(row.permissions_version ?? 1),
      updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    };

    upsertLocalUserRosterRow(db, roster);
    upserted += 1;

    if (roster.status !== "ACTIVE") {
      revokeAllSessionsForUser(db, roster.id);
      inactivated += 1;
    }
  }

  appendDesktopLog("local-auth", "info", "Roster sync complete", {
    establishmentId,
    upserted,
    inactivated,
  });

  return { upserted, inactivated };
}
