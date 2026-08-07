import "server-only";

import {
  isPlatformMachineStatus,
  type PlatformMachineStatus,
} from "@/lib/platform/access";
import { createClient } from "@/lib/supabase/server";

export type PlatformMachineRow = {
  id: string;
  organizationId: string;
  organizationName: string;
  establishmentId: string;
  establishmentName: string;
  deviceId: string;
  displayName: string | null;
  osName: string | null;
  appVersion: string | null;
  status: PlatformMachineStatus;
  activatedAt: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  blockedAt: string | null;
  blockedReason: string | null;
  createdAt: string;
};

export type PlatformMachinesResult = {
  machines: PlatformMachineRow[];
  error: string | null;
};

function isMissingTableError(message: string): boolean {
  return /Could not find the table|schema cache|does not exist|PGRST205/i.test(
    message,
  );
}

export async function listPlatformMachines(): Promise<PlatformMachinesResult> {
  try {
    const supabase = await createClient();

    const [machinesResult, orgsResult, establishmentsResult] = await Promise.all([
      supabase
        .from("registered_machines")
        .select(
          "id, organization_id, establishment_id, device_id, display_name, os_name, app_version, status, activated_at, last_seen_at, revoked_at, revoke_reason, blocked_at, blocked_reason, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("organizations").select("id, name"),
      supabase.from("establishments").select("id, name"),
    ]);

    if (machinesResult.error) {
      if (isMissingTableError(machinesResult.error.message)) {
        return { machines: [], error: null };
      }
      console.error(
        "[platform] listPlatformMachines:",
        machinesResult.error.message,
      );
      return { machines: [], error: machinesResult.error.message };
    }

    const orgById = new Map(
      (orgsResult.data ?? []).map((o) => [o.id, o] as const),
    );
    const estById = new Map(
      (establishmentsResult.data ?? []).map((e) => [e.id, e] as const),
    );

    const machines: PlatformMachineRow[] = (machinesResult.data ?? []).map(
      (row) => {
        const status = isPlatformMachineStatus(row.status)
          ? row.status
          : ("PENDING" as PlatformMachineStatus);

        return {
          id: row.id,
          organizationId: row.organization_id,
          organizationName:
            orgById.get(row.organization_id)?.name ?? "Organisation",
          establishmentId: row.establishment_id,
          establishmentName:
            estById.get(row.establishment_id)?.name ?? "Établissement",
          deviceId: row.device_id,
          displayName: row.display_name,
          osName: row.os_name,
          appVersion: row.app_version,
          status,
          activatedAt: row.activated_at,
          lastSeenAt: row.last_seen_at,
          revokedAt: row.revoked_at,
          revokeReason: row.revoke_reason,
          blockedAt: row.blocked_at,
          blockedReason: row.blocked_reason,
          createdAt: row.created_at,
        };
      },
    );

    return { machines, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inattendue.";
    console.error("[platform] listPlatformMachines failed:", error);
    return { machines: [], error: message };
  }
}
