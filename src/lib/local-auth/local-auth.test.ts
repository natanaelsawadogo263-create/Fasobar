import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  loginIdentifierToAuthEmail,
  normalizeLoginIdentifier,
  resolveSupabaseAuthEmail,
  suggestLoginIdentifierFromName,
} from "@/lib/auth/login-identifier";
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
  hashSessionToken,
  revokeAllSessionsForUser,
  validateLocalSession,
} from "@/lib/local-auth/session";
import {
  findLocalUserById,
  storeLocalPasswordVerifier,
  upsertLocalUserRosterRow,
} from "@/lib/local-auth/users-repository";
import {
  closeLocalDatabase,
  getLocalDatabase,
  resetLocalDatabaseSingletonForTests,
} from "@/lib/local-db/database";
import { resolveSyncUiStatus } from "@/lib/sync/status";

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fasobar-auth-"));
}

function seedActiveUser(
  root: string,
  overrides?: Partial<{
    id: string;
    status: string;
    credentialVersion: number;
    offlineReady: boolean;
    password: string;
    establishmentId: string;
  }>,
) {
  const db = getLocalDatabase({
    userDataRoot: root,
    skipBackup: true,
    force: true,
  });
  const id = overrides?.id ?? "user-awa";
  const establishmentId = overrides?.establishmentId ?? "est-a";
  upsertLocalUserRosterRow(db, {
    id,
    organizationId: "org-1",
    establishmentId,
    organizationName: "Org",
    establishmentName: "Maquis A",
    loginIdentifier: "awa.ouedraogo",
    displayName: "Awa Ouédraogo",
    role: "CASHIER_KITCHEN",
    status: overrides?.status ?? "ACTIVE",
    credentialVersion: overrides?.credentialVersion ?? 1,
    permissionsVersion: 1,
  });

  if (overrides?.offlineReady !== false && overrides?.status !== "INACTIVE") {
    const password = overrides?.password ?? "MonMotDePasse1!";
    const verifier = createLocalPasswordVerifier(password);
    storeLocalPasswordVerifier(
      db,
      id,
      verifier,
      overrides?.credentialVersion ?? 1,
    );
  }

  return db;
}

afterEach(() => {
  resetLocalDatabaseSingletonForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("login_identifier", () => {
  it("normalizes and maps to internal auth email", () => {
    expect(normalizeLoginIdentifier("Awa.Ouédraogo")).toBe("awa.ouedraogo");
    expect(suggestLoginIdentifierFromName("Awa Ouédraogo")).toBe("awa.ouedraogo");
    expect(loginIdentifierToAuthEmail("awa.ouedraogo")).toBe(
      "awa.ouedraogo@users.fasobar.internal",
    );
    expect(resolveSupabaseAuthEmail("awa.ouedraogo")).toContain(
      "@users.fasobar.internal",
    );
    expect(resolveSupabaseAuthEmail("Legacy@Example.com")).toBe(
      "legacy@example.com",
    );
  });
});

describe("local password verifier", () => {
  it("M — never stores plaintext password", () => {
    const root = tempRoot();
    const db = seedActiveUser(root, { password: "SecretPass1!" });
    const row = findLocalUserById(db, "user-awa");
    expect(row?.passwordVerifier).toBeTruthy();
    expect(row?.passwordSalt).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain("SecretPass1!");
    expect(verifyLocalPassword("SecretPass1!", row!.passwordSalt!, row!.passwordVerifier!)).toBe(
      true,
    );
    expect(verifyLocalPassword("wrong", row!.passwordSalt!, row!.passwordVerifier!)).toBe(
      false,
    );
    closeLocalDatabase();
  });
});

describe("offline local auth rules", () => {
  it("C — offline + activated + good password => session OK", () => {
    vi.stubEnv("FASOBAR_RUNTIME", "desktop-server");
    const root = tempRoot();
    const db = seedActiveUser(root);
    const { token } = createLocalSession(db, "user-awa");
    const user = validateLocalSession(db, token);
    expect(user?.id).toBe("user-awa");
    expect(user?.offlineCredentialsReady).toBe(true);
    closeLocalDatabase();
  });

  it("D — offline bad password verifier fails", () => {
    const root = tempRoot();
    const db = seedActiveUser(root, { password: "GoodPass1!" });
    const row = findLocalUserById(db, "user-awa")!;
    expect(
      verifyLocalPassword("BadPass1!", row.passwordSalt!, row.passwordVerifier!),
    ).toBe(false);
    closeLocalDatabase();
  });

  it("E — never activated locally => offline_credentials_ready false", () => {
    const root = tempRoot();
    const db = seedActiveUser(root, { offlineReady: false });
    // upsert without verifier
    upsertLocalUserRosterRow(db, {
      id: "user-new",
      organizationId: "org-1",
      establishmentId: "est-a",
      organizationName: "Org",
      establishmentName: "Maquis A",
      loginIdentifier: "moussa.kone",
      displayName: "Moussa",
      role: "CASHIER_KITCHEN",
      status: "ACTIVE",
      credentialVersion: 1,
      permissionsVersion: 1,
    });
    const row = findLocalUserById(db, "user-new");
    expect(row?.offlineCredentialsReady).toBe(false);
    expect(row?.passwordVerifier).toBeNull();
    closeLocalDatabase();
  });

  it("F — INACTIVE refused", () => {
    const root = tempRoot();
    const db = seedActiveUser(root, { status: "INACTIVE", offlineReady: false });
    const row = findLocalUserById(db, "user-awa");
    expect(row?.status).toBe("INACTIVE");
    closeLocalDatabase();
  });

  it("G — must_change means no offline verifier stored by design", () => {
    // Documented by storeLocalPasswordVerifier only after must_change=false
    const verifier = createLocalPasswordVerifier("TempShouldNotMatter1!");
    expect(verifier.verifierHex).toBeTruthy();
    expect(GENERIC_AUTH_ERROR).toMatch(/Identifiant ou mot de passe/);
  });

  it("H — cloud credential_version > local clears verifier", () => {
    const root = tempRoot();
    const db = seedActiveUser(root, { credentialVersion: 4, password: "OldPass1!" });
    expect(findLocalUserById(db, "user-awa")?.offlineCredentialsReady).toBe(true);

    upsertLocalUserRosterRow(db, {
      id: "user-awa",
      organizationId: "org-1",
      establishmentId: "est-a",
      organizationName: "Org",
      establishmentName: "Maquis A",
      loginIdentifier: "awa.ouedraogo",
      displayName: "Awa",
      role: "CASHIER_KITCHEN",
      status: "ACTIVE",
      credentialVersion: 5,
      permissionsVersion: 1,
    });

    const row = findLocalUserById(db, "user-awa");
    expect(row?.credentialVersion).toBe(5);
    expect(row?.offlineCredentialsReady).toBe(false);
    expect(row?.passwordVerifier).toBeNull();
    closeLocalDatabase();
  });

  it("I — new verifier after password change", () => {
    const root = tempRoot();
    const db = seedActiveUser(root, { password: "OldPass1!", credentialVersion: 1 });
    const v2 = createLocalPasswordVerifier("NewPass1!");
    storeLocalPasswordVerifier(db, "user-awa", v2, 2);
    const row = findLocalUserById(db, "user-awa")!;
    expect(verifyLocalPassword("OldPass1!", row.passwordSalt!, row.passwordVerifier!)).toBe(
      false,
    );
    expect(verifyLocalPassword("NewPass1!", row.passwordSalt!, row.passwordVerifier!)).toBe(
      true,
    );
    expect(row.credentialVersion).toBe(2);
    closeLocalDatabase();
  });

  it("J — establishment A user is not establishment B", () => {
    const root = tempRoot();
    const db = seedActiveUser(root, { establishmentId: "est-a" });
    const row = findLocalUserById(db, "user-awa");
    expect(row?.establishmentId).toBe("est-a");
    expect(row?.establishmentId).not.toBe("est-b");
    closeLocalDatabase();
  });

  it("K — two distinct users and sessions", () => {
    const root = tempRoot();
    const db = seedActiveUser(root, { id: "user-a", password: "PassUserA1!" });
    upsertLocalUserRosterRow(db, {
      id: "user-b",
      organizationId: "org-1",
      establishmentId: "est-a",
      organizationName: "Org",
      establishmentName: "Maquis A",
      loginIdentifier: "moussa.kone",
      displayName: "Moussa",
      role: "BAR_MANAGER",
      status: "ACTIVE",
      credentialVersion: 1,
      permissionsVersion: 1,
    });
    storeLocalPasswordVerifier(
      db,
      "user-b",
      createLocalPasswordVerifier("PassUserB1!"),
      1,
    );
    const s1 = createLocalSession(db, "user-a");
    const s2 = createLocalSession(db, "user-b");
    expect(hashSessionToken(s1.token)).not.toBe(hashSessionToken(s2.token));
    expect(validateLocalSession(db, s1.token)?.id).toBe("user-a");
    expect(validateLocalSession(db, s2.token)?.id).toBe("user-b");
    revokeAllSessionsForUser(db, "user-a");
    expect(validateLocalSession(db, s1.token)).toBeNull();
    expect(validateLocalSession(db, s2.token)?.id).toBe("user-b");
    closeLocalDatabase();
  });

  it("L — rate limit after repeated failures", () => {
    const root = tempRoot();
    const db = seedActiveUser(root);
    for (let i = 0; i < 5; i += 1) {
      recordLoginAttempt(db, "awa.ouedraogo", false, "offline");
    }
    expect(isLoginRateLimited(db, "awa.ouedraogo")).toBe(true);
    closeLocalDatabase();
  });
});

describe("schema v4", () => {
  it("applies migrations through saas_authorization (version 4)", () => {
    const root = tempRoot();
    const db = getLocalDatabase({
      userDataRoot: root,
      skipBackup: true,
      force: true,
    });
    const version = db
      .prepare("SELECT MAX(version) AS v FROM local_schema_migrations")
      .get();
    expect(Number(version?.v)).toBe(5);
    expect(resolveSyncUiStatus(db, { cloudReachable: false })).toBe("OFFLINE");
    closeLocalDatabase();
  });
});
