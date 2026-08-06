"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { PlatformStatusBadge } from "@/components/platform/platform-status-badge";
import type { PlatformClientRow } from "@/lib/platform/clients-queries";
import {
  PLATFORM_ACCESS_STATUSES,
  PLATFORM_ACCESS_STATUS_LABELS,
  type PlatformAccessStatus,
} from "@/lib/platform/statuses";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

type SortOrder = "desc" | "asc";

type PlatformClientsWorkspaceProps = {
  clients: PlatformClientRow[];
};

export function PlatformClientsWorkspace({ clients }: PlatformClientsWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PlatformAccessStatus>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const rows = clients.filter((client) => {
      if (statusFilter !== "ALL" && client.accessStatus !== statusFilter) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        client.ownerName,
        client.ownerEmail,
        client.organizationName,
        client.ownerPhone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });

    rows.sort((a, b) => {
      const aTime = new Date(a.organizationCreatedAt).getTime();
      const bTime = new Date(b.organizationCreatedAt).getTime();
      return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
    });

    return rows;
  }, [clients, query, statusFilter, sortOrder]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-200/80 bg-[#f4f6f9] px-4 py-3 lg:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-slate-600">
              {filtered.length} client{filtered.length > 1 ? "s" : ""} — OWNER principal
              uniquement
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nom, e-mail ou organisation"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px] text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "ALL" | PlatformAccessStatus)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">Tous les états SaaS</option>
              {PLATFORM_ACCESS_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PLATFORM_ACCESS_STATUS_LABELS[status]}
                </option>
              ))}
            </select>

            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="desc">Plus récents</option>
              <option value="asc">Plus anciens</option>
            </select>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 lg:px-5">
        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="app-scroll min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[980px] text-left text-[13px]">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Client (OWNER)</th>
                  <th className="px-4 py-2.5 font-semibold">E-mail</th>
                  <th className="px-4 py-2.5 font-semibold">Téléphone</th>
                  <th className="px-4 py-2.5 font-semibold">Organisation</th>
                  <th className="px-4 py-2.5 font-semibold">Établ.</th>
                  <th className="px-4 py-2.5 font-semibold">Employés</th>
                  <th className="px-4 py-2.5 font-semibold">État SaaS</th>
                  <th className="px-4 py-2.5 font-semibold">Créé le</th>
                  <th className="px-4 py-2.5 font-semibold">Fin d&apos;essai</th>
                  <th className="px-4 py-2.5 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                      Aucun client ne correspond à ces critères.
                    </td>
                  </tr>
                ) : (
                  filtered.map((client) => (
                    <tr key={client.organizationId} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {client.ownerName ?? "OWNER non renseigné"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {client.ownerEmail ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {client.ownerPhone ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-800">{client.organizationName}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {client.establishmentsCount}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {client.employeesCount}
                      </td>
                      <td className="px-4 py-3">
                        <PlatformStatusBadge status={client.accessStatus} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {formatDate(client.organizationCreatedAt)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {client.trialEndsAt ? formatDate(client.trialEndsAt) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled
                          title="Bientôt disponible"
                          className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-400"
                        >
                          Voir le client
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
