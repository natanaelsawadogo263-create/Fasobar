import { LayoutDashboard } from "lucide-react";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";

/** Reproduction fidèle du chrome FasoBar Admin (sidebar sombre + contenu). */
export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-900/20 bg-[#0b1220] shadow-[0_30px_80px_-40px_rgba(6,20,16,0.9)] ring-1 ring-amber-500/15">
      <div className="flex min-h-[320px] md:min-h-[380px]">
        <aside className="hidden w-[188px] shrink-0 flex-col bg-[#0b1220] p-3 sm:flex">
          <div className="mb-4 px-2 pt-1">
            <FasoBarLogo size="sm" tone="dark" />
          </div>
          <PreviewNav active icon={LayoutDashboard} label="Tableau de bord" />
          <PreviewNav label="Produits" />
          <PreviewNav label="Stock" />
          <PreviewNav label="Ventes" />
          <PreviewNav label="Utilisateurs" />
        </aside>

        <div className="min-w-0 flex-1 bg-[#f4f6f9]">
          <div className="flex h-11 items-center justify-between border-b border-slate-200/90 bg-white px-4">
            <p className="truncate text-[12px] font-medium text-slate-700">
              Votre établissement
            </p>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              Admin
            </span>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <PreviewMetric label="Caisse du jour" hint="Sessions ouvertes" />
            <PreviewMetric label="Commandes" hint="En cours / à encaisser" />
            <PreviewMetric label="Stock" hint="Alertes et ruptures" />
          </div>
          <div className="px-4 pb-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Activité récente
              </p>
              <ul className="mt-2 space-y-2 text-[12px] text-slate-600">
                <li className="flex justify-between">
                  <span>Vente · Caisse</span>
                  <span className="text-emerald-700">Encaissée</span>
                </li>
                <li className="flex justify-between">
                  <span>Entrée stock</span>
                  <span className="text-slate-500">Appro</span>
                </li>
                <li className="flex justify-between">
                  <span>Inventaire</span>
                  <span className="text-amber-700">En cours</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewNav({
  label,
  active = false,
  icon: Icon,
}: {
  label: string;
  active?: boolean;
  icon?: typeof LayoutDashboard;
}) {
  return (
    <div
      className={`mb-0.5 flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] ${
        active
          ? "bg-emerald-600 font-semibold text-white"
          : "text-slate-400"
      }`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />}
      {label}
    </div>
  );
}

function PreviewMetric({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-2 h-2 w-16 rounded bg-emerald-100" />
      <p className="mt-2 text-[10px] text-slate-400">{hint}</p>
    </div>
  );
}
