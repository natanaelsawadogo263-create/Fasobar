"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClipboardCheck, Plus } from "lucide-react";

import { startInventorySessionAction } from "@/app/(protected)/application/stock/actions";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { AlertMessage } from "@/components/auth/alert-message";
import { FormSelect } from "@/components/auth/form-field";
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

export function InventoryWorkspace({
  establishmentName,
  sessions,
  canManageStock,
  serviceScope = "BOTH",
}: InventoryWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showStart, setShowStart] = useState(false);
  const departments = allowedDepartments(serviceScope);
  const singleScope = isSingleServiceScope(serviceScope);
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Inventaires</h1>
          <p className="mt-1 text-sm text-slate-600">
            Établissement actif :{" "}
            <span className="font-medium">{establishmentName}</span>
          </p>
        </div>

        {canManageStock ? (
          <button
            type="button"
            onClick={() => setShowStart(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Nouvel inventaire
          </button>
        ) : null}
      </div>

      {error ? <AlertMessage message={error} /> : null}
      {message ? <AlertMessage message={message} tone="success" /> : null}

      <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                {singleScope ? null : (
                  <th className="px-4 py-3 font-medium">Département</th>
                )}
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Démarré le</th>
                <th className="px-4 py-3 font-medium">Par</th>
                <th className="px-4 py-3 font-medium">Terminé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={singleScope ? 4 : 5}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    Aucun inventaire enregistré.{" "}
                    <Link href="/application/stock" className="text-emerald-700 hover:underline">
                      Accéder au stock
                    </Link>{" "}
                    pour démarrer un comptage.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id}>
                    {singleScope ? null : (
                      <td className="px-4 py-4 font-medium text-slate-900">
                        {session.departmentName}
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[session.status] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {STATUS_LABELS[session.status] ?? session.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {new Date(session.startedAt).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {session.startedByName ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {session.completedAt
                        ? new Date(session.completedAt).toLocaleString("fr-FR")
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                    {departments[0] === "BAR" ? "Boissons" : "Cuisine"}
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
                      {code === "BAR" ? "Boissons" : "Cuisine"}
                    </option>
                  ))}
                </FormSelect>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowStart(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleStart}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
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
