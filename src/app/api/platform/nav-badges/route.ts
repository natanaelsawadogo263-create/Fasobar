import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/platform/auth";
import { getPlatformNavBadges } from "@/lib/platform/nav-badges";

export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const badges = await getPlatformNavBadges();
  return NextResponse.json(badges);
}
