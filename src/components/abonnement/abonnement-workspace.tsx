"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, LogOut, ShieldCheck } from "lucide-react";

import {
  createSubscriptionRequestAction,
  startOrganizationTrialAction,
  uploadSubscriptionProofAction,
} from "@/lib/abonnement/actions";
import type { AbonnementPageData } from "@/lib/abonnement/queries";
import {
  PLATFORM_REQUEST_STATUS_LABELS,
  PLATFORM_SUBSCRIPTION_STATUS_LABELS,
} from "@/lib/platform/access";
import { PLATFORM_ACCESS_STATUS_LABELS } from "@/lib/platform/statuses";
import { signOutAction } from "@/lib/auth/actions";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formatXof(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " F CFA";
}

type Props = {
  data: AbonnementPageData;
  renewalIntent?: boolean;
};

export function AbonnementWorkspace({
  data,
  renewalIntent = false,
}: Props) {
  const router = useRouter();
  const isRenewalIntent =
    renewalIntent ||
    data.access.status === "ACTIVE" ||
    data.access.status === "TRIAL";
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"ok" | "err">("ok");
  const [pending, startTransition] = useTransition();
  const [selectedPlanId, setSelectedPlanId] = useState(
    data.plans.find((p) => p.code === "MONTHLY")?.id ?? data.plans[0]?.id ?? "",
  );
  const [proofForm, setProofForm] = useState({
    transactionReference: "",
    payerPhone: "",
    payerName: "",
    declaredAmountXof: data.openRequest?.expectedAmountXof?.toString() ?? "",
  });
  const [proofFile, setProofFile] = useState<File | null>(null);

  const selectedPlan = data.plans.find((p) => p.id === selectedPlanId) ?? null;
  const canOpenApp =
    data.access.status === "TRIAL" || data.access.status === "ACTIVE";
  const needsProof =
    data.openRequest != null &&
    (data.openRequest.status === "PENDING_PAYMENT" ||
      data.openRequest.status === "NEEDS_NEW_PROOF");
  const showSubscribeCta = !data.openRequest && data.plans.length > 0;
  const showBackToApp = canOpenApp;

  function showResult(ok: boolean, text: string) {
    setMessageTone(ok ? "ok" : "err");
    setMessage(text);
    if (ok) router.refresh();
  }

  if (!data.canAccessZone) {
    return (
      <div className="flex h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            Abonnement indisponible
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            État :{" "}
            {PLATFORM_ACCESS_STATUS_LABELS[data.access.status] ??
              data.access.status}
          </p>
          <Link
            href="/acces-saas-bloque"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white"
          >
            Voir le message d’accès
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col overflow-hidden px-3 py-3 sm:px-5 sm:py-4">
      <header className="flex shrink-0 items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
              FasoBar ·{" "}
              {isRenewalIntent && canOpenApp ? "Renouvellement" : "Abonnement"}
            </p>
            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              {PLATFORM_ACCESS_STATUS_LABELS[data.access.status] ??
                data.access.status}
            </span>
          </div>
          <h1 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-slate-900 sm:text-base">
            {data.organizationName}
          </h1>
        </div>
        {showBackToApp ? (
          <Link
            href="/application/mon-abonnement"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mon abonnement</span>
          </Link>
        ) : (
          <form action={signOutAction} className="shrink-0">
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Quitter</span>
            </button>
          </form>
        )}
      </header>

      {/* Corps scrollable — rien n’est coupé hors de cette zone */}
      <div className="app-scroll mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-xl">
        <div className="space-y-3 pb-2">
          {data.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
              {data.error}
            </div>
          ) : null}
          {message ? (
            <div
              className={`rounded-lg border px-3 py-2 text-[12px] ${
                messageTone === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {message}
            </div>
          ) : null}

          {isRenewalIntent && canOpenApp ? (
            <div className="flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <p className="text-[12px] leading-relaxed text-emerald-900">
                Renouvellement anticipé : après validation du paiement, la
                nouvelle période commence à la fin de l’abonnement en cours —
                votre activité continue sans interruption.
              </p>
            </div>
          ) : null}

          {(data.trialEndsAt || data.currentSubscription || canOpenApp) && (
            <section className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 text-[12px] text-slate-700">
                  {data.trialEndsAt ? (
                    <p>
                      Essai jusqu’au{" "}
                      <span className="font-semibold text-slate-900">
                        {formatDate(data.trialEndsAt)}
                      </span>
                    </p>
                  ) : null}
                  {data.currentSubscription ? (
                    <p>
                      {data.currentSubscription.planName ?? "Formule"} ·{" "}
                      {
                        PLATFORM_SUBSCRIPTION_STATUS_LABELS[
                          data.currentSubscription.status
                        ]
                      }{" "}
                      · {formatDate(data.currentSubscription.endsAt)}
                    </p>
                  ) : null}
                </div>
                {canOpenApp ? (
                  <Link
                    href="/application"
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-3.5 text-[12px] font-semibold text-white"
                  >
                    Ouvrir l’application
                  </Link>
                ) : null}
              </div>
            </section>
          )}

          {/* Essai + Abonnement côte à côte sur grand écran */}
          <div
            className={`grid gap-3 ${
              data.trialEligible ? "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : ""
            }`}
          >
            {data.trialEligible ? (
              <section className="flex flex-col rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-3">
                <h2 className="text-[13px] font-semibold text-slate-900">
                  Essai gratuit
                </h2>
                <p className="mt-1 flex-1 text-[12px] leading-snug text-slate-600">
                  {data.trialDurationMonths} mois sans paiement · 1 essai max
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setMessage(null);
                    startTransition(async () => {
                      const result = await startOrganizationTrialAction();
                      showResult(
                        result.ok,
                        result.ok
                          ? "Essai démarré. Vous pouvez ouvrir l’application."
                          : (result.error ?? "Action impossible."),
                      );
                    });
                  }}
                  className="mt-3 flex h-10 w-full items-center justify-center rounded-lg bg-emerald-700 text-[13px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  Démarrer l’essai ({data.trialDurationMonths} mois)
                </button>
              </section>
            ) : null}

            <section className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-[13px] font-semibold text-slate-900">
                  {canOpenApp ? "Choisir la formule à renouveler" : "S’abonner"}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Orange Money{" "}
                  <span className="font-semibold text-slate-800">
                    {data.openRequest?.orangeMoneyNumber ??
                      data.orangeMoneyNumber}
                  </span>
                </p>
              </div>
              {data.paymentInstructions ? (
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
                  {data.paymentInstructions}
                </p>
              ) : null}

              {data.plans.length === 0 ? (
                <p className="mt-3 text-[12px] text-slate-500">
                  Aucune formule active.
                </p>
              ) : (
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {data.plans.map((plan) => {
                    const selected = selectedPlanId === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        disabled={Boolean(data.openRequest)}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                          selected
                            ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        } disabled:cursor-default disabled:opacity-70`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-300"
                          }`}
                        >
                          {selected ? <Check className="h-2.5 w-2.5" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-semibold text-slate-900">
                            {plan.name}
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            {plan.durationMonths} mois · {plan.maxMachines}{" "}
                            machine{plan.maxMachines > 1 ? "s" : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-slate-900">
                          {formatXof(plan.priceXof)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {data.openRequest ? (
                <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[12px] text-amber-950">
                  Demande{" "}
                  <span className="font-semibold">
                    {data.openRequest.referenceCode}
                  </span>{" "}
                  — {PLATFORM_REQUEST_STATUS_LABELS[data.openRequest.status]}
                </div>
              ) : null}
            </section>
          </div>

          {needsProof ? (
            <section className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3">
              <h2 className="text-[13px] font-semibold text-slate-900">
                Preuve de paiement
              </h2>
              <p className="mt-0.5 text-[12px] text-slate-600">
                Montant attendu :{" "}
                <span className="font-semibold">
                  {formatXof(data.openRequest!.expectedAmountXof)}
                </span>
              </p>
              <form
                className="mt-2.5 grid gap-2 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!proofFile) {
                    showResult(false, "Ajoutez une capture d’écran.");
                    return;
                  }
                  const fd = new FormData();
                  fd.set("requestId", data.openRequest!.id);
                  fd.set("transactionReference", proofForm.transactionReference);
                  fd.set("payerPhone", proofForm.payerPhone);
                  fd.set("payerName", proofForm.payerName);
                  fd.set("declaredAmountXof", proofForm.declaredAmountXof);
                  fd.set("file", proofFile);
                  startTransition(async () => {
                    const result = await uploadSubscriptionProofAction(fd);
                    showResult(
                      result.ok,
                      result.ok
                        ? "Preuve envoyée. Elle sera examinée par FasoBar."
                        : (result.error ?? "Envoi impossible."),
                    );
                    if (result.ok) {
                      setProofFile(null);
                      setProofForm((f) => ({
                        ...f,
                        transactionReference: "",
                      }));
                    }
                  });
                }}
              >
                <label className="block text-[11px] font-medium text-slate-700">
                  Référence transaction
                  <input
                    required
                    value={proofForm.transactionReference}
                    onChange={(e) =>
                      setProofForm((f) => ({
                        ...f,
                        transactionReference: e.target.value,
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12px] outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="block text-[11px] font-medium text-slate-700">
                  Téléphone payeur
                  <input
                    required
                    value={proofForm.payerPhone}
                    onChange={(e) =>
                      setProofForm((f) => ({
                        ...f,
                        payerPhone: e.target.value,
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12px] outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="block text-[11px] font-medium text-slate-700">
                  Nom payeur
                  <input
                    value={proofForm.payerName}
                    onChange={(e) =>
                      setProofForm((f) => ({
                        ...f,
                        payerName: e.target.value,
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12px] outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="block text-[11px] font-medium text-slate-700">
                  Montant (XOF)
                  <input
                    type="number"
                    min={0}
                    value={proofForm.declaredAmountXof}
                    onChange={(e) =>
                      setProofForm((f) => ({
                        ...f,
                        declaredAmountXof: e.target.value,
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12px] outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="block text-[11px] font-medium text-slate-700 sm:col-span-2">
                  Capture (JPEG / PNG / WebP)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-[12px]"
                  />
                </label>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex h-10 items-center justify-center rounded-lg bg-emerald-700 text-[12px] font-semibold text-white disabled:opacity-60 sm:col-span-2"
                >
                  Envoyer la preuve
                </button>
              </form>
            </section>
          ) : null}

          {data.requests.length > 0 ? (
            <section className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3">
              <h2 className="text-[12px] font-semibold text-slate-900">
                Historique
              </h2>
              <ul className="mt-1.5 divide-y divide-slate-100">
                {data.requests.map((req) => (
                  <li
                    key={req.id}
                    className="flex flex-wrap items-center gap-1.5 py-2"
                  >
                    <span className="text-[12px] font-medium text-slate-900">
                      {req.referenceCode}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {req.planName}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                      {PLATFORM_REQUEST_STATUS_LABELS[req.status]}
                    </span>
                    <span className="ml-auto text-[10px] tabular-nums text-slate-400">
                      {formatDate(req.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      {/* Pied fixe — toujours entièrement visible */}
      {showSubscribeCta ? (
        <footer className="mt-3 shrink-0 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-[0_-1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 text-[12px] text-slate-600">
              <span className="text-slate-500">Formule · </span>
              <span className="font-semibold text-slate-900">
                {selectedPlan
                  ? `${selectedPlan.name} · ${formatXof(selectedPlan.priceXof)}`
                  : "Aucune"}
              </span>
            </div>
            <button
              type="button"
              disabled={pending || !selectedPlanId}
              onClick={() => {
                setMessage(null);
                startTransition(async () => {
                  const result = await createSubscriptionRequestAction({
                    planId: selectedPlanId,
                  });
                  showResult(
                    result.ok,
                    result.ok
                      ? "Demande créée. Envoyez votre preuve de paiement."
                      : (result.error ?? "Action impossible."),
                  );
                });
              }}
              className="flex h-11 w-full shrink-0 items-center justify-center rounded-lg bg-slate-900 px-4 text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto sm:min-w-[220px]"
            >
              {canOpenApp
                ? "Créer la demande de renouvellement"
                : "Créer la demande d’abonnement"}
            </button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
