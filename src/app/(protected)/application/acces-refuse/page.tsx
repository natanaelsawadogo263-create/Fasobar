import Link from "next/link";
import { redirect } from "next/navigation";

import {
  isAdminWorkspace,
  requireWorkspaceContext,
} from "@/lib/auth/workspace-context";

/**
 * Mur d'accès pour Caisse / Bar.
 * L'admin ne reste jamais bloqué ici : retour immédiat au tableau de bord.
 */
export default async function AccessDeniedPage() {
  const workspace = await requireWorkspaceContext();

  if (isAdminWorkspace(workspace)) {
    redirect(workspace.homePath || "/application/tableau-de-bord");
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-red-700">
          Accès refusé
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          Vous n&apos;avez pas accès à cette section
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Cette page appartient à un autre espace de travail. Retournez vers votre espace
          principal.
        </p>
        <Link
          href={workspace.homePath}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-800"
        >
          Retour à mon espace
        </Link>
      </div>
    </div>
  );
}
