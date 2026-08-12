import { NextResponse } from "next/server";

import { isDesktopServerRuntime } from "@/lib/desktop/runtime";

export const dynamic = "force-dynamic";

/**
 * LAN catalogue endpoint for POS clients talking to SERVEUR_CAISSE.
 *
 * Phase 2: no secure pairing yet — only available when FASOBAR_RUNTIME=desktop-server.
 * Do not expose this route on cloud web deployments.
 */
export async function GET(request: Request) {
  if (!isDesktopServerRuntime()) {
    return NextResponse.json(
      { error: "Catalogue local indisponible hors serveur Caisse." },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(request.url);
  const establishmentId = searchParams.get("establishmentId")?.trim();
  if (!establishmentId) {
    return NextResponse.json(
      { error: "Paramètre establishmentId requis." },
      { status: 400 },
    );
  }

  try {
    const { getLocalDatabase } = await import("@/lib/local-db/database");
    const { LocalProductRepository } = await import(
      "@/lib/local-domain/products-repository"
    );
    const db = getLocalDatabase({ skipBackup: true });
    const repo = new LocalProductRepository(db);
    const categories = repo.listCashierCategories(establishmentId);
    const products = repo.listCashierProducts(establishmentId);

    return NextResponse.json({
      establishmentId,
      categories,
      products,
      source: "sqlite",
    });
  } catch {
    return NextResponse.json(
      { error: "Impossible de lire le catalogue local." },
      { status: 503 },
    );
  }
}
