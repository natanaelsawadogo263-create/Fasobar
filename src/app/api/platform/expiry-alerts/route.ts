import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/platform/auth";
import { listPlatformExpiryAlerts } from "@/lib/platform/expiry-alerts-queries";

export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const result = await listPlatformExpiryAlerts();
  return NextResponse.json(result);
}
