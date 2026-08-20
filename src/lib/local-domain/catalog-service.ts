import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import { getLocalDatabase } from "@/lib/local-db/database";
import { pullCatalogFromCloud } from "@/lib/local-domain/catalog-pull";
import { LocalProductRepository } from "@/lib/local-domain/products-repository";
import type { CashierCategory, CashierProduct } from "@/lib/orders/types";

const CATALOG_PULL_TTL_MS = 120_000;
const lastCatalogPullOkUntil = new Map<string, number>();

/**
 * Desktop: hydrate SQLite from cloud when possible, then serve local catalogue.
 * Web callers should not use this — use Supabase queries instead.
 */
export async function ensureLocalCatalogHydrated(
  workspace: WorkspaceContext,
): Promise<void> {
  if (!isDesktopServerRuntime()) {
    return;
  }

  const db = getLocalDatabase({ skipBackup: true });
  const repo = new LocalProductRepository(db);
  const localCount = repo.countProducts(workspace.establishmentId);
  const warmUntil = lastCatalogPullOkUntil.get(workspace.establishmentId) ?? 0;

  // Si le catalogue local est déjà là et récent : ne pas re-tirer le cloud.
  if (localCount > 0 && warmUntil > Date.now()) {
    return;
  }

  const result = await pullCatalogFromCloud(workspace);
  if (result.ok || localCount > 0) {
    lastCatalogPullOkUntil.set(
      workspace.establishmentId,
      Date.now() + CATALOG_PULL_TTL_MS,
    );
  }
}

export function listLocalCashierProducts(
  establishmentId: string,
): CashierProduct[] {
  const db = getLocalDatabase({ skipBackup: true });
  return new LocalProductRepository(db).listCashierProducts(establishmentId);
}

export function listLocalCashierCategories(
  establishmentId: string,
): CashierCategory[] {
  const db = getLocalDatabase({ skipBackup: true });
  return new LocalProductRepository(db).listCashierCategories(establishmentId);
}
