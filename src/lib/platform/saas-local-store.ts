import "server-only";

import { getLocalDatabase } from "@/lib/local-db/database";
import type { SqlDatabase } from "@/lib/local-db/types";
import type { PlatformAccessStatus } from "@/lib/platform/access";
import type { LocalSaasAuthorization } from "@/lib/platform/saas-authorization";
import { isPlatformAccessStatus } from "@/lib/platform/statuses";

function mapRow(row: Record<string, unknown> | undefined): LocalSaasAuthorization | null {
  if (!row) return null;
  const statusRaw = String(row.status ?? "");
  if (!isPlatformAccessStatus(statusRaw)) return null;
  return {
    organizationId: String(row.organization_id),
    status: statusRaw as PlatformAccessStatus,
    expiresAt:
      row.expires_at == null || row.expires_at === ""
        ? null
        : String(row.expires_at),
    recordedAt: String(row.recorded_at ?? ""),
  };
}

export function readLocalSaasAuthorization(
  organizationId: string,
  db: SqlDatabase = getLocalDatabase({ skipBackup: true }),
): LocalSaasAuthorization | null {
  try {
    const row = db
      .prepare(
        `SELECT organization_id, status, expires_at, recorded_at
         FROM local_saas_authorization
         WHERE organization_id = ?`,
      )
      .get(organizationId);
    return mapRow(row);
  } catch {
    return null;
  }
}

export function writeLocalSaasAuthorization(
  input: {
    organizationId: string;
    status: PlatformAccessStatus;
    expiresAt: string | null;
  },
  db: SqlDatabase = getLocalDatabase({ skipBackup: true }),
): void {
  const recordedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO local_saas_authorization (
      organization_id, status, expires_at, recorded_at, source
    ) VALUES (?, ?, ?, ?, 'cloud')
    ON CONFLICT(organization_id) DO UPDATE SET
      status = excluded.status,
      expires_at = excluded.expires_at,
      recorded_at = excluded.recorded_at,
      source = excluded.source`,
  ).run(input.organizationId, input.status, input.expiresAt, recordedAt);
}
