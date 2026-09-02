"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";

import {
  PlatformAlert,
  PlatformBody,
  PlatformButton,
  PlatformPage,
  formatPlatformDate,
} from "@/components/platform/platform-ui";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  addPlatformAdminAction,
  removePlatformAdminAction,
  setPlatformAdminStatusAction,
} from "@/lib/platform/actions";
import type { PlatformAdminRow } from "@/lib/platform/admins-queries";

type Props = {
  admins: PlatformAdminRow[];
  error?: string | null;
  currentUserId?: string | null;
};

export function PlatformAdminsWorkspace({
  admins,
  error = null,
  currentUserId = null,
}: Props) {
  const [userId, setUserId] = useState("");
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const filtered = admins.filter((admin) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [admin.fullName, admin.email, admin.userId]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  return (
    <PlatformPage>
      <PlatformBody className="!py-3 lg:!px-4 lg:!py-3">
        <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden">
          {error ? (
            <PlatformAlert tone="error">
              Impossible de charger les Super Admins : {error}
            </PlatformAlert>
          ) : null}
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="shrink-0 border-b border-slate-100 px-3 py-2.5 sm:px-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto text-[12px] font-medium text-slate-500">
                  {filtered.length} admin{filtered.length > 1 ? "s" : ""}
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

              <form
                className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
                onSubmit={(e) => {
                  e.preventDefault();
                  startTransition(async () => {
                    const result = await addPlatformAdminAction({ userId });
                    if (result.ok) {
                      toast.success("Super Admin ajouté.");
                      setUserId("");
                    } else {
                      toast.error(result.error ?? "Action impossible.");
                    }
                  });
                }}
              >
                <input
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="UUID utilisateur (profiles.id)"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  required
                />
                <PlatformButton
                  type="submit"
                  tone="primary"
                  disabled={pending}
                  className="!py-1.5 !text-[12px]"
                >
                  Ajouter
                </PlatformButton>
              </form>
            </div>

            <div className="app-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-[12px] text-slate-500">
                  Aucun Super Admin.
                </p>
              ) : (
                filtered.map((admin) => {
                  const isSelf = currentUserId === admin.userId;
                  return (
                    <div
                      key={admin.id}
                      className="border-b border-slate-100 px-3 py-3 last:border-0 sm:px-4 md:flex md:items-center md:gap-3 md:py-2.5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-slate-900">
                            {admin.fullName ?? "Sans nom"}
                            {isSelf ? (
                              <span className="ml-2 text-[10px] font-semibold uppercase text-emerald-700">
                                Vous
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-[12px] text-slate-500">
                            {admin.email ?? "—"}
                          </p>
                        </div>
                        <Badge
                          tone={admin.status === "ACTIVE" ? "emerald" : "neutral"}
                          className="shrink-0"
                        >
                          {admin.status === "ACTIVE" ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                      <p className="mt-1 tabular-nums text-[11px] text-slate-400 md:mt-0 md:shrink-0">
                        {formatPlatformDate(admin.createdAt)}
                      </p>
                      <div className="mt-2.5 grid grid-cols-2 gap-2 md:mt-0 md:flex md:w-auto md:shrink-0 md:gap-1.5">
                        <PlatformButton
                          disabled={pending || isSelf}
                          className="h-10 !text-[12px] md:h-8 md:!px-2.5 md:!py-1 md:!text-[11px]"
                          onClick={() => {
                            startTransition(async () => {
                              const next =
                                admin.status === "ACTIVE"
                                  ? "INACTIVE"
                                  : "ACTIVE";
                              const result = await setPlatformAdminStatusAction({
                                userId: admin.userId,
                                status: next,
                              });
                              if (result.ok) {
                                toast.success(
                                  `Statut mis à jour (${next === "ACTIVE" ? "actif" : "inactif"}).`,
                                );
                              } else {
                                toast.error(result.error ?? "Action impossible.");
                              }
                            });
                          }}
                        >
                          {admin.status === "ACTIVE"
                            ? "Désactiver"
                            : "Activer"}
                        </PlatformButton>
                        <PlatformButton
                          tone="danger"
                          disabled={pending || isSelf}
                          className="h-10 !text-[12px] md:h-8 md:!px-2.5 md:!py-1 md:!text-[11px]"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Retirer définitivement ${admin.fullName ?? admin.email ?? "ce Super Admin"} ?`,
                              )
                            ) {
                              return;
                            }
                            startTransition(async () => {
                              const result = await removePlatformAdminAction({
                                userId: admin.userId,
                              });
                              if (result.ok) {
                                toast.success("Super Admin retiré.");
                              } else {
                                toast.error(result.error ?? "Action impossible.");
                              }
                            });
                          }}
                        >
                          Retirer
                        </PlatformButton>
                      </div>
                    </div>
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
