"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import { recordPaymentsAction } from "@/app/(protected)/application/caisse/payment-actions";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { AlertMessage } from "@/components/auth/alert-message";
import { CheckoutConfirmPanel } from "@/components/payments/checkout-confirm-panel";
import { CheckoutOrderDetail } from "@/components/payments/checkout-order-detail";
import { CheckoutPaymentCenter } from "@/components/payments/checkout-payment-center";
import type { DraftPaymentLine } from "@/components/payments/checkout-payment-panel";
import { PaymentSuccessScreen } from "@/components/payments/payment-success-screen";
import { formatOrderNumber } from "@/lib/orders/constants";
import { calculateChange, formatPriceXof } from "@/lib/payments/constants";
import type { PaymentMethod } from "@/lib/payments/schemas";
import type { OrderPaymentSummary } from "@/lib/payments/types";

type CheckoutWorkspaceProps = {
  summary: OrderPaymentSummary;
  hasActiveCashSession: boolean;
};

export function CheckoutWorkspace({
  summary,
  hasActiveCashSession,
}: CheckoutWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("CASH");
  const [draftLines, setDraftLines] = useState<DraftPaymentLine[]>([]);
  const [amountReceived, setAmountReceived] = useState(() =>
    String(Math.max(summary.remainingAmount, 0)),
  );
  const [transactionReference, setTransactionReference] = useState("");
  const [successState, setSuccessState] = useState<{
    receiptId?: string;
    changeGiven: number;
    totalPaid: number;
  } | null>(null);

  const draftTotal = draftLines.reduce((sum, line) => sum + line.amountApplied, 0);
  const projectedRemaining = Math.max(summary.remainingAmount - draftTotal, 0);

  const currentReceived = Number.parseInt(amountReceived, 10) || 0;
  const currentChange =
    selectedMethod === "CASH"
      ? calculateChange(currentReceived, projectedRemaining)
      : 0;

  const canCheckout =
    summary.status !== "CANCELLED" &&
    summary.paymentStatus !== "PAID" &&
    summary.remainingAmount > 0;

  const methodRequiresSession = selectedMethod === "CASH" && !hasActiveCashSession;

  /** Lignes prêtes à envoyer : brouillon ou paiement direct sur le solde. */
  function resolvePaymentLines(): { lines: DraftPaymentLine[]; error?: string } {
    if (draftLines.length > 0) {
      return { lines: draftLines };
    }

    const applied = projectedRemaining;
    if (!applied || applied <= 0) {
      return { lines: [], error: "Aucun montant restant à encaisser." };
    }

    if (selectedMethod === "CASH") {
      if (!hasActiveCashSession) {
        return {
          lines: [],
          error: "Ouvrez une session de caisse pour encaisser en espèces.",
        };
      }
      const received = Number.parseInt(amountReceived, 10) || 0;
      if (received < applied) {
        return {
          lines: [],
          error: "Le montant reçu doit couvrir le total de la commande.",
        };
      }
    }

    return {
      lines: [
        {
          id: crypto.randomUUID(),
          method: selectedMethod,
          amountApplied: applied,
          amountReceived:
            selectedMethod === "CASH"
              ? Number.parseInt(amountReceived, 10) || applied
              : 0,
          transactionReference: transactionReference.trim(),
        },
      ],
    };
  }

  const previewLines =
    draftLines.length > 0
      ? draftLines
      : projectedRemaining > 0
        ? [
            {
              id: "preview",
              method: selectedMethod,
              amountApplied: projectedRemaining,
              amountReceived:
                selectedMethod === "CASH"
                  ? currentReceived || projectedRemaining
                  : 0,
              transactionReference: transactionReference.trim(),
            } satisfies DraftPaymentLine,
          ]
        : [];

  const previewTotal = previewLines.reduce((sum, line) => sum + line.amountApplied, 0);
  const canConfirm =
    !isPending &&
    canCheckout &&
    (draftLines.length > 0 || projectedRemaining > 0) &&
    !(selectedMethod === "CASH" && draftLines.length === 0 && !hasActiveCashSession);

  function handleSelectMethod(method: PaymentMethod) {
    setSelectedMethod(method);
    setError(null);
    if (method === "CASH") {
      setAmountReceived(String(projectedRemaining > 0 ? projectedRemaining : summary.remainingAmount));
    }
  }

  function handleAddLine() {
    const resolved = resolvePaymentLines();
    if (resolved.error || resolved.lines.length === 0) {
      setError(resolved.error ?? "Impossible d'ajouter ce paiement.");
      return;
    }

    // Si le brouillon est vide, resolve renvoie la ligne du formulaire ;
    // on l'ajoute. S'il y a déjà des lignes, resolve les renvoie telles quelles —
    // dans ce cas on veut ajouter une NOUVELLE ligne pour le solde restant.
    if (draftLines.length > 0) {
      const applied = projectedRemaining;
      if (!applied || applied <= 0) {
        setError("Aucun montant restant à encaisser.");
        return;
      }
      if (selectedMethod === "CASH") {
        const received = Number.parseInt(amountReceived, 10) || 0;
        if (received < applied) {
          setError("Le montant reçu doit couvrir le solde restant.");
          return;
        }
        if (!hasActiveCashSession) {
          setError("Ouvrez une session de caisse pour encaisser en espèces.");
          return;
        }
      }
      setDraftLines((lines) => [
        ...lines,
        {
          id: crypto.randomUUID(),
          method: selectedMethod,
          amountApplied: applied,
          amountReceived:
            selectedMethod === "CASH"
              ? Number.parseInt(amountReceived, 10) || applied
              : 0,
          transactionReference: transactionReference.trim(),
        },
      ]);
    } else {
      setDraftLines(resolved.lines);
    }

    setAmountReceived("");
    setTransactionReference("");
    setError(null);
  }

  function handlePayFull() {
    const remaining = projectedRemaining;
    if (remaining <= 0) return;
    setSelectedMethod("CASH");
    setAmountReceived(String(remaining));
    setError(null);
  }

  function handleConfirmCheckout() {
    const resolved = resolvePaymentLines();
    if (resolved.error || resolved.lines.length === 0) {
      setError(resolved.error ?? "Ajoutez au moins une ligne de paiement.");
      return;
    }

    const submittedLines = resolved.lines;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("orderId", summary.orderId);
      formData.set("idempotencyKey", crypto.randomUUID());
      formData.set(
        "payments",
        JSON.stringify(
          submittedLines.map((line) => ({
            method: line.method,
            amountApplied: line.amountApplied,
            amountReceived: line.method === "CASH" ? line.amountReceived : undefined,
            transactionReference: line.transactionReference || undefined,
            provider: line.method,
          })),
        ),
      );

      const result = await recordPaymentsAction({}, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setError(null);
      setDraftLines([]);
      setTransactionReference("");

      if (result.fullyPaid) {
        setSuccessState({
          receiptId: result.receiptId,
          changeGiven: result.changeGiven ?? 0,
          totalPaid: summary.totalAmount,
        });
        return;
      }

      setMessage(result.success ?? "Paiement enregistré.");
      refreshSoon(() => router.refresh());
    });
  }

  if (successState) {
    return (
      <PaymentSuccessScreen
        orderNumber={summary.orderNumber}
        totalPaid={successState.totalPaid}
        changeGiven={successState.changeGiven}
        receiptId={successState.receiptId}
      />
    );
  }

  if (!canCheckout && summary.paymentStatus === "PAID") {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Commande déjà payée</h1>
          <p className="mt-2 text-sm text-slate-600">
            {formatOrderNumber(summary.orderNumber)} · {formatPriceXof(summary.totalAmount)}
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Link
              href="/application/commandes-ouvertes"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Commandes ouvertes
            </Link>
            <Link
              href="/application/caisse"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Nouvelle commande
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {(error || message || methodRequiresSession) && (
        <div className="shrink-0 space-y-2 border-b border-slate-200 bg-white px-4 py-2">
          {error ? <AlertMessage message={error} /> : null}
          {message ? (
            <AlertMessage
              message={message}
              tone="success"
              onDismiss={() => setMessage(null)}
            />
          ) : null}
          {methodRequiresSession ? (
            <AlertMessage message="Ouvrez une session de caisse depuis la page Caisse pour les paiements en espèces." />
          ) : null}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <CheckoutOrderDetail summary={summary} projectedRemaining={projectedRemaining} />
        <CheckoutPaymentCenter
          projectedRemaining={projectedRemaining}
          draftLines={draftLines}
          selectedMethod={selectedMethod}
          amountReceived={amountReceived}
          transactionReference={transactionReference}
          currentChange={currentChange}
          methodRequiresSession={methodRequiresSession}
          onSelectMethod={handleSelectMethod}
          onAmountReceivedChange={setAmountReceived}
          onTransactionReferenceChange={setTransactionReference}
          onPayFull={handlePayFull}
          onAddLine={handleAddLine}
          onRemoveLine={(id) => setDraftLines((lines) => lines.filter((l) => l.id !== id))}
        />
        <CheckoutConfirmPanel
          summary={summary}
          projectedRemaining={Math.max(summary.remainingAmount - previewTotal, 0)}
          draftLines={previewLines}
          draftTotal={previewTotal}
          isPending={isPending}
          canConfirm={canConfirm}
          onConfirm={handleConfirmCheckout}
        />
      </div>
    </div>
  );
}
