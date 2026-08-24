"use client";

import { InstantLink as Link } from "@/components/layout/instant-link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  Clock3,
  CreditCard,
  KeyRound,
  Receipt,
  Shield,
  Users,
} from "lucide-react";

import { PlatformStatusBadge } from "@/components/platform/platform-status-badge";
import {
  PLATFORM_TABLE_HEAD,
  PLATFORM_TD,
  PLATFORM_TH,
  PLATFORM_TR,
  PlatformAlert,
  PlatformButton,
  PlatformEmptyState,
  PlatformMetaChip,
  PlatformPage,
  PlatformPanel,
  PlatformTableScroll,
  formatPlatformDate,
  formatPlatformDateTime,
  formatPlatformXof,
} from "@/components/platform/platform-ui";
import { useToast } from "@/components/ui/toast";
import { ESTABLISHMENT_TYPE_LABELS } from "@/lib/auth/constants";
import { roleToSpaceLabel } from "@/lib/auth/roles";
import type { EstablishmentType } from "@/lib/auth/schemas";
import {
  deactivateClientOwnerAccountAction,
  extendOrganizationTrialAction,
  purgeClientOrganizationAction,
  purgeClientOrganizationMemberAction,
  reactivateClientOrganizationAction,
  reactivateClientOwnerAccountAction,
  restoreClientBeforeDeletionAction,
  scheduleClientDeletionAction,
  suspendClientOrganizationAction,
} from "@/lib/platform/actions";
import {
  PLATFORM_LICENSE_STATUS_LABELS,
  PLATFORM_SUBSCRIPTION_STATUS_LABELS,
  isPlatformLicenseStatus,
  isPlatformSubscriptionStatus,
} from "@/lib/platform/access";
import type { PlatformClientDetail } from "@/lib/platform/client-detail-queries";

type TabId =
  | "identity"
  | "establishments"
  | "employees"
  | "trial"
  | "subscription"
  | "licenses"
  | "payments";

type ModalKind =
  | "suspend"
  | "reactivate"
  | "deactivateOwner"
  | "reactivateOwner"
  | "delete"
  | "restore"
  | "purge"
  | "extend"
  | "purgeMember"
  | null;

const TABS: { id: TabId; label: string; icon: typeof Shield }[] = [
  { id: "identity", label: "Identité", icon: Shield },
  { id: "establishments", label: "Établissements", icon: Building2 },
  { id: "employees", label: "Employés", icon: Users },
  { id: "trial", label: "Essai", icon: Clock3 },
  { id: "subscription", label: "Abonnement", icon: CreditCard },
  { id: "licenses", label: "Licences", icon: KeyRound },
  { id: "payments", label: "Paiements", icon: Receipt },
];

const TRIAL_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  EXPIRED: "Expiré",
  CANCELLED: "Annulé",
  CONVERTED: "Converti",
};

const ENTITY_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
};

function entityBadge(status: string) {
  const active = status === "ACTIVE";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
        active
          ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
          : "bg-slate-100 text-slate-700 ring-slate-200"
      }`}
    >
      {ENTITY_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function trialBadge(status: string) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-sky-50 text-sky-800 ring-sky-200",
    EXPIRED: "bg-orange-50 text-orange-800 ring-orange-200",
    CANCELLED: "bg-slate-100 text-slate-700 ring-slate-200",
    CONVERTED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
        styles[status] ?? "bg-slate-100 text-slate-700 ring-slate-200"
      }`}
    >
      {TRIAL_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function establishmentTypeLabel(type: string | null) {
  if (!type) return "—";
  return ESTABLISHMENT_TYPE_LABELS[type as EstablishmentType] ?? type;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <div className="mt-1.5 text-[13px] font-medium leading-snug text-slate-900">
        {value}
      </div>
    </div>
  );
}

function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function tabCount(
  id: TabId,
  counts: {
    establishments: number;
    employees: number;
    licenses: number;
    payments: number;
  },
) {
  switch (id) {
    case "establishments":
      return counts.establishments;
    case "employees":
      return counts.employees;
    case "licenses":
      return counts.licenses;
    case "payments":
      return counts.payments;
    default:
      return null;
  }
}

type PlatformClientDetailProps = {
  detail: PlatformClientDetail;
  error?: string | null;
};

export function PlatformClientDetailView({
  detail,
  error = null,
}: PlatformClientDetailProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("identity");
  const [modal, setModal] = useState<ModalKind>(null);
  const [purgeMemberId, setPurgeMemberId] = useState<string | null>(null);
  const [purgeMemberName, setPurgeMemberName] = useState<string>("");
  const [reason, setReason] = useState("");
  const [extraDays, setExtraDays] = useState("7");
  const toast = useToast();
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();

  const {
    identity,
    access,
    establishments,
    employees,
    trial,
    subscription,
    licenses,
    payments,
  } = detail;

  function closeModal() {
    setModal(null);
    setPurgeMemberId(null);
    setPurgeMemberName("");
    setReason("");
    setExtraDays("7");
  }

  function runModalAction() {
    startTransition(async () => {
      let result: { ok: boolean; error?: string };

      switch (modal) {
        case "suspend":
          if (!reason.trim()) {
            toast.error("Motif obligatoire.");
            return;
          }
          result = await suspendClientOrganizationAction({
            organizationId: identity.organizationId,
            reason,
          });
          break;
        case "reactivate":
          result = await reactivateClientOrganizationAction({
            organizationId: identity.organizationId,
            comment: reason || undefined,
          });
          break;
        case "deactivateOwner":
          if (!reason.trim()) {
            toast.error("Motif obligatoire.");
            return;
          }
          result = await deactivateClientOwnerAccountAction({
            organizationId: identity.organizationId,
            reason,
          });
          break;
        case "reactivateOwner":
          result = await reactivateClientOwnerAccountAction({
            organizationId: identity.organizationId,
            note: reason || undefined,
          });
          break;
        case "delete":
          result = await scheduleClientDeletionAction({
            organizationId: identity.organizationId,
            reason: reason || undefined,
          });
          break;
        case "restore":
          result = await restoreClientBeforeDeletionAction({
            organizationId: identity.organizationId,
          });
          break;
        case "purge":
          if (!reason.trim()) {
            toast.error("Saisissez le nom exact de l’organisation.");
            return;
          }
          result = await purgeClientOrganizationAction({
            organizationId: identity.organizationId,
            confirmationName: reason,
          });
          if (result.ok) {
            toast.success("Organisation purgée.");
            closeModal();
            router.push("/platform/clients");
            router.refresh();
            return;
          }
          break;
        case "extend": {
          const days = Number(extraDays);
          if (!Number.isFinite(days) || days <= 0) {
            toast.error("Nombre de jours invalide.");
            return;
          }
          result = await extendOrganizationTrialAction({
            organizationId: identity.organizationId,
            extraDays: days,
            note: reason || undefined,
          });
          break;
        }
        case "purgeMember":
          if (!purgeMemberId) {
            toast.error("Compte introuvable.");
            return;
          }
          if (reason.trim().length < 3) {
            toast.error("Motif obligatoire (3 caractères minimum).");
            return;
          }
          result = await purgeClientOrganizationMemberAction({
            organizationId: identity.organizationId,
            userId: purgeMemberId,
            reason,
          });
          break;
        default:
          return;
      }

      if (!result.ok) {
        toast.error(result.error ?? "Action impossible.");
        return;
      }

      toast.success("Action effectuée.");
      closeModal();
      router.refresh();
    });
  }

  const modalTitle: Record<Exclude<ModalKind, null>, string> = {
    suspend: "Suspendre l’accès SaaS",
    reactivate: "Réactiver l’accès SaaS",
    deactivateOwner: "Désactiver le compte Admin",
    reactivateOwner: "Réactiver le compte Admin",
    delete: "Planifier la suppression",
    restore: "Restaurer avant suppression",
    purge: "Supprimer définitivement",
    extend: "Prolonger l’essai",
    purgeMember: "Supprimer définitivement le compte",
  };

  const displayName =
    identity.ownerName ?? identity.organizationName ?? "Client sans nom";
  const tabCounts = {
    establishments: establishments.length,
    employees: employees.length,
    licenses: licenses.length,
    payments: payments.length,
  };

  const hasSensitiveActions =
    identity.ownerProfileStatus !== "INACTIVE" ||
    (access.status !== "SUSPENDED" && access.status !== "PENDING_DELETION") ||
    access.status === "PENDING_DELETION";

  useEffect(() => {
    if (!actionsOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (
        actionsRef.current &&
        !actionsRef.current.contains(event.target as Node)
      ) {
        setActionsOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [actionsOpen]);

  function openModal(kind: Exclude<ModalKind, null>) {
    setActionsOpen(false);
    setModal(kind);
  }

  return (
    <PlatformPage>
      {/* Toute la fiche (en-tête + onglets + contenu) défile comme un seul
          document — évite qu'une zone interne trop contrainte en hauteur
          finisse réduite à un filet non scrollable sur les petits écrans. */}
      <div className="app-scroll min-h-0 flex-1 overflow-y-auto">
        {error && (
          <div className="space-y-2 px-4 pt-3 lg:px-6">
            <PlatformAlert tone="error">
              Impossible de charger la fiche : {error}
            </PlatformAlert>
          </div>
        )}

        <div className="px-4 py-2.5 lg:px-6 lg:py-3">
          <Link
            href="/platform/clients"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 transition hover:text-emerald-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour aux clients
          </Link>

          <div className="mt-2 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm lg:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-100">
                    {clientInitials(displayName)}
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-[16px] font-semibold tracking-tight text-slate-900">
                      {displayName}
                    </h1>
                    <p className="truncate text-[12px] text-slate-500">
                      {identity.organizationName}
                      {identity.ownerEmail ? (
                        <>
                          <span className="mx-1.5 text-slate-300">·</span>
                          {identity.ownerEmail}
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <PlatformStatusBadge status={identity.accessStatus} />
                  <PlatformMetaChip>
                    {establishments.length} établissement
                    {establishments.length > 1 ? "s" : ""}
                  </PlatformMetaChip>
                  <PlatformMetaChip>
                    {employees.length} employé
                    {employees.length > 1 ? "s" : ""}
                  </PlatformMetaChip>
                  {trial?.endsAt ? (
                    <PlatformMetaChip>
                      Fin d’essai {formatPlatformDate(trial.endsAt)}
                    </PlatformMetaChip>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                {trial ? (
                  <PlatformButton
                    tone="primary"
                    onClick={() => setModal("extend")}
                  >
                    Prolonger l’essai
                  </PlatformButton>
                ) : null}
                {identity.ownerProfileStatus === "INACTIVE" ? (
                  <PlatformButton
                    tone="success"
                    onClick={() => setModal("reactivateOwner")}
                  >
                    Réactiver le compte
                  </PlatformButton>
                ) : null}
                {access.status === "SUSPENDED" ? (
                  <PlatformButton
                    tone="success"
                    onClick={() => setModal("reactivate")}
                  >
                    Réactiver SaaS
                  </PlatformButton>
                ) : null}
                {access.status === "PENDING_DELETION" ? (
                  <PlatformButton
                    tone="secondary"
                    onClick={() => setModal("restore")}
                  >
                    Restaurer
                  </PlatformButton>
                ) : null}

                {hasSensitiveActions ? (
                  <div ref={actionsRef} className="relative">
                    <PlatformButton
                      tone="secondary"
                      onClick={() => setActionsOpen((open) => !open)}
                      className="gap-1.5"
                    >
                      Actions
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition ${actionsOpen ? "rotate-180" : ""}`}
                      />
                    </PlatformButton>
                    {actionsOpen ? (
                      <div className="absolute right-0 z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-900/5">
                        {identity.ownerProfileStatus !== "INACTIVE" ? (
                          <button
                            type="button"
                            className="flex w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-rose-700 transition hover:bg-rose-50"
                            onClick={() => openModal("deactivateOwner")}
                          >
                            Désactiver le compte
                          </button>
                        ) : null}
                        {access.status !== "SUSPENDED" &&
                        access.status !== "PENDING_DELETION" ? (
                          <button
                            type="button"
                            className="flex w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-rose-700 transition hover:bg-rose-50"
                            onClick={() => openModal("suspend")}
                          >
                            Suspendre SaaS
                          </button>
                        ) : null}
                        {access.status !== "PENDING_DELETION" ? (
                          <button
                            type="button"
                            className="flex w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-rose-700 transition hover:bg-rose-50"
                            onClick={() => openModal("delete")}
                          >
                            Planifier suppression
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="flex w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-rose-700 transition hover:bg-rose-50"
                            onClick={() => openModal("purge")}
                          >
                            Supprimer définitivement
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-10 border-y border-slate-100 bg-white/95 px-4 backdrop-blur-sm lg:px-6">
          <div className="flex flex-wrap gap-1 pt-0.5">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              const count = tabCount(item.id, tabCounts);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-semibold transition ${
                    active
                      ? "border-emerald-600 text-emerald-800"
                      : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                  {count != null ? (
                    <span
                      className={`tabular-nums text-[11px] ${active ? "text-emerald-600" : "text-slate-400"}`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4 lg:px-6">
        {tab === "identity" ? (
          <PlatformPanel className="h-full min-h-0" title="Identité">
            <PlatformTableScroll>
              <div className="grid gap-6 p-4 lg:grid-cols-2 lg:p-5">
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Propriétaire
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Nom"
                      value={identity.ownerName ?? "Non renseigné"}
                    />
                    <Field label="E-mail" value={identity.ownerEmail ?? "—"} />
                    <Field
                      label="Téléphone"
                      value={identity.ownerPhone ?? "—"}
                    />
                    <Field
                      label="Compte Admin"
                      value={entityBadge(
                        identity.ownerProfileStatus ?? "INACTIVE",
                      )}
                    />
                  </div>
                </section>
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Organisation
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Raison sociale"
                      value={identity.organizationName}
                    />
                    <Field
                      label="Date de création"
                      value={formatPlatformDate(identity.organizationCreatedAt)}
                    />
                    <Field
                      label="État SaaS"
                      value={
                        <PlatformStatusBadge status={identity.accessStatus} />
                      }
                    />
                  </div>
                </section>
              </div>
            </PlatformTableScroll>
          </PlatformPanel>
        ) : null}

        {tab === "establishments" ? (
          <PlatformPanel
            className="h-full min-h-0"
            title="Établissements"
          >
            {establishments.length === 0 ? (
              <PlatformEmptyState title="Aucun établissement pour ce client." />
            ) : (
              <PlatformTableScroll>
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead className={PLATFORM_TABLE_HEAD}>
                    <tr>
                      <th className={PLATFORM_TH}>Nom</th>
                      <th className={PLATFORM_TH}>Type</th>
                      <th className={PLATFORM_TH}>Ville</th>
                      <th className={PLATFORM_TH}>Quartier</th>
                      <th className={PLATFORM_TH}>Statut</th>
                      <th className={PLATFORM_TH}>Créé le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {establishments.map((est) => (
                      <tr key={est.id} className={PLATFORM_TR}>
                        <td className={`${PLATFORM_TD} font-medium text-slate-900`}>
                          {est.name}
                        </td>
                        <td className={`${PLATFORM_TD} text-slate-600`}>
                          {establishmentTypeLabel(est.type)}
                        </td>
                        <td className={`${PLATFORM_TD} text-slate-600`}>
                          {est.city ?? "—"}
                        </td>
                        <td className={`${PLATFORM_TD} text-slate-600`}>
                          {est.quartier ?? "—"}
                        </td>
                        <td className={PLATFORM_TD}>{entityBadge(est.status)}</td>
                        <td
                          className={`${PLATFORM_TD} tabular-nums text-slate-600`}
                        >
                          {formatPlatformDate(est.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PlatformTableScroll>
            )}
          </PlatformPanel>
        ) : null}

        {tab === "employees" ? (
          <PlatformPanel
            className="h-full min-h-0"
            title="Employés"
          >
            {employees.length === 0 ? (
              <PlatformEmptyState title="Aucun employé rattaché à cette organisation." />
            ) : (
              <PlatformTableScroll>
                <table className="w-full min-w-[920px] text-left text-[13px]">
                  <thead className={PLATFORM_TABLE_HEAD}>
                    <tr>
                      <th className={PLATFORM_TH}>Nom</th>
                      <th className={PLATFORM_TH}>E-mail</th>
                      <th className={PLATFORM_TH}>Téléphone</th>
                      <th className={PLATFORM_TH}>Rôle</th>
                      <th className={PLATFORM_TH}>Établissement</th>
                      <th className={PLATFORM_TH}>Profil</th>
                      <th className={PLATFORM_TH}>Membership</th>
                      <th className={PLATFORM_TH}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => (
                      <tr key={employee.userId} className={PLATFORM_TR}>
                        <td className={`${PLATFORM_TD} font-medium text-slate-900`}>
                          {employee.fullName ?? "Sans nom"}
                        </td>
                        <td className={`${PLATFORM_TD} text-slate-600`}>
                          {employee.email ?? "—"}
                        </td>
                        <td className={`${PLATFORM_TD} text-slate-600`}>
                          {employee.phone ?? "—"}
                        </td>
                        <td className={`${PLATFORM_TD} text-slate-700`}>
                          {roleToSpaceLabel(employee.role)}
                        </td>
                        <td className={`${PLATFORM_TD} text-slate-600`}>
                          {employee.establishmentName ?? "—"}
                        </td>
                        <td className={PLATFORM_TD}>
                          {entityBadge(employee.profileStatus)}
                        </td>
                        <td className={PLATFORM_TD}>
                          {entityBadge(employee.membershipStatus)}
                        </td>
                        <td className={PLATFORM_TD}>
                          {employee.role === "OWNER" ? (
                            <span className="text-[12px] text-slate-400">
                              Propriétaire
                            </span>
                          ) : (
                            <PlatformButton
                              tone="danger"
                              className="!px-2 !py-1 !text-[10px]"
                              onClick={() => {
                                setPurgeMemberId(employee.userId);
                                setPurgeMemberName(
                                  employee.fullName ?? employee.email ?? "ce compte",
                                );
                                setReason("");
                                setModal("purgeMember");
                              }}
                            >
                              Supprimer
                            </PlatformButton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PlatformTableScroll>
            )}
          </PlatformPanel>
        ) : null}

        {tab === "trial" ? (
          <PlatformPanel
            className="h-full min-h-0"
            title="Essai"
          >
            <PlatformTableScroll>
              {!trial ? (
                <PlatformEmptyState title="Aucun essai enregistré pour ce client." />
              ) : (
                <div className="p-4 lg:p-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Statut" value={trialBadge(trial.status)} />
                    <Field
                      label="Début"
                      value={formatPlatformDate(trial.startsAt)}
                    />
                    <Field
                      label="Fin"
                      value={formatPlatformDate(trial.endsAt)}
                    />
                    <Field
                      label="Jours restants"
                      value={
                        trial.daysRemaining == null
                          ? "—"
                          : trial.daysRemaining < 0
                            ? "Expiré"
                            : `${trial.daysRemaining} j`
                      }
                    />
                  </div>
                  <div className="mt-6">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Historique des prolongations
                    </h3>
                    {trial.extensions.length === 0 ? (
                      <p className="mt-3 text-[13px] text-slate-500">
                        Aucune prolongation.
                      </p>
                    ) : (
                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                        <table className="w-full min-w-[640px] text-left text-[13px]">
                          <thead className={PLATFORM_TABLE_HEAD}>
                            <tr>
                              <th className={PLATFORM_TH}>Date</th>
                              <th className={PLATFORM_TH}>Fin précédente</th>
                              <th className={PLATFORM_TH}>Nouvelle fin</th>
                              <th className={PLATFORM_TH}>Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trial.extensions.map((ext, index) => (
                              <tr
                                key={`${ext.at ?? "ext"}-${index}`}
                                className={PLATFORM_TR}
                              >
                                <td
                                  className={`${PLATFORM_TD} tabular-nums text-slate-700`}
                                >
                                  {formatPlatformDateTime(ext.at)}
                                </td>
                                <td
                                  className={`${PLATFORM_TD} tabular-nums text-slate-600`}
                                >
                                  {formatPlatformDate(ext.previousEndsAt)}
                                </td>
                                <td
                                  className={`${PLATFORM_TD} tabular-nums text-slate-600`}
                                >
                                  {formatPlatformDate(ext.newEndsAt)}
                                </td>
                                <td className={`${PLATFORM_TD} text-slate-600`}>
                                  {ext.note ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </PlatformTableScroll>
          </PlatformPanel>
        ) : null}

        {tab === "subscription" ? (
          <PlatformPanel
            className="h-full min-h-0"
            title="Abonnement"
          >
            <PlatformTableScroll>
              {!subscription ? (
                <PlatformEmptyState title="Aucun abonnement courant." />
              ) : (
                <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 lg:p-5">
                  <Field
                    label="Statut"
                    value={
                      isPlatformSubscriptionStatus(subscription.status)
                        ? PLATFORM_SUBSCRIPTION_STATUS_LABELS[
                            subscription.status
                          ]
                        : subscription.status
                    }
                  />
                  <Field
                    label="Formule"
                    value={subscription.planName ?? "—"}
                  />
                  <Field label="Période" value={subscription.billingPeriod} />
                  <Field
                    label="Début"
                    value={formatPlatformDate(subscription.startsAt)}
                  />
                  <Field
                    label="Fin"
                    value={formatPlatformDate(subscription.endsAt)}
                  />
                  <Field
                    label="Montant payé"
                    value={formatPlatformXof(subscription.amountPaidXof)}
                  />
                </div>
              )}
            </PlatformTableScroll>
          </PlatformPanel>
        ) : null}

        {tab === "licenses" ? (
          <PlatformPanel
            className="h-full min-h-0"
            title="Licences"
          >
            {licenses.length === 0 ? (
              <PlatformEmptyState title="Aucune licence." />
            ) : (
              <PlatformTableScroll>
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead className={PLATFORM_TABLE_HEAD}>
                    <tr>
                      <th className={PLATFORM_TH}>Statut</th>
                      <th className={PLATFORM_TH}>Version</th>
                      <th className={PLATFORM_TH}>Émise</th>
                      <th className={PLATFORM_TH}>Expire</th>
                      <th className={PLATFORM_TH}>Machines max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map((l) => (
                      <tr key={l.id} className={PLATFORM_TR}>
                        <td className={PLATFORM_TD}>
                          {isPlatformLicenseStatus(l.status)
                            ? PLATFORM_LICENSE_STATUS_LABELS[l.status]
                            : l.status}
                        </td>
                        <td className={`${PLATFORM_TD} tabular-nums`}>
                          {l.version}
                        </td>
                        <td className={`${PLATFORM_TD} tabular-nums`}>
                          {formatPlatformDateTime(l.issuedAt)}
                        </td>
                        <td className={`${PLATFORM_TD} tabular-nums`}>
                          {formatPlatformDateTime(l.expiresAt)}
                        </td>
                        <td className={`${PLATFORM_TD} tabular-nums`}>
                          {l.maxMachines}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PlatformTableScroll>
            )}
          </PlatformPanel>
        ) : null}

        {tab === "payments" ? (
          <PlatformPanel
            className="h-full min-h-0"
            title="Paiements plateforme"
          >
            {payments.length === 0 ? (
              <PlatformEmptyState title="Aucun paiement confirmé." />
            ) : (
              <PlatformTableScroll>
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead className={PLATFORM_TABLE_HEAD}>
                    <tr>
                      <th className={PLATFORM_TH}>Date</th>
                      <th className={PLATFORM_TH}>Montant</th>
                      <th className={PLATFORM_TH}>Canal</th>
                      <th className={PLATFORM_TH}>Référence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className={PLATFORM_TR}>
                        <td className={`${PLATFORM_TD} tabular-nums`}>
                          {formatPlatformDateTime(p.paidAt)}
                        </td>
                        <td className={`${PLATFORM_TD} tabular-nums`}>
                          {formatPlatformXof(p.amountXof)}
                        </td>
                        <td className={PLATFORM_TD}>{p.channel}</td>
                        <td className={PLATFORM_TD}>
                          {p.transactionReference ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PlatformTableScroll>
            )}
          </PlatformPanel>
        ) : null}

        </div>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
            <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
              {modalTitle[modal]}
            </h3>
            {modal === "extend" ? (
              <div className="mt-4 space-y-3">
                <p className="text-[12px] leading-relaxed text-slate-600">
                  Prolongation réservée à ce client. La nouvelle date de fin
                  s’ajoute à l’échéance actuelle (ou à aujourd’hui si déjà
                  dépassée).
                </p>
                <label className="block text-[12px] font-medium text-slate-700">
                  Jours supplémentaires
                  <input
                    type="number"
                    min={1}
                    value={extraDays}
                    onChange={(e) => setExtraDays(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>
            ) : null}
            {modal === "purge" ? (
              <label className="mt-4 block text-[12px] font-medium text-slate-700">
                Tapez le nom exact « {identity.organizationName} »
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-rose-200 px-3.5 py-2.5 text-[13px] outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  placeholder={identity.organizationName}
                />
              </label>
            ) : null}
            {modal !== "restore" &&
            modal !== "purge" &&
            modal !== "reactivateOwner" ? (
              <label className="mt-4 block text-[12px] font-medium text-slate-700">
                {modal === "suspend" ||
                modal === "delete" ||
                modal === "deactivateOwner" ||
                modal === "purgeMember"
                  ? "Motif (obligatoire)"
                  : "Note / motif"}
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  required={
                    modal === "suspend" ||
                    modal === "deactivateOwner" ||
                    modal === "purgeMember"
                  }
                />
              </label>
            ) : null}
            {modal === "reactivateOwner" ? (
              <p className="mt-4 text-[13px] leading-relaxed text-slate-600">
                Réactiver la connexion du compte Admin (OWNER). L’accès SaaS
                reste à lever séparément si l’organisation est encore
                suspendue.
              </p>
            ) : null}
            {modal === "deactivateOwner" ? (
              <p className="mt-2 text-[12px] leading-relaxed text-rose-700">
                Le compte ne pourra plus se connecter. L’accès SaaS de
                l’organisation sera aussi suspendu.
              </p>
            ) : null}
            {modal === "purgeMember" ? (
              <p className="mt-2 text-[12px] leading-relaxed text-rose-700">
                {purgeMemberName} sera retiré de l’organisation et ne pourra plus
                se connecter. Le propriétaire (OWNER) ne peut pas être supprimé
                ici.
              </p>
            ) : null}
            {modal === "restore" ? (
              <p className="mt-4 text-[13px] leading-relaxed text-slate-600">
                Restaurer l’organisation dans la fenêtre de récupération ?
              </p>
            ) : null}
            {modal === "purge" ? (
              <p className="mt-3 text-[12px] leading-relaxed text-rose-700">
                Irréversible. Disponible uniquement après le délai de
                récupération. Supprime toute la structure du client.
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <PlatformButton tone="secondary" onClick={closeModal}>
                Annuler
              </PlatformButton>
              <PlatformButton
                tone={
                  modal === "purge" ||
                  modal === "suspend" ||
                  modal === "deactivateOwner" ||
                  modal === "delete" ||
                  modal === "purgeMember"
                    ? "danger"
                    : "primary"
                }
                disabled={pending}
                onClick={runModalAction}
              >
                Confirmer
              </PlatformButton>
            </div>
          </div>
        </div>
      ) : null}
    </PlatformPage>
  );
}
