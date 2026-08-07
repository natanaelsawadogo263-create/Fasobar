"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  Clock3,
  CreditCard,
  HardDrive,
  KeyRound,
  Receipt,
  ScrollText,
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
  PlatformBody,
  PlatformButton,
  PlatformEmptyState,
  PlatformMetaChip,
  PlatformPage,
  PlatformPageHeader,
  PlatformPanel,
  PlatformTableScroll,
  formatPlatformDate,
  formatPlatformDateTime,
  formatPlatformXof,
} from "@/components/platform/platform-ui";
import { ESTABLISHMENT_TYPE_LABELS } from "@/lib/auth/constants";
import { roleToSpaceLabel } from "@/lib/auth/roles";
import type { EstablishmentType } from "@/lib/auth/schemas";
import {
  deactivateClientOwnerAccountAction,
  extendOrganizationTrialAction,
  purgeClientOrganizationAction,
  reactivateClientOrganizationAction,
  reactivateClientOwnerAccountAction,
  reactivateMachineAction,
  restoreClientBeforeDeletionAction,
  revokeMachineAction,
  scheduleClientDeletionAction,
  suspendClientOrganizationAction,
} from "@/lib/platform/actions";
import {
  PLATFORM_LICENSE_STATUS_LABELS,
  PLATFORM_MACHINE_STATUS_LABELS,
  PLATFORM_SUBSCRIPTION_STATUS_LABELS,
  isPlatformLicenseStatus,
  isPlatformMachineStatus,
  isPlatformSubscriptionStatus,
} from "@/lib/platform/access";
import type { PlatformClientDetail } from "@/lib/platform/client-detail-queries";

type TabId =
  | "identity"
  | "establishments"
  | "employees"
  | "trial"
  | "subscription"
  | "machines"
  | "licenses"
  | "payments"
  | "audit"
  | "access";

type ModalKind =
  | "suspend"
  | "reactivate"
  | "deactivateOwner"
  | "reactivateOwner"
  | "delete"
  | "restore"
  | "purge"
  | "extend"
  | "revokeMachine"
  | null;

const TABS: { id: TabId; label: string; icon: typeof Shield }[] = [
  { id: "identity", label: "Identité", icon: Shield },
  { id: "establishments", label: "Établissements", icon: Building2 },
  { id: "employees", label: "Employés", icon: Users },
  { id: "trial", label: "Essai", icon: Clock3 },
  { id: "subscription", label: "Abonnement", icon: CreditCard },
  { id: "machines", label: "Machines", icon: HardDrive },
  { id: "licenses", label: "Licences", icon: KeyRound },
  { id: "payments", label: "Paiements", icon: Receipt },
  { id: "audit", label: "Audit", icon: ScrollText },
  { id: "access", label: "Accès", icon: KeyRound },
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
  const [machineId, setMachineId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [extraDays, setExtraDays] = useState("7");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    identity,
    access,
    establishments,
    employees,
    trial,
    subscription,
    machines,
    licenses,
    payments,
    auditEvents,
  } = detail;

  function closeModal() {
    setModal(null);
    setMachineId(null);
    setReason("");
    setExtraDays("7");
  }

  function runModalAction() {
    setMessage(null);
    startTransition(async () => {
      let result: { ok: boolean; error?: string };

      switch (modal) {
        case "suspend":
          if (!reason.trim()) {
            setMessage("Motif obligatoire.");
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
            setMessage("Motif obligatoire.");
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
            setMessage("Saisissez le nom exact de l’organisation.");
            return;
          }
          result = await purgeClientOrganizationAction({
            organizationId: identity.organizationId,
            confirmationName: reason,
          });
          if (result.ok) {
            setMessage("Organisation purgée.");
            closeModal();
            router.push("/platform/clients");
            router.refresh();
            return;
          }
          break;
        case "extend": {
          const days = Number(extraDays);
          if (!Number.isFinite(days) || days <= 0) {
            setMessage("Nombre de jours invalide.");
            return;
          }
          result = await extendOrganizationTrialAction({
            organizationId: identity.organizationId,
            extraDays: days,
            note: reason || undefined,
          });
          break;
        }
        case "revokeMachine":
          if (!machineId) {
            setMessage("Machine introuvable.");
            return;
          }
          result = await revokeMachineAction({
            machineId,
            reason: reason || undefined,
          });
          break;
        default:
          return;
      }

      if (!result.ok) {
        setMessage(result.error ?? "Action impossible.");
        return;
      }

      setMessage("Action effectuée.");
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
    revokeMachine: "Révoquer la machine",
  };

  const messageTone =
    message &&
    /effectuée|purgée|réactivée|réuss/i.test(message)
      ? "success"
      : "error";

  return (
    <PlatformPage>
      <PlatformPageHeader
        alert={
          <>
            {error ? (
              <PlatformAlert tone="error">
                Impossible de charger la fiche : {error}
              </PlatformAlert>
            ) : null}
            {message ? (
              <PlatformAlert tone={messageTone}>
                {message}
              </PlatformAlert>
            ) : null}
            <Link
              href="/platform/clients"
              className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 transition hover:text-emerald-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour aux clients
            </Link>
          </>
        }
        title={identity.ownerName ?? "OWNER non renseigné"}
        description={`${identity.organizationName}${
          identity.ownerEmail ? ` · ${identity.ownerEmail}` : ""
        }`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <PlatformStatusBadge status={identity.accessStatus} />
            <PlatformMetaChip>
              {establishments.length} établissement
              {establishments.length > 1 ? "s" : ""}
            </PlatformMetaChip>
            <PlatformMetaChip>
              {employees.length} employé{employees.length > 1 ? "s" : ""}
            </PlatformMetaChip>
            <PlatformMetaChip>
              {machines.length} machine{machines.length > 1 ? "s" : ""}
            </PlatformMetaChip>
            {trial?.endsAt ? (
              <PlatformMetaChip>
                Fin d’essai {formatPlatformDate(trial.endsAt)}
              </PlatformMetaChip>
            ) : null}
          </div>
        }
        actions={
          <>
            {identity.ownerProfileStatus !== "INACTIVE" ? (
              <PlatformButton
                tone="danger"
                onClick={() => setModal("deactivateOwner")}
              >
                Désactiver le compte
              </PlatformButton>
            ) : (
              <PlatformButton
                tone="success"
                onClick={() => setModal("reactivateOwner")}
              >
                Réactiver le compte
              </PlatformButton>
            )}
            {access.status !== "SUSPENDED" &&
            access.status !== "PENDING_DELETION" ? (
              <PlatformButton tone="danger" onClick={() => setModal("suspend")}>
                Suspendre SaaS
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
            {access.status !== "PENDING_DELETION" ? (
              <PlatformButton tone="danger" onClick={() => setModal("delete")}>
                Planifier suppression
              </PlatformButton>
            ) : (
              <>
                <PlatformButton
                  tone="secondary"
                  onClick={() => setModal("restore")}
                >
                  Restaurer
                </PlatformButton>
                <PlatformButton tone="danger" onClick={() => setModal("purge")}>
                  Supprimer définitivement
                </PlatformButton>
              </>
            )}
            {trial ? (
              <PlatformButton
                tone="secondary"
                onClick={() => setModal("extend")}
              >
                Prolonger essai
              </PlatformButton>
            ) : null}
          </>
        }
        filters={
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition ${
                    active
                      ? "bg-white text-emerald-800 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                  {item.id === "establishments" ? (
                    <span className="tabular-nums text-slate-400">
                      {establishments.length}
                    </span>
                  ) : null}
                  {item.id === "employees" ? (
                    <span className="tabular-nums text-slate-400">
                      {employees.length}
                    </span>
                  ) : null}
                  {item.id === "machines" ? (
                    <span className="tabular-nums text-slate-400">
                      {machines.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        }
      />

      <PlatformBody className="flex flex-col">
        {tab === "identity" ? (
          <PlatformPanel
            className="h-full min-h-0"
            title="Identité du client"
            description="Coordonnées du OWNER et de l’organisation."
          >
            <PlatformTableScroll>
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 lg:p-5">
                <Field
                  label="OWNER principal"
                  value={identity.ownerName ?? "Non renseigné"}
                />
                <Field label="E-mail" value={identity.ownerEmail ?? "—"} />
                <Field label="Téléphone" value={identity.ownerPhone ?? "—"} />
                <Field
                  label="Compte Admin"
                  value={entityBadge(identity.ownerProfileStatus ?? "INACTIVE")}
                />
                <Field label="Organisation" value={identity.organizationName} />
                <Field
                  label="Date de création"
                  value={formatPlatformDate(identity.organizationCreatedAt)}
                />
                <Field
                  label="État SaaS actuel"
                  value={<PlatformStatusBadge status={identity.accessStatus} />}
                />
              </div>
            </PlatformTableScroll>
          </PlatformPanel>
        ) : null}

        {tab === "establishments" ? (
          <PlatformPanel
            className="h-full min-h-0"
            title="Établissements"
            description="Sites rattachés à cette organisation."
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
            description="Membres et profils liés à l’organisation."
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
            description="Période d’essai et historique des prolongations."
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
            description="Formule et période de facturation courantes."
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

        {tab === "machines" ? (
          <PlatformPanel
            className="h-full min-h-0"
            title="Machines"
            description="Appareils enregistrés et contrôle d’accès."
          >
            {machines.length === 0 ? (
              <PlatformEmptyState title="Aucune machine enregistrée." />
            ) : (
              <PlatformTableScroll>
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead className={PLATFORM_TABLE_HEAD}>
                    <tr>
                      <th className={PLATFORM_TH}>Device</th>
                      <th className={PLATFORM_TH}>Établissement</th>
                      <th className={PLATFORM_TH}>Statut</th>
                      <th className={PLATFORM_TH}>Dernière vue</th>
                      <th className={PLATFORM_TH}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {machines.map((m) => (
                      <tr key={m.id} className={PLATFORM_TR}>
                        <td className={PLATFORM_TD}>
                          <p className="font-medium text-slate-900">
                            {m.displayName ?? m.deviceId}
                          </p>
                          <p className="text-[12px] text-slate-500">
                            {m.deviceId}
                          </p>
                        </td>
                        <td className={`${PLATFORM_TD} text-slate-600`}>
                          {m.establishmentName ?? "—"}
                        </td>
                        <td className={`${PLATFORM_TD} text-slate-700`}>
                          {isPlatformMachineStatus(m.status)
                            ? PLATFORM_MACHINE_STATUS_LABELS[m.status]
                            : m.status}
                        </td>
                        <td
                          className={`${PLATFORM_TD} tabular-nums text-slate-600`}
                        >
                          {formatPlatformDateTime(m.lastSeenAt)}
                        </td>
                        <td className={PLATFORM_TD}>
                          {m.status !== "REVOKED" ? (
                            <PlatformButton
                              tone="danger"
                              className="!px-2.5 !py-1.5"
                              onClick={() => {
                                setMachineId(m.id);
                                setModal("revokeMachine");
                              }}
                            >
                              Révoquer
                            </PlatformButton>
                          ) : (
                            <PlatformButton
                              tone="success"
                              className="!px-2.5 !py-1.5"
                              disabled={pending}
                              onClick={() => {
                                setMessage(null);
                                startTransition(async () => {
                                  const result = await reactivateMachineAction({
                                    machineId: m.id,
                                  });
                                  setMessage(
                                    result.ok
                                      ? "Machine réactivée."
                                      : result.error,
                                  );
                                  if (result.ok) router.refresh();
                                });
                              }}
                            >
                              Réactiver
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

        {tab === "licenses" ? (
          <PlatformPanel
            className="h-full min-h-0"
            title="Licences"
            description="Licences émises pour ce client."
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
            description="Paiements confirmés liés à ce client."
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

        {tab === "audit" ? (
          <PlatformPanel
            className="h-full min-h-0"
            title="Journal d’audit"
            description="Événements plateforme concernant ce client."
          >
            {auditEvents.length === 0 ? (
              <PlatformEmptyState title="Aucun événement d’audit." />
            ) : (
              <PlatformTableScroll>
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead className={PLATFORM_TABLE_HEAD}>
                    <tr>
                      <th className={PLATFORM_TH}>Date</th>
                      <th className={PLATFORM_TH}>Action</th>
                      <th className={PLATFORM_TH}>Entité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEvents.map((e) => (
                      <tr key={e.id} className={PLATFORM_TR}>
                        <td
                          className={`${PLATFORM_TD} tabular-nums text-slate-600`}
                        >
                          {formatPlatformDateTime(e.createdAt)}
                        </td>
                        <td className={`${PLATFORM_TD} font-medium text-slate-900`}>
                          {e.action}
                        </td>
                        <td className={`${PLATFORM_TD} text-slate-600`}>
                          {e.entityType ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PlatformTableScroll>
            )}
          </PlatformPanel>
        ) : null}

        {tab === "access" ? (
          <PlatformPanel
            className="h-full min-h-0"
            title="Accès plateforme"
            description="État SaaS, historique et fenêtre de suppression."
          >
            <PlatformTableScroll>
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 lg:p-5">
                <Field
                  label="Statut actuel"
                  value={<PlatformStatusBadge status={access.status} />}
                />
                <Field
                  label="Statut précédent"
                  value={
                    access.previousStatus ? (
                      <PlatformStatusBadge status={access.previousStatus} />
                    ) : (
                      "—"
                    )
                  }
                />
                <Field
                  label="Dernier changement"
                  value={formatPlatformDateTime(access.statusChangedAt)}
                />
                <Field
                  label="Demande de suppression"
                  value={
                    access.deletionRequestedAt
                      ? formatPlatformDateTime(access.deletionRequestedAt)
                      : "Aucune"
                  }
                />
                {access.deletionPurgeAfter ? (
                  <Field
                    label="Purge prévue après"
                    value={formatPlatformDateTime(access.deletionPurgeAfter)}
                  />
                ) : null}
              </div>
            </PlatformTableScroll>
          </PlatformPanel>
        ) : null}
      </PlatformBody>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
            <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
              {modalTitle[modal]}
            </h3>
            {modal === "extend" ? (
              <label className="mt-4 block text-[12px] font-medium text-slate-700">
                Jours supplémentaires
                <input
                  type="number"
                  min={1}
                  value={extraDays}
                  onChange={(e) => setExtraDays(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
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
                modal === "deactivateOwner"
                  ? "Motif (obligatoire)"
                  : "Note / motif"}
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  required={
                    modal === "suspend" || modal === "deactivateOwner"
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
                  modal === "delete"
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
