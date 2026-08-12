import "server-only";

export const MIGRATION_004_SQL = `-- SQLite schema v4 — cached SaaS authorization for desktop offline gate

CREATE TABLE IF NOT EXISTS local_saas_authorization (
  organization_id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL,
  expires_at TEXT,
  recorded_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'cloud'
);

CREATE INDEX IF NOT EXISTS idx_local_saas_authorization_expires
  ON local_saas_authorization(expires_at);
`;
