import { NextResponse } from "next/server";

import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import { pushLocalOutboxToCloud } from "@/lib/sync/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manual / automatic outbox push (Desktop SERVEUR_CAISSE only). */
export async function POST() {
  if (!isDesktopServerRuntime()) {
    return NextResponse.json({ error: "Desktop only" }, { status: 404 });
  }

  try {
    const result = await pushLocalOutboxToCloud();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "sync_failed",
      },
      { status: 500 },
    );
  }
}
