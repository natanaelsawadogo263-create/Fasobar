import { NextResponse } from "next/server";

import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";

export const dynamic = "force-dynamic";

/**
 * Trigger a best-effort catalogue pull (authenticated workspace user).
 * LAN pairing security is deferred to a later phase.
 */
export async function POST() {
  if (!isDesktopServerRuntime()) {
    return NextResponse.json({ error: "Not a desktop server." }, { status: 404 });
  }

  try {
    const workspace = await requireWorkspaceContext();
    const { pullCatalogFromCloud } = await import(
      "@/lib/local-domain/catalog-pull"
    );
    const result = await pullCatalogFromCloud(workspace);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Synchronisation catalogue impossible." },
      { status: 401 },
    );
  }
}
