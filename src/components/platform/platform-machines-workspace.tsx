"use client";

import { InstantLink as Link } from "@/components/layout/instant-link";
import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";

import {
  PlatformAlert,
  PlatformBody,
  PlatformButton,
  PlatformPage,
  formatPlatformDateTime,
} from "@/components/platform/platform-ui";
import { useToast } from "@/components/ui/toast";
import {
  reactivateMachineAction,
  revokeMachineAction,
} from "@/lib/platform/actions";
import {
  PLATFORM_MACHINE_STATUS_LABELS,
  PLATFORM_MACHINE_STATUSES,
  type PlatformMachineStatus,
} from "@/lib/platform/access";
import type { PlatformMachineRow } from "@/lib/platform/machines-queries";

function MachineBadge({ status }: { status: PlatformMachineStatus }) {
  const styles: Record<PlatformMachineStatus, string> = {
    PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
    ACTIVE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    REVOKED: "bg-slate-100 text-slate-700 ring-slate-200",
    BLOCKED: "bg-red-50 text-red-800 ring-red-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      {PLATFORM_MACHINE_STATUS_LABELS[status]}
    </span>
  );
}

function maskDeviceId(deviceId: string) {
  if (deviceId.length <= 10) return deviceId;
  return `${deviceId.slice(0, 6)}…${deviceId.slice(-4)}`;
}

const ROW_GRID =
  "grid w-full grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] items-center gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto_minmax(0,0.85fr)_auto]";

type Props = {
  machines: PlatformMachineRow[];
  error?: string | null;
};

export function PlatformMachinesWorkspace({ machines, error = null }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PlatformMachineStatus>(
    "ALL",
  );
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      PLATFORM_MACHINE_STATUSES.map((s) => [s, 0]),
    ) as Record<PlatformMachineStatus, number>;
    for (const row of machines) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    return counts;
  }, [machines]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return machines.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!q) return true;
      return [
        row.organizationName,
        row.establishmentName,
        row.deviceId,
        row.displayName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [machines, query, statusFilter]);

  return (
    <PlatformPage>
      <PlatformBody className="!py-3 lg:!px-4 lg:!py-3">
        <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden">
          {error ? (
            <PlatformAlert tone="error">
              Impossible de charger les machines : {error}
            </PlatformAlert>
          ) : null}
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="shrink-0 border-b border-slate-100 px-3 py-2.5 sm:px-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto text-[12px] font-medium text-slate-500">
                  {filtered.length}
                  {filtered.length !== machines.length
                    ? `/${machines.length}`
                    : ""}{" "}
                  machine{filtered.length > 1 ? "s" : ""}
                </p>

                <label className="relative block w-full max-w-[200px] flex-1 sm:w-auto">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher…"
                    className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2.5 text-[12px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    statusFilter === "ALL"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300"
                  }`}
                >
                  Tous · {machines.length}
                </button>
                {PLATFORM_MACHINE_STATUSES.map((status) => {
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
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300"
                      }`}
                    >
                      {PLATFORM_MACHINE_STATUS_LABELS[status]} · {count}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className={`${ROW_GRID} shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 sm:px-4`}
            >
              <span>Machine</span>
              <span>Organisation</span>
              <span className="hidden md:block">Établissement</span>
              <span>Statut</span>
              <span className="hidden md:block">Dernière vue</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="platform-machines-snap app-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
              {filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-[12px] text-slate-500">
                  Aucune machine pour ces critères.
                </p>
              ) : (
                filtered.map((row) => (
                  <div
                    key={row.id}
                    className={`${ROW_GRID} snap-start border-b border-slate-100 px-3 py-2.5 text-[12.5px] last:border-0 hover:bg-slate-50/90 sm:px-4`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {row.displayName ?? maskDeviceId(row.deviceId)}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                        {maskDeviceId(row.deviceId)}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500 md:hidden">
                        {row.establishmentName}
                      </p>
                    </div>

                    <Link
                      href={`/platform/clients/${row.organizationId}`}
                      className="truncate text-slate-700 underline decoration-slate-300 underline-offset-2 transition hover:text-emerald-700 hover:decoration-emerald-400 active:text-emerald-700"
                    >
                      {row.organizationName}
                    </Link>

                    <span className="hidden truncate text-slate-600 md:block">
                      {row.establishmentName}
                    </span>

                    <MachineBadge status={row.status} />

                    <span className="hidden truncate tabular-nums text-slate-500 md:block">
                      {formatPlatformDateTime(row.lastSeenAt)}
                    </span>

                    <div className="flex justify-end gap-1">
                      {row.status !== "REVOKED" ? (
                        <PlatformButton
                          tone="danger"
                          disabled={pending}
                          className="h-9 !px-2.5 !py-1.5 !text-[11px] md:h-7 md:!px-2 md:!py-1 md:!text-[10px]"
                          onClick={() => {
                            const reason = window.prompt(
                              "Motif de révocation (optionnel) :",
                            );
                            if (reason === null) return;
                            startTransition(async () => {
                              const result = await revokeMachineAction({
                                machineId: row.id,
                                reason: reason || undefined,
                              });
                              if (result.ok) {
                                toast.success("Machine révoquée.");
                              } else {
                                toast.error(result.error ?? "Action impossible.");
                              }
                            });
                          }}
                        >
                          Révoquer
                        </PlatformButton>
                      ) : (
                        <PlatformButton
                          tone="success"
                          disabled={pending}
                          className="h-9 !px-2.5 !py-1.5 !text-[11px] md:h-7 md:!px-2 md:!py-1 md:!text-[10px]"
                          onClick={() => {
                            startTransition(async () => {
                              const result = await reactivateMachineAction({
                                machineId: row.id,
                              });
                              if (result.ok) {
                                toast.success("Machine réactivée.");
                              } else {
                                toast.error(result.error ?? "Action impossible.");
                              }
                            });
                          }}
                        >
                          Réactiver
                        </PlatformButton>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </PlatformBody>
    </PlatformPage>
  );
}
