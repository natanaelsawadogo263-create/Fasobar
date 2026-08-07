"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";

import { PlatformStatusBadge } from "@/components/platform/platform-status-badge";
import {
  PlatformAlert,
  PlatformBody,
  PlatformPage,
  formatPlatformDate,
} from "@/components/platform/platform-ui";
import type { PlatformClientRow } from "@/lib/platform/clients-queries";
import {
  PLATFORM_ACCESS_STATUSES,
  PLATFORM_ACCESS_STATUS_LABELS,
  type PlatformAccessStatus,
} from "@/lib/platform/statuses";

type SortOrder = "desc" | "asc";

type PlatformClientsWorkspaceProps = {
  clients: PlatformClientRow[];
  error?: string | null;
};

function initialsFromName(name: string | null) {
  if (!name?.trim()) return "?";
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

const ROW_GRID =
  "grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,0.55fr)_minmax(0,0.55fr)_minmax(0,1fr)_auto] items-center gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.45fr)_minmax(0,0.45fr)_minmax(0,0.95fr)_minmax(0,0.7fr)_auto]";

export function PlatformClientsWorkspace({
  clients,
  error = null,
}: PlatformClientsWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PlatformAccessStatus>(
    "ALL",
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      PLATFORM_ACCESS_STATUSES.map((s) => [s, 0]),
    ) as Record<PlatformAccessStatus, number>;
    for (const client of clients) {
      counts[client.accessStatus] = (counts[client.accessStatus] ?? 0) + 1;
    }
    return counts;
  }, [clients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const rows = clients.filter((client) => {
      if (statusFilter !== "ALL" && client.accessStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return [client.ownerName, client.ownerEmail, client.organizationName, client.ownerPhone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    rows.sort((a, b) => {
      const aTime = new Date(a.organizationCreatedAt).getTime();
      const bTime = new Date(b.organizationCreatedAt).getTime();
      return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
    });

    return rows;
  }, [clients, query, statusFilter, sortOrder]);

  return (
    <PlatformPage>
      <PlatformBody className="!py-3 lg:!px-4 lg:!py-3">
        <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden">
          {error ? (
            <PlatformAlert tone="error">
              Impossible de charger les clients : {error}
            </PlatformAlert>
          ) : null}

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="shrink-0 border-b border-slate-100 px-3 py-2.5 sm:px-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0">
                  <h2 className="text-[13px] font-semibold text-slate-900">
                    Clients
                    <span className="ml-1.5 font-medium text-slate-400">
                      {filtered.length}
                      {filtered.length !== clients.length
                        ? `/${clients.length}`
                        : ""}
                    </span>
                  </h2>
                </div>

                <label className="relative block w-full max-w-[220px] flex-1 sm:w-auto">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher…"
                    className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2.5 text-[12px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-700 outline-none focus:border-emerald-500"
                >
                  <option value="desc">Récents</option>
                  <option value="asc">Anciens</option>
                </select>
              </div>

              <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    statusFilter === "ALL"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Tous · {clients.length}
                </button>
                {PLATFORM_ACCESS_STATUSES.map((status) => {
                  const count = statusCounts[status] ?? 0;
                  if (count === 0 && statusFilter !== status) return null;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        setStatusFilter((prev) =>
                          prev === status ? "ALL" : status,
                        )
                      }
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        statusFilter === status
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {PLATFORM_ACCESS_STATUS_LABELS[status]} · {count}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* En-tête fixe */}
            <div
              className={`${ROW_GRID} shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 sm:px-4`}
            >
              <span>Client</span>
              <span className="hidden md:block">Organisation</span>
              <span className="text-center">Étab.</span>
              <span className="text-center">Emp.</span>
              <span>État</span>
              <span className="hidden md:block">Créé</span>
              <span className="w-7" />
            </div>

            {/* Liste avec scroll-snap vertical */}
            <div className="platform-clients-snap app-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
              {filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-[12px] text-slate-500">
                  Aucun client ne correspond à ces critères.
                </p>
              ) : (
                filtered.map((client) => {
                  const href = `/platform/clients/${client.organizationId}`;
                  return (
                    <Link
                      key={client.organizationId}
                      href={href}
                      className={`${ROW_GRID} snap-start border-b border-slate-100 px-3 py-2.5 text-[12.5px] transition last:border-0 hover:bg-slate-50/90 sm:px-4`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                          {initialsFromName(client.ownerName)}
                        </span>
                        <span className="min-w-0 truncate">
                          <span className="block truncate font-medium text-slate-900">
                            {client.ownerName ?? "OWNER non renseigné"}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-slate-500 md:hidden">
                            {client.organizationName}
                          </span>
                          <span className="mt-0.5 hidden truncate text-[11px] text-slate-500 md:block">
                            {client.ownerEmail ?? client.ownerPhone ?? "—"}
                          </span>
                        </span>
                      </span>

                      <span className="hidden truncate text-slate-700 md:block">
                        {client.organizationName}
                      </span>
                      <span className="text-center tabular-nums text-slate-600">
                        {client.establishmentsCount}
                      </span>
                      <span className="text-center tabular-nums text-slate-600">
                        {client.employeesCount}
                      </span>
                      <span className="min-w-0 overflow-hidden">
                        <PlatformStatusBadge status={client.accessStatus} />
                      </span>
                      <span className="hidden truncate tabular-nums text-slate-500 md:block">
                        {formatPlatformDate(client.organizationCreatedAt)}
                      </span>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </PlatformBody>
    </PlatformPage>
  );
}
