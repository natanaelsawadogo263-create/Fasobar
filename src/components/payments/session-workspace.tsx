"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Calendar,
  CreditCard,
  Lock,
  User,
  Wallet,
} from "lucide-react";

import { closeCashSessionAction } from "@/app/(protected)/application/caisse/payment-actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { getActivityPages } from "@/lib/activity/pages";
import { formatPriceXof } from "@/lib/payments/constants";
import type { CashSessionDetail } from "@/lib/payments/types";

type SessionWorkspaceProps = {
  session: CashSessionDetail;
  establishmentName: string;
  activityCode?: string | null;
};

export function SessionWorkspace({
  session,
  establishmentName,
  activityCode = null,
}: SessionWorkspaceProps) {
  const pages = getActivityPages(activityCode);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [countedCash, setCountedCash] = useState(
    String(session.openingCashAmount + session.cashCollected),
  );
  const [closingNote, setClosingNote] = useState("");

  const theoreticalAmount = session.openingCashAmount + session.cashCollected;
  const countedValue = Number.parseInt(countedCash, 10) || 0;
  const difference = countedValue - theoreticalAmount;

  function handleCloseSession(event: React.FormEvent) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("sessionId", session.id);
    formData.set("countedCashAmount", countedCash);
    formData.set("closingNote", closingNote);
    formData.set("confirmed", "on");

    startTransition(async () => {
      const result = await closeCashSessionAction({}, formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <div className="p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Ma session — {establishmentName}
            </h1>
            <p className="text-sm text-slate-500">Résumé de votre session en cours</p>
          </div>
          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
            Session ouverte
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Calendar className="h-4 w-4" />}
            label="Ouverte le"
            value={new Date(session.openedAt).toLocaleString("fr-FR")}
          />
          <StatCard
            icon={<User className="h-4 w-4" />}
            label={pages.session.cashierLabel}
            value={session.openedByName ?? "—"}
          />
          <StatCard
            icon={<CreditCard className="h-4 w-4" />}
            label="Caisse"
            value={establishmentName}
          />
          <StatCard
            icon={<Wallet className="h-4 w-4" />}
            label="Ouverture avec"
            value={`${formatPriceXof(session.openingCashAmount)} Espèces`}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Montant théorique" value={formatPriceXof(theoreticalAmount)} large />
          <MetricCard
            label="Reçu aujourd'hui"
            value={formatPriceXof(session.cashCollected)}
            sub={`${((session.cashCollected / Math.max(theoreticalAmount, 1)) * 100).toFixed(2)}%`}
          />
          <MetricCard label={pages.session.ticketsLabel} value="—" sub="Voir le détail" />
          <MetricCard label="Paiements partiels" value="—" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Chronologie de la session</h2>
            <ul className="mt-4 space-y-4 border-l-2 border-slate-100 pl-4">
              <li>
                <p className="text-xs text-slate-400">
                  {new Date(session.openedAt).toLocaleTimeString("fr-FR")}
                </p>
                <p className="text-sm font-medium text-slate-900">Ouverture de la caisse</p>
                <p className="text-xs text-slate-500">
                  Fond initial {formatPriceXof(session.openingCashAmount)}
                </p>
              </li>
              {session.cashCollected > 0 ? (
                <li>
                  <p className="text-xs text-slate-400">—</p>
                  <p className="text-sm font-medium text-slate-900">Paiements reçus</p>
                  <p className="text-xs text-emerald-700">
                    {formatPriceXof(session.cashCollected)} en espèces
                  </p>
                </li>
              ) : null}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Derniers paiements</h2>
            <p className="mt-4 text-sm text-slate-500">Les paiements récents s&apos;afficheront ici.</p>
          </section>
        </div>

        <div className="mt-4">
          <Link
            href="/application/caisse"
            className="inline-flex h-11 min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 active:bg-slate-50"
          >
            Retour à la caisse
          </Link>
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col border-t border-slate-200 bg-white lg:h-full lg:w-[360px] lg:border-l lg:border-t-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">Clôture de la caisse</h2>
        </div>

        <form onSubmit={handleCloseSession} className="flex min-h-0 flex-1 flex-col">
          <div className="pos-scroll flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {error ? <AlertMessage message={error} /> : null}

            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs text-slate-600">Montant théorique</p>
              <p className="pos-tabular mt-1 text-2xl font-bold text-emerald-700">
                {formatPriceXof(theoreticalAmount)}
              </p>
              <p className="text-[11px] text-slate-500">Total attendu en caisse</p>
            </div>

            <div>
              <label htmlFor="countedCash" className="text-xs font-medium text-slate-600">
                Montant compté
              </label>
              <div className="relative mt-1">
                <input
                  id="countedCash"
                  type="number"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="input-no-spinner w-full rounded-xl border border-slate-200 px-4 py-3 pr-16 text-lg font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  FCFA
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-600">Écart</p>
              <p
                className={`pos-tabular mt-1 text-xl font-bold ${
                  difference === 0 ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {formatPriceXof(Math.abs(difference))}
              </p>
              {difference === 0 ? (
                <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Écart équilibré
                </span>
              ) : null}
            </div>

            <div>
              <label htmlFor="closingNote" className="text-xs font-medium text-slate-600">
                Notes (optionnel)
              </label>
              <textarea
                id="closingNote"
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                placeholder="Ajouter une remarque…"
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <footer className="shrink-0 space-y-2 border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              {isPending ? "Fermeture et déconnexion…" : "Fermer et me déconnecter"}
            </button>
            <Link
              href="/application/caisse"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 active:bg-slate-50"
            >
              Annuler
            </Link>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        {icon}
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  large,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  large?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p className={`pos-tabular mt-2 font-bold text-emerald-700 ${large ? "text-2xl" : "text-lg"}`}>
        {value}
      </p>
      {sub ? <p className="text-[11px] text-slate-400">{sub}</p> : null}
    </div>
  );
}
