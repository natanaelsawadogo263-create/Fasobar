import { InstantLink as Link } from "@/components/layout/instant-link";
import { redirect } from "next/navigation";

import { requireWorkspaceContext } from "@/lib/auth/workspace-context";

export default async function OnboardingEmployeesPage() {
  const workspace = await requireWorkspaceContext();

  if (!workspace.canManageUsers) {
    redirect("/application");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center justify-center">
        <div className="w-full rounded-3xl border border-emerald-100 bg-white p-8 shadow-xl sm:p-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
            Étape suivante
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">
            Créez les comptes de votre équipe
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Ajoutez les employés qui utiliseront la caisse, la cuisine et la gestion du Bar.
            Chaque employé recevra des identifiants personnels à utiliser dès leur première
            connexion.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link
              href="/application/utilisateurs?create=1"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-800"
            >
              Créer un compte employé
            </Link>
            <Link
              href="/application/tableau-de-bord"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Je le ferai plus tard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
