import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";

/**
 * Anciennement : seed automatique du catalogue démo (BRAKINA, etc.).
 * Désactivé — l'admin crée les produits (unité de stock + conditionnement).
 * Conservé comme no-op pour ne pas casser les appels existants (ex. caisse).
 */
export async function ensureCaisseCatalog(_workspace: WorkspaceContext): Promise<void> {
  void _workspace;
}
