"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Timer } from "lucide-react";

import { closeBarSessionAction } from "@/app/(protected)/application/bar/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { BarSessionBilanView } from "@/components/bar/bar-session-bilan-view";
import { TextField } from "@/components/ui/form-controls";
import type { BarSessionDetail } from "@/lib/bar/session-types";

type BarSessionWorkspaceProps = {
  session: BarSessionDetail;
  establishmentName: string;
};

export function BarSessionWorkspace({
  session,
  establishmentName,
}: BarSessionWorkspaceProps) {
  const [error, setError] = useState<string | null>(null);
  const [closingNote, setClosingNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClose(event: React.FormEvent) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("sessionId", session.id);
    formData.set("closingNote", closingNote);
    if (confirmed) {
      formData.set("confirmed", "on");
    }

    startTransition(async () => {
      const result = await closeBarSessionAction({}, formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  const summary = session.closingSummary;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4 lg:gap-5 lg:px-6 lg:py-5">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
            Ma session
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {session.openedByName ?? "Responsable"} · ouvert le{" "}
            {new Date(session.openedAt).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
            <span className="text-slate-400"> · {establishmentName}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-medium text-slate-700">
            <Timer className="h-3.5 w-3.5" />
            {formatDuration(session.openedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Service ouvert
          </span>
        </div>
      </header>

      {session.openingNote ? (
        <p className="shrink-0 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12px] text-slate-600 ring-1 ring-slate-200/80">
          <span className="font-semibold text-slate-800">Ouverture : </span>
          {session.openingNote}
        </p>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">
            Bilan calculé par FasoBar
          </h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Vérifiez ce bilan — aucun inventaire physique complet n&apos;est demandé
            ici.
          </p>
        </div>

        {summary ? (
          <BarSessionBilanView summary={summary} />
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
            Le bilan détaillé sera disponible après application de la migration{" "}
            <code className="rounded bg-amber-100 px-1">
              20260806170000_bar_session_closing_summary.sql
            </code>
            . Les indicateurs de base restent affichés ci-dessous.
            <ul className="mt-2 list-inside list-disc space-y-0.5">
              <li>Prêtes : {session.ordersReadyCount}</li>
              <li>En attente : {session.ordersPendingCount}</li>
              <li>Entrées : {session.stockEntriesCount}</li>
              <li>Pertes : {session.stockLossesCount}</li>
            </ul>
          </div>
        )}
      </section>

      <form
        onSubmit={handleClose}
        className="shrink-0 space-y-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 lg:p-5"
      >
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">
            Fermer ma session Bar
          </h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            La session sera verrouillée, le bilan conservé pour l&apos;admin, puis
            vous serez déconnecté automatiquement.
          </p>
        </div>

        {error ? <AlertMessage message={error} /> : null}

        <TextField
          id="closingNote"
          name="closingNote"
          label="Note de passation (optionnel)"
          placeholder="Ex. 2 casiers ouverts, rupture Coca…"
          value={closingNote}
          onChange={(event) => setClosingNote(event.target.value)}
          disabled={isPending}
        />

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[13px] text-slate-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            disabled={isPending}
          />
          <span>
            Je confirme avoir vérifié ce bilan
          </span>
        </label>

        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href="/application/bar"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Retour
          </Link>
          <button
            type="submit"
            disabled={isPending || !confirmed}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Fermeture et déconnexion…" : "Fermer et me déconnecter"}
          </button>
        </div>
      </form>
    </div>
  );
}

function formatDuration(openedAt: string): string {
  const minutes = Math.max(
    Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000),
    0,
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
