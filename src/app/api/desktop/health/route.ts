import { NextResponse } from "next/server";

import { getDesktopAppVersionFromEnv, isDesktopServerRuntime } from "@/lib/desktop/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = {
    status: "ok" as const,
    app: "FasoBar" as const,
    version: getDesktopAppVersionFromEnv(),
    mode: "desktop" as const,
    runtime: isDesktopServerRuntime() ? ("desktop-server" as const) : ("web" as const),
  };

  if (!isDesktopServerRuntime()) {
    return NextResponse.json(base);
  }

  try {
    const [
      { getLocalDatabase, getLocalDbHealth },
      { expectedSchemaVersion },
      { resolveSyncUiStatus },
      { probeSupabaseReachable },
    ] = await Promise.all([
      import("@/lib/local-db/database"),
      import("@/lib/local-db/migrations"),
      import("@/lib/sync/status"),
      import("@/lib/desktop/cloud-reachability"),
    ]);

    const health = getLocalDbHealth();
    const db = getLocalDatabase({ skipBackup: true });
    const cloudReachable = await probeSupabaseReachable();
    const { markCloudAvailability } = await import("@/lib/sync/status");
    markCloudAvailability(
      db,
      cloudReachable,
      cloudReachable ? null : "cloud_unreachable",
    );
    const syncStatus = resolveSyncUiStatus(db, { cloudReachable });

    if (
      cloudReachable &&
      (syncStatus === "ONLINE_PENDING" || syncStatus === "SYNCING")
    ) {
      const { scheduleOutboxPush } = await import("@/lib/sync/push");
      scheduleOutboxPush();
    }

    return NextResponse.json({
      ...base,
      database: {
        status: health.ok ? "ok" : "error",
        schemaVersion: health.schemaVersion ?? expectedSchemaVersion(),
      },
      installationId: health.installationId,
      syncStatus,
      connectivity: {
        cloudReachable,
      },
    });
  } catch {
    return NextResponse.json({
      ...base,
      database: { status: "error", schemaVersion: null },
      installationId: null,
      syncStatus: "ERROR",
      connectivity: { cloudReachable: false },
    });
  }
}
