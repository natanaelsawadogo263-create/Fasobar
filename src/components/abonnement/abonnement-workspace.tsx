"use client";

import { useState, useTransition } from "react";
import { InstantLink as Link } from "@/components/layout/instant-link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, LogOut } from "lucide-react";

import {
  changeSubscriptionRequestPlanAction,
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

function formatOrangeMoneyNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const national =
    digits.startsWith("226") && digits.length >= 11
      ? digits.slice(3, 11)
      : digits.length >= 8
        ? digits.slice(-8)
        : digits;
  if (national.length === 8) {
    return `+226 ${national.slice(0, 2)} ${national.slice(2, 4)} ${national.slice(4, 6)} ${national.slice(6, 8)}`;
  }
  return raw.trim() || "+226 57 53 72 99";
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
    data.openRequest?.planId ??
      data.plans.find((p) => p.code === "MONTHLY")?.id ??
      data.plans[0]?.id ??
      "",
  );
  const [proofForm, setProofForm] = useState({
    payerPhone: "",
    payerName: "",
  });
  const [proofFile, setProofFile] = useState<File | null>(null);

  const selectedPlan = data.plans.find((p) => p.id === selectedPlanId) ?? null;
  const canOpenApp =
    data.access.status === "TRIAL" || data.access.status === "ACTIVE";
  const needsProof =
    data.openRequest != null &&
    (data.openRequest.status === "PENDING_PAYMENT" ||
      data.openRequest.status === "NEEDS_NEW_PROOF");
  const awaitingReview =
    data.openRequest != null &&
    (data.openRequest.status === "PAYMENT_SUBMITTED" ||
      data.openRequest.status === "UNDER_REVIEW");
  const canChangePlan =
    !data.openRequest ||
    data.openRequest.status === "PENDING_PAYMENT" ||
    data.openRequest.status === "NEEDS_NEW_PROOF";
  const showSubscribeCta = !data.openRequest && data.plans.length > 0;
  const showBackToApp = canOpenApp;
  const depositNumber = formatOrangeMoneyNumber(
    data.openRequest?.orangeMoneyNumber ||
      data.orangeMoneyNumber ||
      "+22657537299",
  );

  function selectPlan(planId: string) {
    if (!canChangePlan || planId === selectedPlanId) return;
    setSelectedPlanId(planId);

    if (!data.openRequest || data.openRequest.planId === planId) return;

    setMessage(null);
    startTransition(async () => {
      const result = await changeSubscriptionRequestPlanAction({
        requestId: data.openRequest!.id,
        planId,
      });
      showResult(
        result.ok,
        result.ok
          ? "Formule mise à jour. Payez le nouveau montant indiqué."
          : (result.error ?? "Impossible de changer de formule."),
      );
      if (!result.ok) {
        setSelectedPlanId(data.openRequest!.planId);
      }
    });
  }

  function showResult(ok: boolean, text: string) {
    setMessageTone(ok ? "ok" : "err");
    setMessage(text);
    if (ok) router.refresh();
  }

  if (!data.canAccessZone) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
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
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white"
          >
            Voir le message d’accès
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col overflow-hidden bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            FasoBar ·{" "}
            {isRenewalIntent && canOpenApp ? "Renouvellement" : "Abonnement"}
          </p>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-900">
            {data.organizationName}
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {PLATFORM_ACCESS_STATUS_LABELS[data.access.status] ??
              data.access.status}
          </p>
        </div>
        {showBackToApp ? (
          <Link
            href="/application/mon-abonnement"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour
          </Link>
        ) : (
          <form action={signOutAction} className="shrink-0">
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Quitter
            </button>
          </form>
        )}
      </header>

      <div className="app-scroll mt-5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="space-y-5 pb-4">
          {data.error ? (
            <p className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-red-700">
              {data.error}
            </p>
          ) : null}
          {message ? (
            <p
              className={`rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] ${
                messageTone === "ok" ? "text-slate-800" : "text-red-700"
              }`}
            >
              {message}
            </p>
          ) : null}

          {(data.trialEndsAt || data.currentSubscription || canOpenApp) && (
            <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-1 text-[13px] text-slate-600">
                  {data.trialEndsAt ? (
                    <p>
                      Essai jusqu’au{" "}
                      <span className="font-medium text-slate-900">
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
                      · fin {formatDate(data.currentSubscription.endsAt)}
                    </p>
                  ) : null}
                  {isRenewalIntent && canOpenApp ? (
                    <p className="text-[12px] text-slate-500">
                      Le renouvellement prolonge votre période actuelle sans
                      interruption.
                    </p>
                  ) : null}
                </div>
                {canOpenApp ? (
                  <Link
                    href="/application"
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 px-3.5 text-[12px] font-semibold text-white hover:bg-slate-800"
                  >
                    Ouvrir l’application
                  </Link>
                ) : null}
              </div>
            </section>
          )}

          {data.trialEligible && !awaitingReview ? (
            <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <h2 className="text-[14px] font-semibold text-slate-900">
                Essai gratuit
              </h2>
              <p className="mt-1 text-[13px] text-slate-500">
                {data.trialDurationDays} jour
                {data.trialDurationDays > 1 ? "s" : ""} sans paiement · un seul
                essai
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
                className="mt-4 flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white text-[13px] font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
              >
                Démarrer l’essai
              </button>
            </section>
          ) : null}

          {awaitingReview ? (
            <section className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-slate-900" />
              <h2 className="mt-4 text-[16px] font-semibold text-slate-900">
                Preuve d’abonnement envoyée
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-slate-600">
                L’équipe FasoBar va se charger d’examiner votre demande. Vous
                serez notifié dès que le paiement sera validé.
              </p>
              {data.openRequest ? (
                <p className="mt-4 text-[12px] text-slate-500">
                  Demande {data.openRequest.referenceCode} ·{" "}
                  {data.openRequest.planName} ·{" "}
                  {formatXof(data.openRequest.expectedAmountXof)}
                </p>
              ) : null}
              {canOpenApp ? (
                <Link
                  href="/application"
                  className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-[13px] font-semibold text-white hover:bg-slate-800"
                >
                  Retour à l’application
                </Link>
              ) : null}
            </section>
          ) : null}

          {!awaitingReview ? (
          <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <h2 className="text-[14px] font-semibold text-slate-900">
              {canOpenApp ? "Formule à renouveler" : "Choisir une formule"}
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              Mensuelle ou annuelle — le montant à payer suit votre choix.
            </p>

            {data.plans.length === 0 ? (
              <p className="mt-4 text-[13px] text-slate-500">
                Aucune formule active.
              </p>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {data.plans.map((plan) => {
                  const selected = selectedPlanId === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={!canChangePlan || pending}
                      onClick={() => selectPlan(plan.id)}
                      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition ${
                        selected
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      } disabled:cursor-default disabled:opacity-60`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300"
                        }`}
                      >
                        {selected ? <Check className="h-2.5 w-2.5" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-slate-900">
                          {plan.name}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-slate-500">
                          {plan.durationMonths} mois · {plan.maxMachines}{" "}
                          machine{plan.maxMachines > 1 ? "s" : ""}
                        </span>
                        <span className="mt-2 block text-[14px] font-semibold tabular-nums text-slate-900">
                          {formatXof(plan.priceXof)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {data.openRequest ? (
              <p className="mt-4 border-t border-slate-100 pt-3 text-[12px] text-slate-500">
                Demande {data.openRequest.referenceCode} ·{" "}
                {PLATFORM_REQUEST_STATUS_LABELS[data.openRequest.status]}
              </p>
            ) : null}
          </section>
          ) : null}

          {!awaitingReview ? (
          <section className="rounded-xl border border-slate-200 bg-white px-4 py-5">
            <h2 className="text-[14px] font-semibold text-slate-900">
              Où déposer le paiement
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              Effectuez le dépôt Orange Money uniquement sur ce numéro FasoBar.
              Aucun autre numéro n’est valide.
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                Orange Money
              </p>
              <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-wide text-slate-900 sm:text-[28px]">
                {depositNumber}
              </p>
              <p className="mt-2 text-[12px] text-slate-500">
                Burkina Faso · numéro officiel FasoBar
              </p>
            </div>
            {data.paymentInstructions ? (
              <p className="mt-3 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-500">
                {data.paymentInstructions}
              </p>
            ) : null}
          </section>
          ) : null}

          {needsProof ? (
            <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <h2 className="text-[14px] font-semibold text-slate-900">
                Envoyer la preuve
              </h2>
              <dl className="mt-3 grid gap-2 border-b border-slate-100 pb-3 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Formule</dt>
                  <dd className="font-medium text-slate-900">
                    {data.openRequest!.planName}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Montant</dt>
                  <dd className="font-medium tabular-nums text-slate-900">
                    {formatXof(data.openRequest!.expectedAmountXof)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Numéro de dépôt</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {depositNumber}
                  </dd>
                </div>
              </dl>

              <form
                className="mt-4 grid gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!proofFile) {
                    showResult(false, "Ajoutez une capture d’écran.");
                    return;
                  }
                  const fd = new FormData();
                  fd.set("requestId", data.openRequest!.id);
                  fd.set("payerPhone", proofForm.payerPhone);
                  fd.set("payerName", proofForm.payerName);
                  fd.set(
                    "declaredAmountXof",
                    String(data.openRequest!.expectedAmountXof),
                  );
                  fd.set("file", proofFile);
                  startTransition(async () => {
                    const result = await uploadSubscriptionProofAction(fd);
                    if (result.ok) {
                      setProofFile(null);
                      setMessage(null);
                      router.refresh();
                      return;
                    }
                    showResult(false, result.error ?? "Envoi impossible.");
                  });
                }}
              >
                <label className="block text-[12px] font-medium text-slate-700">
                  Téléphone payeur
                  <input
                    required
                    value={proofForm.payerPhone ?? ""}
                    onChange={(e) =>
                      setProofForm((f) => ({
                        ...f,
                        payerPhone: e.target.value,
                      }))
                    }
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:border-slate-400"
                  />
                </label>
                <label className="block text-[12px] font-medium text-slate-700">
                  Nom payeur
                  <input
                    value={proofForm.payerName ?? ""}
                    onChange={(e) =>
                      setProofForm((f) => ({
                        ...f,
                        payerName: e.target.value,
                      }))
                    }
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:border-slate-400"
                  />
                </label>
                <label className="block text-[12px] font-medium text-slate-700 sm:col-span-2">
                  Capture du reçu de transaction
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                    className="mt-1.5 block w-full text-[13px] text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-[12px] file:font-medium file:text-slate-700"
                  />
                </label>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex h-11 items-center justify-center rounded-lg bg-slate-900 text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:col-span-2"
                >
                  Envoyer la preuve
                </button>
              </form>
            </section>
          ) : null}

          {data.requests.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <h2 className="text-[14px] font-semibold text-slate-900">
                Historique
              </h2>
              <ul className="mt-2 divide-y divide-slate-100">
                {data.requests.map((req) => (
                  <li
                    key={req.id}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5 text-[13px]"
                  >
                    <span className="font-medium text-slate-900">
                      {req.referenceCode}
                    </span>
                    <span className="text-slate-500">{req.planName}</span>
                    <span className="text-slate-400">
                      {PLATFORM_REQUEST_STATUS_LABELS[req.status]}
                    </span>
                    <span className="ml-auto tabular-nums text-[12px] text-slate-400">
                      {formatDate(req.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      {showSubscribeCta ? (
        <footer className="mt-4 shrink-0 border-t border-slate-200 bg-slate-50 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 text-[13px] text-slate-600">
              <span className="text-slate-500">À payer · </span>
              <span className="font-semibold text-slate-900">
                {selectedPlan
                  ? `${selectedPlan.name} · ${formatXof(selectedPlan.priceXof)}`
                  : "Aucune formule"}
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
