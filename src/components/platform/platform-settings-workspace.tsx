"use client";

import { useState, useTransition, type FormEvent } from "react";

import {
  PlatformAlert,
  PlatformBody,
  PlatformButton,
  PlatformEmptyState,
  PlatformMetaChip,
  PlatformPage,
  PlatformPageHeader,
  PlatformPanel,
  formatPlatformXof,
} from "@/components/platform/platform-ui";
import { useToast } from "@/components/ui/toast";
import {
  updatePlatformSettingsAction,
  updateSubscriptionPlanAdminAction,
} from "@/lib/platform/actions";
import type {
  PlatformPlanAdminRow,
  PlatformSettingsRow,
} from "@/lib/platform/settings-queries";

const fieldClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const labelClass = "block text-[12px] font-medium text-slate-700";

type Props = {
  settings: PlatformSettingsRow | null;
  plans: PlatformPlanAdminRow[];
  error?: string | null;
};

export function PlatformSettingsWorkspace({
  settings,
  plans,
  error = null,
}: Props) {
  const [form, setForm] = useState({
    orangeMoneyNumber: settings?.orangeMoneyNumber ?? "",
    trialDurationDays: settings?.trialDurationDays ?? 7,
    trialEnabled: settings?.trialEnabled ?? true,
    warningDaysBeforeExpiry: settings?.warningDaysBeforeExpiry ?? 7,
    offlineGraceDays: settings?.offlineGraceDays ?? 3,
    deletionRecoveryDays: settings?.deletionRecoveryDays ?? 30,
    subscriptionReferencePrefix: settings?.subscriptionReferencePrefix ?? "FSB",
    paymentInstructions: settings?.paymentInstructions ?? "",
    licenseMinAppVersion: settings?.licenseMinAppVersion ?? "",
  });
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function saveSettings(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updatePlatformSettingsAction({
        orangeMoneyNumber: form.orangeMoneyNumber,
        trialDurationDays: Number(form.trialDurationDays),
        trialEnabled: form.trialEnabled,
        warningDaysBeforeExpiry: Number(form.warningDaysBeforeExpiry),
        offlineGraceDays: Number(form.offlineGraceDays),
        deletionRecoveryDays: Number(form.deletionRecoveryDays),
        subscriptionReferencePrefix: form.subscriptionReferencePrefix,
        paymentInstructions: form.paymentInstructions || null,
        licenseMinAppVersion: form.licenseMinAppVersion || null,
      });
      if (result.ok) {
        toast.success("Paramètres enregistrés.");
      } else {
        toast.error(result.error ?? "Action impossible.");
      }
    });
  }

  return (
    <PlatformPage>
      <PlatformPageHeader
        embedded
        title="Paramètres plateforme"
        meta={
          <div className="flex flex-wrap gap-2">
            <PlatformMetaChip>
              {plans.length} formule{plans.length > 1 ? "s" : ""}
            </PlatformMetaChip>
            <PlatformMetaChip>
              Préfixe {form.subscriptionReferencePrefix || "—"}
            </PlatformMetaChip>
          </div>
        }
        actions={
          <PlatformButton
            type="submit"
            form="platform-settings-form"
            tone="primary"
            disabled={pending}
          >
            Enregistrer
          </PlatformButton>
        }
        alert={
          error ? (
            <PlatformAlert tone="error">
              Impossible de charger les paramètres : {error}
            </PlatformAlert>
          ) : null
        }
      />

      <PlatformBody>
        <div className="app-scroll h-full min-h-0 overflow-auto">
          <form
            id="platform-settings-form"
            className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2"
            onSubmit={saveSettings}
          >
            <PlatformPanel
              title="Paiement"
              description="Coordonnées Orange Money et instructions affichées aux clients."
            >
              <div className="space-y-3 p-4 lg:px-5 lg:pb-5">
                <label className={labelClass}>
                  Numéro Orange Money
                  <input
                    value={form.orangeMoneyNumber}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        orangeMoneyNumber: e.target.value,
                      }))
                    }
                    className={fieldClass}
                    required
                  />
                </label>
                <label className={labelClass}>
                  Préfixe références
                  <input
                    value={form.subscriptionReferencePrefix}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        subscriptionReferencePrefix: e.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </label>
                <label className={labelClass}>
                  Instructions de paiement
                  <textarea
                    rows={4}
                    value={form.paymentInstructions}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        paymentInstructions: e.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </label>
              </div>
            </PlatformPanel>

            <PlatformPanel
              title="Essai"
              description="Durée par défaut pour tous les nouveaux clients FasoBar. Pour un client précis, prolongez depuis sa fiche."
            >
              <div className="space-y-3 p-4 lg:px-5 lg:pb-5">
                <label className="inline-flex items-center gap-2 text-[13px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.trialEnabled}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        trialEnabled: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-300"
                  />
                  Essai gratuit activé
                </label>
                <label className={labelClass}>
                  Durée essai (jours)
                  <input
                    type="number"
                    min={1}
                    value={form.trialDurationDays}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        trialDurationDays: Number(e.target.value),
                      }))
                    }
                    className={fieldClass}
                  />
                  <span className="mt-1 block text-[11px] font-normal text-slate-500">
                    Défaut recommandé : 7 jours. Augmentez ici pour tous les
                    nouveaux essais.
                  </span>
                </label>
                <label className={labelClass}>
                  Alerte expiration (j)
                  <input
                    type="number"
                    min={0}
                    value={form.warningDaysBeforeExpiry}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        warningDaysBeforeExpiry: Number(e.target.value),
                      }))
                    }
                    className={fieldClass}
                  />
                </label>
              </div>
            </PlatformPanel>

            <PlatformPanel
              title="Abonnements / plans"
              description="Prix et activation des formules proposées aux clients."
              className="lg:col-span-2"
            >
              <div className="p-4 lg:px-5 lg:pb-5">
                {plans.length === 0 ? (
                  <PlatformEmptyState
                    title="Aucune formule"
                    description="Aucune formule d’abonnement disponible."
                  />
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {plans.map((plan) => (
                      <li
                        key={plan.id}
                        className="rounded-2xl border border-slate-200/90 bg-slate-50/40 px-4 py-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[13px] font-semibold text-slate-900">
                              {plan.name}{" "}
                              <span className="font-normal text-slate-500">
                                ({plan.code})
                              </span>
                            </p>
                            <p className="mt-0.5 text-[12px] text-slate-600">
                              {formatPlatformXof(plan.priceXof)} ·{" "}
                              {plan.durationMonths} mois · {plan.maxMachines}{" "}
                              machine
                              {plan.maxMachines > 1 ? "s" : ""}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                              plan.isActive
                                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                                : "bg-slate-100 text-slate-700 ring-slate-200"
                            }`}
                          >
                            {plan.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <PlatformButton
                            disabled={pending}
                            onClick={() => {
                              const raw = window.prompt(
                                "Nouveau prix XOF :",
                                String(plan.priceXof),
                              );
                              if (raw == null) return;
                              const price = Number(raw);
                              if (!Number.isFinite(price) || price < 0) {
                                toast.error("Prix invalide.");
                                return;
                              }
                              startTransition(async () => {
                                const result =
                                  await updateSubscriptionPlanAdminAction({
                                    planId: plan.id,
                                    patch: { priceXof: Math.floor(price) },
                                  });
                                if (result.ok) {
                                  toast.success("Prix mis à jour.");
                                } else {
                                  toast.error(
                                    result.error ?? "Action impossible.",
                                  );
                                }
                              });
                            }}
                          >
                            Modifier le prix
                          </PlatformButton>
                          <PlatformButton
                            disabled={pending}
                            onClick={() => {
                              startTransition(async () => {
                                const result =
                                  await updateSubscriptionPlanAdminAction({
                                    planId: plan.id,
                                    patch: { isActive: !plan.isActive },
                                  });
                                if (result.ok) {
                                  toast.success(
                                    plan.isActive
                                      ? "Formule désactivée."
                                      : "Formule activée.",
                                  );
                                } else {
                                  toast.error(
                                    result.error ?? "Action impossible.",
                                  );
                                }
                              });
                            }}
                          >
                            {plan.isActive ? "Désactiver" : "Activer"}
                          </PlatformButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PlatformPanel>

            <PlatformPanel
              title="Licences"
              description="Contraintes techniques pour les applications licenciées."
            >
              <div className="space-y-3 p-4 lg:px-5 lg:pb-5">
                <label className={labelClass}>
                  Version app minimale
                  <input
                    value={form.licenseMinAppVersion}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        licenseMinAppVersion: e.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </label>
                <label className={labelClass}>
                  Grâce hors-ligne (j)
                  <input
                    type="number"
                    min={0}
                    value={form.offlineGraceDays}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        offlineGraceDays: Number(e.target.value),
                      }))
                    }
                    className={fieldClass}
                  />
                </label>
              </div>
            </PlatformPanel>

            <PlatformPanel
              title="Suppression"
              description="Délai de récupération avant purge définitive d’un compte client."
            >
              <div className="space-y-3 p-4 lg:px-5 lg:pb-5">
                <label className={labelClass}>
                  Récupération suppression (j)
                  <input
                    type="number"
                    min={1}
                    value={form.deletionRecoveryDays}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        deletionRecoveryDays: Number(e.target.value),
                      }))
                    }
                    className={fieldClass}
                  />
                </label>
              </div>
            </PlatformPanel>
          </form>
        </div>
      </PlatformBody>
    </PlatformPage>
  );
}
