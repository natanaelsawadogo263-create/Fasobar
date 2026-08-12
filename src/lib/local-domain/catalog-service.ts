import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import { getLocalDatabase } from "@/lib/local-db/database";
import { pullCatalogFromCloud } from "@/lib/local-domain/catalog-pull";
import { LocalProductRepository } from "@/lib/local-domain/products-repository";
import type { CashierCategory, CashierProduct } from "@/lib/orders/types";

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

  // Always attempt a soft pull when we have zero local products, or periodically
  // when local data exists (best-effort; failures leave local data intact).
  await pullCatalogFromCloud(workspace);

  if (localCount === 0) {
    // Second chance already done inside pull; nothing else.
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
