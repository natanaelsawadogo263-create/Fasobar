"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  KeyRound,
  AtSign,
  Phone,
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
import { refreshSoon } from "@/lib/ops/client-refresh";
import { AlertMessage } from "@/components/auth/alert-message";
import { useToast } from "@/components/ui/toast";
import { CreateEmployeeModal } from "@/components/users/create-employee-modal";
import { DeleteEmployeeModal } from "@/components/users/delete-employee-modal";
import { ResetPasswordModal } from "@/components/users/reset-password-modal";
import { getActivityProfile } from "@/lib/activity/profile";
import { SPACE_LABELS } from "@/lib/auth/roles";
import type { ServiceScope } from "@/lib/settings/service-scope";
import type { TeamMemberRow, UsersPageData } from "@/lib/users/types";

type UsersWorkspaceProps = UsersPageData & {
  defaultEstablishmentId: string;
  openCreateOnMount?: boolean;
  serviceScope?: ServiceScope;
  activityCode?: string | null;
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
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatPhone(value: string): string {
  const digits = value.replace(/[^\d+]/g, "");
  const match = digits.match(/^\+?226(\d{8})$/);
  if (match) {
    const local = match[1];
    return `+226 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6)}`;
  }
  return value;
}

function spaceTone(spaceLabel: string): string {
  if (spaceLabel === SPACE_LABELS.admin) {
    return "bg-sky-50 text-sky-800 ring-sky-200";
  }
  if (spaceLabel === SPACE_LABELS.bar_manager) {
    return "bg-amber-50 text-amber-900 ring-amber-200";
  }
  return "bg-orange-50 text-orange-900 ring-orange-200";
}

function displayMemberSpace(
  spaceLabel: string,
  activityCode: string | null | undefined,
): string {
  const profile = getActivityProfile(activityCode);
  if (profile.kind === "retail" && spaceLabel === SPACE_LABELS.cashier_kitchen) {
    return profile.cashierSpaceLabel;
  }
  return spaceLabel;
}

export function UsersWorkspace({
  members,
  establishments,
  stats,
  defaultEstablishmentId,
  openCreateOnMount = false,
  serviceScope = "BOTH",
  activityCode = null,
}: UsersWorkspaceProps) {
  const profile = getActivityProfile(activityCode);
  const retail = profile.kind === "retail";
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(openCreateOnMount);
  const [resetMember, setResetMember] = useState<TeamMemberRow | null>(null);
  const [deleteMember, setDeleteMember] = useState<TeamMemberRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [memberRows, setMemberRows] = useState(members);

  useEffect(() => {
    setMemberRows(members);
  }, [members]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return memberRows;
    return memberRows.filter((row) => {
      const haystack =
        `${row.fullName} ${row.loginIdentifier} ${row.phone ?? ""} ${row.spaceLabel} ${row.establishmentName}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [memberRows, search]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (a.mustChangePassword !== b.mustChangePassword) {
        return a.mustChangePassword ? -1 : 1;
      }
      if (a.status !== b.status) {
        return a.status === "active" ? -1 : 1;
      }
      return a.fullName.localeCompare(b.fullName, "fr");
    });
  }, [filteredRows]);

  const adminCount = useMemo(
    () =>
      memberRows.filter(
        (row) => row.status === "active" && row.spaceLabel === SPACE_LABELS.admin,
      ).length,
    [memberRows],
  );

  function refresh() {
    refreshSoon(() => router.refresh());
  }

  function handleToggleMember(userId: string, active: boolean) {
    const previous = memberRows.find((row) => row.userId === userId)?.status;
    setMemberRows((current) =>
      current.map((row) =>
        row.userId === userId
          ? { ...row, status: active ? "active" : "inactive" }
          : row,
      ),
    );
    setError(null);
    toast.success(active ? "Compte activé." : "Compte désactivé.");

    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("active", active ? "true" : "false");
    formData.set("confirmed", "true");

    startTransition(async () => {
      const result = await setMemberStatusAction({}, formData);
      if (!result.error) return;
      if (previous) {
        setMemberRows((current) =>
          current.map((row) =>
            row.userId === userId ? { ...row, status: previous } : row,
          ),
        );
      }
      setError(result.error);
    });
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-3 sm:gap-5 sm:px-4 sm:py-4 lg:gap-6 lg:px-6 lg:py-5">
        {/* En-tête page */}
        <header className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[22px]">
              Utilisateurs
            </h1>
            <p className="mt-0.5 hidden text-[13px] text-slate-500 sm:block">
              Créez les comptes employés et gérez leurs accès par espace.
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 sm:hidden">
              {stats.activeUsers} actif{stats.activeUsers > 1 ? "s" : ""}
              <span className="text-slate-300"> · </span>
              {memberRows.length} au total
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            disabled={isPending}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white shadow-sm active:bg-emerald-500 disabled:opacity-60 sm:h-10 sm:gap-2 sm:px-4 sm:text-[13px] sm:hover:bg-emerald-500"
          >
            <UserPlus className="h-4 w-4" />
            <span className="sm:hidden">Créer</span>
            <span className="hidden sm:inline">Créer un compte</span>
          </button>
        </header>

        {error ? <AlertMessage message={error} /> : null}

        {/* Synthèse — desktop uniquement */}
        <div className={`hidden grid-cols-2 gap-3 md:grid ${retail ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          {[
            {
              label: "Actifs",
              value: stats.activeUsers,
              hint: `${memberRows.length} au total`,
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
              label: profile.cashierSpaceLabel,
              value: stats.cashierKitchenCount,
              hint: "opérations",
              icon: UtensilsCrossed,
              tone: "bg-orange-50 text-orange-700",
            },
            ...(retail
              ? []
              : [
                  {
                    label: "Responsable Bar",
                    value: stats.barManagerCount,
                    hint: "stock boissons",
                    icon: Wine,
                    tone: "bg-amber-50 text-amber-700",
                  },
                ]),
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <article
                key={kpi.label}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.tone}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {kpi.label}
                    </p>
                    <p className="text-[20px] font-bold tabular-nums leading-none text-slate-900">
                      {kpi.value}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">{kpi.hint}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {(stats.mustChangePasswordCount > 0 || stats.inactiveUsers > 0) && (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-950 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2 sm:px-4 sm:py-3 sm:text-[13px]">
            {stats.mustChangePasswordCount > 0 ? (
              <span className="inline-flex items-center gap-2 font-medium">
                <KeyRound className="h-4 w-4 shrink-0 text-amber-700" />
                {stats.mustChangePasswordCount} compte
                {stats.mustChangePasswordCount > 1 ? "s" : ""} en attente de 1ʳᵉ
                connexion
              </span>
            ) : null}
            {stats.inactiveUsers > 0 ? (
              <span className="inline-flex items-center gap-2 font-medium">
                <UserX className="h-4 w-4 shrink-0 text-amber-700" />
                {stats.inactiveUsers} compte
                {stats.inactiveUsers > 1 ? "s" : ""} inactif
                {stats.inactiveUsers > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
        )}

        {/* Équipe */}
        <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-4">
            <div className="hidden sm:block">
              <h2 className="text-[15px] font-semibold text-slate-900">Équipe</h2>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {sortedRows.length} membre{sortedRows.length > 1 ? "s" : ""}
                {search.trim()
                  ? ` correspondant à « ${search.trim()} »`
                  : " · tous les espaces"}
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher…"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 sm:h-10"
              />
            </div>
          </div>

          {sortedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-slate-900">
                {search.trim() ? "Aucun résultat" : "Aucun utilisateur"}
              </h3>
              <p className="mt-1.5 max-w-sm text-[13px] text-slate-500">
                {search.trim()
                  ? "Modifiez votre recherche ou créez un nouveau compte."
                  : "Créez le premier compte employé pour votre établissement."}
              </p>
              {!search.trim() ? (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-[13px] font-semibold text-white hover:bg-emerald-500"
                >
                  <UserPlus className="h-4 w-4" />
                  Créer un compte
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sortedRows.map((row) => {
                const isActive = row.status === "active";
                return (
                  <li
                    key={row.id}
                    className={`px-3 py-3.5 sm:px-5 sm:py-4 ${isActive ? "bg-white" : "bg-slate-50/70"}`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      {/* Identité */}
                      <div className="flex min-w-0 flex-1 items-start gap-3.5">
                        <span
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                            isActive
                              ? "bg-[#0b1220] text-amber-300"
                              : "bg-slate-300 text-slate-600"
                          }`}
                        >
                          {getInitials(row.fullName)}
                        </span>

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[15px] font-semibold text-slate-900">
                              {row.fullName}
                            </h3>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                isActive
                                  ? "bg-emerald-50 text-emerald-800"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isActive ? "bg-emerald-500" : "bg-slate-500"
                                }`}
                              />
                              {isActive ? "Actif" : "Inactif"}
                            </span>
                            {row.mustChangePassword ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
                                <KeyRound className="h-3 w-3" />
                                1ʳᵉ connexion à faire
                              </span>
                            ) : null}
                          </div>

                          <div className="flex flex-col gap-1 text-[12px] text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              <AtSign className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <span className="truncate">{row.loginIdentifier}</span>
                            </span>
                            {row.phone ? (
                              <span className="inline-flex items-center gap-1.5 tabular-nums">
                                <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                {formatPhone(row.phone)}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              {row.establishmentName}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${spaceTone(row.spaceLabel)}`}
                            >
                              {displayMemberSpace(row.spaceLabel, profile.id)}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Créé le {formatDate(row.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions toujours visibles */}
                      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:flex sm:flex-wrap sm:items-center lg:shrink-0 lg:border-t-0 lg:pt-0">
                        {isActive ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => setResetMember(row)}
                            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 transition active:bg-slate-50 disabled:opacity-50 sm:h-10 sm:justify-start sm:hover:border-slate-300 sm:hover:bg-slate-50"
                          >
                            <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                            Mot de passe
                          </button>
                        ) : null}

                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleToggleMember(row.userId, row.status !== "active")
                          }
                          className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 transition active:bg-slate-50 disabled:opacity-50 sm:h-10 sm:justify-start sm:hover:border-slate-300 sm:hover:bg-slate-50 ${
                            isActive ? "" : "col-span-2 sm:col-span-1"
                          }`}
                        >
                          <Power className="h-3.5 w-3.5 text-slate-500" />
                          {isActive ? "Désactiver" : "Réactiver"}
                        </button>

                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setDeleteMember(row)}
                          className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-[12px] font-semibold text-red-700 transition active:bg-red-50 disabled:opacity-50 sm:h-10 sm:justify-start sm:hover:bg-red-50 ${
                            isActive ? "col-span-2 sm:col-span-1" : ""
                          }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {showCreateModal ? (
        <CreateEmployeeModal
          establishments={establishments}
          defaultEstablishmentId={defaultEstablishmentId}
          serviceScope={serviceScope}
          activityCode={activityCode}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            toast.success("Compte employé créé.");
            refresh();
          }}
        />
      ) : null}

      {resetMember ? (
        <ResetPasswordModal
          member={resetMember}
          retail={profile.kind === "retail"}
          onClose={() => setResetMember(null)}
          onReset={() => {
            toast.success("Mot de passe temporaire réinitialisé.");
            refresh();
          }}
        />
      ) : null}

      {deleteMember ? (
        <DeleteEmployeeModal
          member={deleteMember}
          onClose={() => setDeleteMember(null)}
          onDeleted={() => {
            toast.success("Compte employé supprimé.");
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
