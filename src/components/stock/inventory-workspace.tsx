"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClipboardCheck, Plus } from "lucide-react";

import { startInventorySessionAction } from "@/app/(protected)/application/stock/actions";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { AlertMessage } from "@/components/auth/alert-message";
import { FormSelect } from "@/components/auth/form-field";
import { getActivityPages } from "@/lib/activity/pages";
import {
  allowedDepartments,
  defaultDepartmentCode,
  isSingleServiceScope,
  type ServiceScope,
} from "@/lib/settings/service-scope";
import type { InventorySessionItem } from "@/lib/stock/types";

type InventoryWorkspaceProps = {
  establishmentName: string;
  sessions: InventorySessionItem[];
  canManageStock: boolean;
  serviceScope?: ServiceScope;
  activityCode?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-amber-50 text-amber-800",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-600",
};

function formatSessionDate(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InventoryWorkspace({
  establishmentName,
  sessions,
  canManageStock,
  serviceScope = "BOTH",
  activityCode = null,
}: InventoryWorkspaceProps) {
  const pages = getActivityPages(activityCode);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showStart, setShowStart] = useState(false);
  const departments = allowedDepartments(serviceScope);
  const singleScope = pages.retail || isSingleServiceScope(serviceScope);
  const [department, setDepartment] = useState<"BAR" | "KITCHEN">(
    defaultDepartmentCode(serviceScope),
  );

  async function handleStart() {
    const formData = new FormData();
    formData.set("departmentCode", department);

    startTransition(async () => {
      const result = await startInventorySessionAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Inventaire démarré.");
      setShowStart(false);
      refreshSoon(() => router.refresh());
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:gap-3.5 lg:px-5 lg:py-4">
      <header className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[20px] lg:text-[22px]">
            Inventaires
          </h1>
          <p className="mt-0.5 hidden text-[12px] text-slate-500 sm:block">
            Établissement actif :{" "}
            <span className="font-medium text-slate-700">{establishmentName}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:hidden">
            {sessions.length} session{sessions.length > 1 ? "s" : ""}
          </p>
        </div>

        {canManageStock ? (
          <button
            type="button"
            onClick={() => setShowStart(true)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white shadow-sm active:bg-emerald-500 sm:h-9 sm:px-3.5 sm:hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="sm:hidden">Nouveau</span>
            <span className="hidden sm:inline">Nouvel inventaire</span>
          </button>
        ) : null}
      </header>

      {error ? <AlertMessage message={error} /> : null}
      {message ? (
        <AlertMessage
          message={message}
          tone="success"
          onDismiss={() => setMessage(null)}
        />
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="hidden h-11 shrink-0 items-center gap-2 border-b border-slate-100 px-3.5 sm:flex">
          <h2 className="text-[13px] font-semibold text-slate-900">Sessions</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
            {sessions.length}
          </span>
        </div>

        <div className="app-scroll min-h-0 flex-1 overflow-auto">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ClipboardCheck className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="mt-3 text-[13px] font-semibold text-slate-900">
                Aucun inventaire enregistré
              </h3>
              <p className="mt-1 max-w-sm text-[12px] text-slate-500">
                <Link
                  href="/application/stock"
                  className="font-medium text-emerald-700 active:underline sm:hover:underline"
                >
                  Accéder au stock
                </Link>{" "}
                pour démarrer un comptage.
              </p>
              {canManageStock ? (
                <button
                  type="button"
                  onClick={() => setShowStart(true)}
                  className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white active:bg-emerald-500 sm:h-9 sm:hover:bg-emerald-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nouvel inventaire
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {/* Mobile : cartes */}
              <div className="space-y-1.5 p-2 md:hidden">
                {sessions.map((session) => (
                  <article
                    key={session.id}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!singleScope ? (
                            <p className="truncate text-[13px] font-semibold text-slate-900">
                              {session.departmentName}
                            </p>
                          ) : (
                            <p className="text-[13px] font-semibold text-slate-900">
                              Inventaire
                            </p>
                          )}
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[session.status] ?? "bg-slate-100 text-slate-600"}`}
                          >
                            {STATUS_LABELS[session.status] ?? session.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Démarré {formatSessionDate(session.startedAt)}
                          {session.startedByName ? (
                            <>
                              <span className="text-slate-300"> · </span>
                              {session.startedByName}
                            </>
                          ) : null}
                        </p>
                        {session.completedAt ? (
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Terminé {formatSessionDate(session.completedAt)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Desktop : tableau */}
              <table className="hidden min-w-full text-left text-[12px] md:table">
                <thead className="sticky top-0 z-10 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur">
                  <tr>
                    {singleScope ? null : (
                      <th className="px-3.5 py-2.5 font-medium">Département</th>
                    )}
                    <th className="px-3.5 py-2.5 font-medium">Statut</th>
                    <th className="px-3.5 py-2.5 font-medium">Démarré le</th>
                    <th className="px-3.5 py-2.5 font-medium">Par</th>
                    <th className="px-3.5 py-2.5 font-medium">Terminé le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-50/70">
                      {singleScope ? null : (
                        <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                          {session.departmentName}
                        </td>
                      )}
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLES[session.status] ?? "bg-slate-100 text-slate-600"}`}
                        >
                          {STATUS_LABELS[session.status] ?? session.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">
                        {new Date(session.startedAt).toLocaleString("fr-FR")}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">
                        {session.startedByName ?? "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">
                        {session.completedAt
                          ? new Date(session.completedAt).toLocaleString("fr-FR")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>

      {showStart && canManageStock ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setShowStart(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Nouvel inventaire</h2>
                <p className="text-sm text-slate-500">
                  Crée une session brouillon avec les stocks théoriques.
                </p>
              </div>
            </div>

            <div className="mt-4">
              {departments.length === 1 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Département :{" "}
                  <span className="font-semibold text-slate-900">
                    {departments[0] === "BAR"
                      ? pages.supply.spaceLabel
                      : "Cuisine"}
                  </span>
                </p>
              ) : (
                <FormSelect
                  id="departmentCode"
                  label="Département"
                  value={department}
                  onChange={(event) =>
                    setDepartment(event.target.value as "BAR" | "KITCHEN")
                  }
                >
                  {departments.map((code) => (
                    <option key={code} value={code}>
                      {code === "BAR" ? pages.supply.spaceLabel : "Cuisine"}
                    </option>
                  ))}
                </FormSelect>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowStart(false)}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm text-slate-700 active:bg-slate-50 sm:h-10 sm:hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleStart}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-60 sm:h-10 sm:hover:bg-emerald-700"
              >
                {isPending ? "Création..." : "Démarrer l'inventaire"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
