import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";

/**
 * Desktop SERVEUR_CAISSE : hydrate le catalogue SQLite depuis Supabase si possible.
 * Web : no-op (lecture Supabase inchangée).
 */
export async function ensureCaisseCatalog(
  workspace: WorkspaceContext,
): Promise<void> {
  if (!isDesktopServerRuntime()) {
    return;
  }
  const { ensureLocalCatalogHydrated } = await import(
    "@/lib/local-domain/catalog-service"
  );
  await ensureLocalCatalogHydrated(workspace);
}
