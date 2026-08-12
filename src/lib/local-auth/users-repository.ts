import "server-only";

import { normalizeLoginIdentifier } from "@/lib/auth/login-identifier";
import type { LocalPasswordVerifier } from "@/lib/local-auth/password-verifier";
import type { SqlDatabase } from "@/lib/local-db/types";

export type LocalUserRow = {
  id: string;
  organizationId: string;
  establishmentId: string;
  organizationName: string;
  establishmentName: string;
  loginIdentifier: string;
  loginIdentifierNormalized: string;
  displayName: string;
  role: string;
  status: string;
  credentialVersion: number;
  permissionsVersion: number;
  passwordSalt: string | null;
  passwordVerifier: string | null;
  passwordAlgorithm: string | null;
  lastCloudValidatedAt: string | null;
  lastLocalLoginAt: string | null;
  offlineCredentialsReady: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Roster fields synced from cloud (no password material). */
export type LocalUserRosterUpsert = {
  id: string;
  organizationId: string;
  establishmentId: string;
  organizationName: string;
  establishmentName: string;
  loginIdentifier: string;
  loginIdentifierNormalized?: string;
  displayName: string;
  role: string;
  status: string;
  credentialVersion: number;
  permissionsVersion: number;
  updatedAt?: string;
};

function mapLocalUserRow(row: Record<string, unknown>): LocalUserRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    establishmentId: String(row.establishment_id),
    organizationName: String(row.organization_name ?? ""),
    establishmentName: String(row.establishment_name ?? ""),
    loginIdentifier: String(row.login_identifier),
    loginIdentifierNormalized: String(row.login_identifier_normalized),
    displayName: String(row.display_name),
    role: String(row.role),
    status: String(row.status),
    credentialVersion: Number(row.credential_version ?? 0),
    permissionsVersion: Number(row.permissions_version ?? 1),
    passwordSalt: row.password_salt != null ? String(row.password_salt) : null,
    passwordVerifier:
      row.password_verifier != null ? String(row.password_verifier) : null,
    passwordAlgorithm:
      row.password_algorithm != null ? String(row.password_algorithm) : null,
    lastCloudValidatedAt:
      row.last_cloud_validated_at != null
        ? String(row.last_cloud_validated_at)
        : null,
    lastLocalLoginAt:
      row.last_local_login_at != null ? String(row.last_local_login_at) : null,
    offlineCredentialsReady: Number(row.offline_credentials_ready) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function findLocalUserByLoginNormalized(
  db: SqlDatabase,
  normalized: string,
): LocalUserRow | null {
  const row = db
    .prepare(
      `SELECT * FROM local_users WHERE login_identifier_normalized = ? LIMIT 1`,
    )
    .get(normalized);
  return row ? mapLocalUserRow(row) : null;
}

export function findLocalUserById(
  db: SqlDatabase,
  id: string,
): LocalUserRow | null {
  const row = db.prepare(`SELECT * FROM local_users WHERE id = ? LIMIT 1`).get(id);
  return row ? mapLocalUserRow(row) : null;
}

/**
 * Upsert roster metadata from cloud sync.
 * Never writes password fields unless cloud credential_version is newer
 * (in which case local verifier is cleared).
 */
export function upsertLocalUserRosterRow(
  db: SqlDatabase,
  row: LocalUserRosterUpsert,
): void {
  const now = new Date().toISOString();
  const normalized =
    row.loginIdentifierNormalized ??
    normalizeLoginIdentifier(row.loginIdentifier);
  const updatedAt = row.updatedAt ?? now;

  const existing = findLocalUserById(db, row.id);
  const cloudVersion = Number(row.credentialVersion);
  const credentialsInvalidated =
    existing != null && cloudVersion > existing.credentialVersion;

  if (!existing) {
    db.prepare(
      `INSERT INTO local_users (
        id, organization_id, establishment_id, organization_name, establishment_name,
        login_identifier, login_identifier_normalized, display_name, role, status,
        credential_version, permissions_version,
        password_salt, password_verifier, password_algorithm,
        last_cloud_validated_at, last_local_login_at, offline_credentials_ready,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 0, ?, ?)`,
    ).run(
      row.id,
      row.organizationId,
      row.establishmentId,
      row.organizationName,
      row.establishmentName,
      row.loginIdentifier,
      normalized,
      row.displayName,
      row.role,
      row.status,
      cloudVersion,
      Number(row.permissionsVersion),
      now,
      updatedAt,
    );
    return;
  }

  if (credentialsInvalidated) {
    db.prepare(
      `UPDATE local_users SET
        organization_id = ?,
        establishment_id = ?,
        organization_name = ?,
        establishment_name = ?,
        login_identifier = ?,
        login_identifier_normalized = ?,
        display_name = ?,
        role = ?,
        status = ?,
        credential_version = ?,
        permissions_version = ?,
        password_salt = NULL,
        password_verifier = NULL,
        password_algorithm = NULL,
        offline_credentials_ready = 0,
        updated_at = ?
       WHERE id = ?`,
    ).run(
      row.organizationId,
      row.establishmentId,
      row.organizationName,
      row.establishmentName,
      row.loginIdentifier,
      normalized,
      row.displayName,
      row.role,
      row.status,
      cloudVersion,
      Number(row.permissionsVersion),
      updatedAt,
      row.id,
    );
    return;
  }

  db.prepare(
    `UPDATE local_users SET
      organization_id = ?,
      establishment_id = ?,
      organization_name = ?,
      establishment_name = ?,
      login_identifier = ?,
      login_identifier_normalized = ?,
      display_name = ?,
      role = ?,
      status = ?,
      credential_version = ?,
      permissions_version = ?,
      updated_at = ?
     WHERE id = ?`,
  ).run(
    row.organizationId,
    row.establishmentId,
    row.organizationName,
    row.establishmentName,
    row.loginIdentifier,
    normalized,
    row.displayName,
    row.role,
    row.status,
    cloudVersion,
    Number(row.permissionsVersion),
    updatedAt,
    row.id,
  );
}

/**
 * Persist offline verifier after a successful cloud login (must_change_password = false).
 * Caller must not call this for temporary passwords.
 */
export function storeLocalPasswordVerifier(
  db: SqlDatabase,
  userId: string,
  verifier: LocalPasswordVerifier,
  credentialVersion: number,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE local_users SET
      password_salt = ?,
      password_verifier = ?,
      password_algorithm = ?,
      credential_version = ?,
      offline_credentials_ready = 1,
      last_cloud_validated_at = ?,
      updated_at = ?
     WHERE id = ?`,
  ).run(
    verifier.saltHex,
    verifier.verifierHex,
    verifier.algorithm,
    credentialVersion,
    now,
    now,
    userId,
  );
}

export function markLocalUserInactive(db: SqlDatabase, userId: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE local_users SET status = 'INACTIVE', updated_at = ? WHERE id = ?`,
  ).run(now, userId);
}

export function clearLocalPasswordVerifier(
  db: SqlDatabase,
  userId: string,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE local_users SET
      password_salt = NULL,
      password_verifier = NULL,
      password_algorithm = NULL,
      offline_credentials_ready = 0,
      updated_at = ?
     WHERE id = ?`,
  ).run(now, userId);
}

export function listActiveLocalUsersForEstablishment(
  db: SqlDatabase,
  establishmentId: string,
): LocalUserRow[] {
  const rows = db
    .prepare(
      `SELECT * FROM local_users
       WHERE establishment_id = ? AND status = 'ACTIVE'
       ORDER BY display_name COLLATE NOCASE`,
    )
    .all(establishmentId);
  return rows.map(mapLocalUserRow);
}

export function touchLocalUserLoginAt(db: SqlDatabase, userId: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE local_users SET last_local_login_at = ?, updated_at = ? WHERE id = ?`,
  ).run(now, now, userId);
}
