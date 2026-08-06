"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  MoreHorizontal,
  Power,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  UserX,
  UtensilsCrossed,
  Wine,
} from "lucide-react";

import { setMemberStatusAction } from "@/app/(protected)/application/utilisateurs/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { CreateEmployeeModal } from "@/components/users/create-employee-modal";
import { DeleteEmployeeModal } from "@/components/users/delete-employee-modal";
import { ResetPasswordModal } from "@/components/users/reset-password-modal";
import { SPACE_LABELS } from "@/lib/auth/roles";
import type { TeamMemberRow, UsersPageData } from "@/lib/users/types";

type UsersWorkspaceProps = UsersPageData & {
  defaultEstablishmentId: string;
  openCreateOnMount?: boolean;
};

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function spaceBadgeClass(spaceLabel: string): string {
  if (spaceLabel === SPACE_LABELS.admin) return "bg-sky-50 text-sky-800 ring-sky-100";
  if (spaceLabel === SPACE_LABELS.bar_manager) return "bg-amber-50 text-amber-800 ring-amber-100";
  return "bg-orange-50 text-orange-800 ring-orange-100";
}

export function UsersWorkspace({
  members,
  establishments,
  stats,
  defaultEstablishmentId,
  openCreateOnMount = false,
}: UsersWorkspaceProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(openCreateOnMount);
  const [resetMember, setResetMember] = useState<TeamMemberRow | null>(null);
  const [deleteMember, setDeleteMember] = useState<TeamMemberRow | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((row) => {
      const haystack = `${row.fullName} ${row.email} ${row.phone ?? ""} ${row.spaceLabel} ${row.establishmentName}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [members, search]);

  const adminCount = useMemo(
    () =>
      members.filter(
        (row) => row.status === "active" && row.spaceLabel === SPACE_LABELS.admin,
      ).length,
    [members],
  );

  function refresh() {
    router.refresh();
  }

  function handleToggleMember(userId: string, active: boolean) {
    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("active", active ? "true" : "false");
    formData.set("confirmed", "true");

    setError(null);
    setMessage(null);
    setOpenMenuId(null);
    startTransition(async () => {
      const result = await setMemberStatusAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Statut mis à jour.");
      refresh();
    });
  }

  const kpis = [
    {
      label: "Actifs",
      value: stats.activeUsers,
      hint: `${members.length} au total`,
      icon: Users,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Admin",
      value: adminCount,
      hint: "supervision",
      icon: Shield,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Caisse–Cuisine",
      value: stats.cashierKitchenCount,
      hint: "opérations",
      icon: UtensilsCrossed,
      tone: "bg-orange-50 text-orange-700",
    },
    {
      label: "Responsable Bar",
      value: stats.barManagerCount,
      hint: "stock boissons",
      icon: Wine,
      tone: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3 lg:gap-3.5 lg:p-4">
      <header className="flex shrink-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
            Utilisateurs
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Gestion des comptes et des accès de l&apos;équipe
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={isPending}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Créer un compte
        </button>
      </header>

      {(error || message) && (
        <div className="shrink-0 space-y-2">
          {error ? <AlertMessage message={error} /> : null}
          {message ? <AlertMessage message={message} tone="success" /> : null}
        </div>
      )}

      <div className="grid shrink-0 grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article
              key={kpi.label}
              className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${kpi.tone}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">{kpi.label}</p>
                  <p className="text-[18px] font-bold tabular-nums leading-tight text-slate-900">
                    {kpi.value}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">{kpi.hint}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {(stats.mustChangePasswordCount > 0 || stats.inactiveUsers > 0) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[12px] text-amber-900">
          {stats.mustChangePasswordCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <KeyRound className="h-3.5 w-3.5" />
              {stats.mustChangePasswordCount} mot
              {stats.mustChangePasswordCount > 1 ? "s" : ""} de passe à changer
            </span>
          ) : null}
          {stats.mustChangePasswordCount > 0 && stats.inactiveUsers > 0 ? (
            <span className="text-amber-400">·</span>
          ) : null}
          {stats.inactiveUsers > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <UserX className="h-3.5 w-3.5" />
              {stats.inactiveUsers} compte
              {stats.inactiveUsers > 1 ? "s" : ""} inactif
              {stats.inactiveUsers > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      )}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 lg:px-4">
          <div>
            <p className="text-[13px] font-semibold text-slate-900">Équipe</p>
            <p className="text-[11px] text-slate-500">
              {filteredRows.length} membre{filteredRows.length > 1 ? "s" : ""}
              {search.trim() ? " trouvé" + (filteredRows.length > 1 ? "s" : "") : ""}
            </p>
          </div>
          <div className="relative w-full max-w-xs sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un membre…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-[12px] outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {filteredRows.length === 0 ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Users className="h-6 w-6" />
              </div>
              <h2 className="mt-3 text-[15px] font-semibold text-slate-900">
                {search.trim() ? "Aucun résultat" : "Aucun utilisateur"}
              </h2>
              <p className="mt-1 max-w-sm text-[12px] text-slate-500">
                {search.trim()
                  ? "Modifiez votre recherche ou créez un nouveau compte."
                  : "Créez le premier compte employé pour votre établissement."}
              </p>
              {!search.trim() ? (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white hover:bg-emerald-500"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Créer un compte
                </button>
              ) : null}
            </div>
          ) : (
            <table className="min-w-full text-left text-[12px]">
              <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                <tr>
                  <th className="px-4 py-2.5">Membre</th>
                  <th className="px-3 py-2.5">Rôle</th>
                  <th className="px-3 py-2.5">Établissement</th>
                  <th className="px-3 py-2.5">Statut</th>
                  <th className="px-3 py-2.5">Créé le</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const menuOpen = openMenuId === row.id;
                  return (
                    <tr key={row.id} className="group hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b1220] text-[11px] font-bold text-amber-300">
                            {getInitials(row.fullName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-slate-900">
                              {row.fullName}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">{row.email}</p>
                            {row.phone ? (
                              <p className="truncate text-[11px] text-slate-400">{row.phone}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${spaceBadgeClass(row.spaceLabel)}`}
                        >
                          {row.spaceLabel}
                        </span>
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-3 font-medium text-slate-700">
                        {row.establishmentName}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              row.status === "active"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                row.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {row.status === "active" ? "Actif" : "Inactif"}
                          </span>
                          {row.mustChangePassword ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
                              <KeyRound className="h-3 w-3" />
                              MDP temporaire
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="relative px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            setOpenMenuId((current) => (current === row.id ? null : row.id))
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-50"
                          aria-label={`Actions pour ${row.fullName}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {menuOpen ? (
                          <>
                            <button
                              type="button"
                              className="fixed inset-0 z-20 cursor-default"
                              aria-label="Fermer le menu"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-4 top-11 z-30 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                              {row.status === "active" ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setResetMember(row);
                                  }}
                                >
                                  <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                                  Mot de passe temporaire
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                                onClick={() =>
                                  handleToggleMember(row.userId, row.status !== "active")
                                }
                              >
                                <Power className="h-3.5 w-3.5 text-slate-400" />
                                {row.status === "active" ? "Désactiver" : "Réactiver"}
                              </button>
                              <div className="my-1 border-t border-slate-100" />
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setDeleteMember(row);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Supprimer
                              </button>
                            </div>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {showCreateModal ? (
        <CreateEmployeeModal
          establishments={establishments}
          defaultEstablishmentId={defaultEstablishmentId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setMessage("Compte employé créé.");
            refresh();
          }}
        />
      ) : null}

      {resetMember ? (
        <ResetPasswordModal
          member={resetMember}
          onClose={() => setResetMember(null)}
          onReset={() => {
            setMessage("Mot de passe temporaire réinitialisé.");
            refresh();
          }}
        />
      ) : null}

      {deleteMember ? (
        <DeleteEmployeeModal
          member={deleteMember}
          onClose={() => setDeleteMember(null)}
          onDeleted={() => {
            setMessage("Compte employé supprimé.");
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
