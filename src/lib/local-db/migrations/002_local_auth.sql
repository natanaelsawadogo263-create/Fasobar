-- SQLite schema v2 — local identity / auth (Desktop Phase 3A)
-- Idempotent ALTER-style via recreate pattern for local_users expansion.

CREATE TABLE IF NOT EXISTS local_users_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  organization_name TEXT NOT NULL DEFAULT '',
  establishment_name TEXT NOT NULL DEFAULT '',
  login_identifier TEXT NOT NULL,
  login_identifier_normalized TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  credential_version INTEGER NOT NULL DEFAULT 0,
  permissions_version INTEGER NOT NULL DEFAULT 1,
  password_salt TEXT,
  password_verifier TEXT,
  password_algorithm TEXT,
  last_cloud_validated_at TEXT,
  last_local_login_at TEXT,
  offline_credentials_ready INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS local_users_login_norm_uidx
  ON local_users_v2 (login_identifier_normalized);

CREATE INDEX IF NOT EXISTS local_users_establishment_idx
  ON local_users_v2 (establishment_id, status);

-- Migrate legacy placeholder rows if any
INSERT OR IGNORE INTO local_users_v2 (
  id, organization_id, establishment_id, organization_name, establishment_name,
  login_identifier, login_identifier_normalized, display_name, role, status,
  credential_version, permissions_version, offline_credentials_ready,
  created_at, updated_at
)
SELECT
  id,
  organization_id,
  establishment_id,
  '',
  '',
  lower(replace(full_name, ' ', '.')),
  lower(replace(full_name, ' ', '.')),
  full_name,
  role,
  status,
  0,
  1,
  0,
  COALESCE(last_synced_at, datetime('now')),
  COALESCE(last_synced_at, datetime('now'))
FROM local_users
WHERE NOT EXISTS (SELECT 1 FROM local_users_v2 lu WHERE lu.id = local_users.id);

DROP TABLE IF EXISTS local_users;
ALTER TABLE local_users_v2 RENAME TO local_users;

CREATE TABLE IF NOT EXISTS local_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent TEXT,
  ip_hint TEXT
);

CREATE INDEX IF NOT EXISTS local_sessions_user_idx
  ON local_sessions (user_id, revoked_at);

CREATE INDEX IF NOT EXISTS local_sessions_expires_idx
  ON local_sessions (expires_at);

CREATE TABLE IF NOT EXISTS local_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login_identifier_normalized TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'unknown'
);

CREATE INDEX IF NOT EXISTS local_login_attempts_lookup_idx
  ON local_login_attempts (login_identifier_normalized, attempted_at);
