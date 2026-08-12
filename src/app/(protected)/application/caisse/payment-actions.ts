"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";

import { mapGenericError } from "@/lib/auth/errors";
import {
  requireCashRegisterOperatorMutationContext,
  requireOrderManagementMutationContext,
} from "@/lib/auth/workspace-context";
import { revalidateCashSessionOps, revalidatePaymentOps } from "@/lib/ops/revalidate";
import {
  closeCashSessionSchema,
  openCashSessionSchema,
  recordPaymentsSchema,
  voidPaymentSchema,
} from "@/lib/payments/schemas";
import {
  getActiveCashSession,
  getOrderPaymentSummary,
  getReceiptByOrderId,
} from "@/lib/payments/queries";
import type { PaymentActionState } from "@/lib/payments/types";
import { createClient } from "@/lib/supabase/server";

function revalidatePaymentPages(orderId?: string, receiptId?: string) {
  revalidatePaymentOps(orderId, receiptId);
}

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function mapRpcError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
} | null): string {
  const message = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ");

  if (message.includes("session de caisse")) {
    return message.includes("déjà ouverte")
      ? "Une session de caisse est déjà ouverte."
      : "Aucune session de caisse ouverte pour les espèces.";
  }

  if (message.includes("solde restant") || message.includes("dépasse le solde")) {
    return "Le montant dépasse le solde restant à payer.";
  }

  if (message.includes("annulée")) {
    return "Impossible d'encaisser une commande annulée.";
  }

  if (message.includes("totalement payée") || message.includes("déjà totalement payée")) {
    return "Cette commande est déjà totalement payée.";
  }

  if (message.includes("Permission insuffisante")) {
    return "Permission insuffisante pour cette opération.";
  }

  if (message.includes("Could not find the function") || message.includes("schema cache")) {
    return "Fonction de paiement indisponible. Appliquez les migrations SQL manquantes.";
  }

  if (message.includes("column") && message.includes("phone")) {
    return "Erreur configuration base (téléphone établissement). Réappliquez la migration de correction paiement.";
  }

  if (message.includes("Authentification requise")) {
    return "Session expirée. Veuillez vous reconnecter.";
  }

  if (message.includes("montant appliqué") || message.includes("strictement positif")) {
    return "Le montant à encaisser doit être strictement positif.";
  }

  // Afficher le message métier PostgreSQL s'il est lisible
  const cleaned = message
    .replace(/^.*ERROR:\s*/i, "")
    .replace(/\s+CONTEXT:[\s\S]*$/i, "")
    .trim();

  if (cleaned && cleaned.length > 0 && cleaned.length < 220 && !cleaned.includes("json")) {
    return cleaned;
  }

  console.error("[recordPaymentsAction]", error);
  return mapGenericError(error);
}

export async function openCashSessionAction(
  _prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const workspace = await requireCashRegisterOperatorMutationContext();

  const parsed = openCashSessionSchema.safeParse({
    openingCashAmount: formData.get("openingCashAmount"),
    openingNote: formData.get("openingNote") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    try {
      const { openLocalCashSession } = await import(
        "@/lib/local-domain/cash-sessions"
      );
      const { scheduleOutboxPush } = await import("@/lib/sync/push");
      const result = openLocalCashSession(workspace, {
        openingCashAmount: parsed.data.openingCashAmount,
        openingNote: parsed.data.openingNote ?? null,
      });
      scheduleOutboxPush();
      revalidateCashSessionOps();
      revalidatePaymentPages();
      return { success: "Caisse ouverte.", sessionId: result.sessionId };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'ouvrir la caisse.",
      };
    }
  }

  const supabase = await createClient();

  const { data: sessionId, error } = await supabase.rpc("open_cash_register_session", {
    p_opening_cash_amount: parsed.data.openingCashAmount,
    p_opening_note: parsed.data.openingNote ?? null,
  });

  if (error || !sessionId) {
    return { error: mapRpcError(error) };
  }

  revalidateCashSessionOps();
  revalidatePaymentPages();
  return { success: "Caisse ouverte.", sessionId: sessionId as string };
}

export async function closeCashSessionAction(
  _prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const workspace = await requireCashRegisterOperatorMutationContext();

  const parsed = closeCashSessionSchema.safeParse({
    sessionId: formData.get("sessionId"),
    countedCashAmount: formData.get("countedCashAmount"),
    closingNote: formData.get("closingNote") || undefined,
    confirmed: parseCheckbox(formData.get("confirmed")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (!parsed.data.confirmed) {
    return { error: "Veuillez confirmer la fermeture de caisse." };
  }

  const ownSession = await getActiveCashSession(workspace);
  if (!ownSession || ownSession.id !== parsed.data.sessionId) {
    return { error: "Vous ne pouvez fermer que votre propre session de caisse." };
  }

  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    try {
      const { closeLocalCashSession } = await import(
        "@/lib/local-domain/cash-sessions"
      );
      const { scheduleOutboxPush } = await import("@/lib/sync/push");
      closeLocalCashSession(workspace, {
        sessionId: parsed.data.sessionId,
        countedCashAmount: parsed.data.countedCashAmount,
        closingNote: parsed.data.closingNote ?? null,
      });
      scheduleOutboxPush();
      revalidateCashSessionOps();
      revalidatePaymentPages();
      const supabaseLocal = await createClient();
      await supabaseLocal.auth.signOut();
      redirect("/");
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de fermer la caisse.",
      };
    }
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("close_cash_register_session", {
    p_session_id: parsed.data.sessionId,
    p_counted_cash_amount: parsed.data.countedCashAmount,
    p_closing_note: parsed.data.closingNote ?? null,
  });

  if (error) {
    return { error: mapRpcError(error) };
  }

  revalidateCashSessionOps();
  revalidatePaymentPages();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Encaissement express en espèces : paie le solde restant et émet le reçu.
 */
export async function quickCashCheckoutAction(
  orderId: string,
  amountReceived?: number,
): Promise<PaymentActionState> {
  const workspace = await requireCashRegisterOperatorMutationContext();

  const summary = await getOrderPaymentSummary(workspace, orderId);

  if (!summary) {
    return { error: "Commande introuvable." };
  }

  if (summary.status === "CANCELLED") {
    return { error: "Impossible d'encaisser une commande annulée." };
  }

  if (summary.paymentStatus === "PAID" || summary.remainingAmount <= 0) {
    const existing = await getReceiptByOrderId(workspace, orderId);
    return {
      success: "Cette commande est déjà payée.",
      orderId,
      receiptId: existing?.id,
      fullyPaid: true,
      changeGiven: 0,
    };
  }

  const session = await getActiveCashSession(workspace);
  if (!session) {
    return {
      error: "Ouvrez une session de caisse pour encaisser en espèces.",
    };
  }

  const remaining = summary.remainingAmount;
  const received =
    amountReceived !== undefined && Number.isFinite(amountReceived)
      ? Math.trunc(amountReceived)
      : remaining;

  if (received < remaining) {
    return {
      error: "Le montant reçu doit couvrir le total à payer.",
    };
  }

  const formData = new FormData();
  formData.set("orderId", orderId);
  formData.set("idempotencyKey", randomUUID());
  formData.set(
    "payments",
    JSON.stringify([
      {
        method: "CASH",
        amountApplied: remaining,
        amountReceived: received,
        provider: "CASH",
      },
    ]),
  );

  return recordPaymentsAction({}, formData);
}

export async function recordPaymentsAction(
  _prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const workspace = await requireCashRegisterOperatorMutationContext();

  const paymentsRaw = formData.get("payments");
  let payments: unknown[] = [];

  try {
    payments = JSON.parse(String(paymentsRaw ?? "[]")) as unknown[];
  } catch {
    return { error: "Format de paiement invalide." };
  }

  const idempotencyKey =
    (formData.get("idempotencyKey") as string | null) ?? randomUUID();

  const parsed = recordPaymentsSchema.safeParse({
    orderId: formData.get("orderId"),
    payments,
    idempotencyKey,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Paiement invalide." };
  }

  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    try {
      const { recordLocalPayments } = await import(
        "@/lib/local-domain/checkout-local"
      );
      const { scheduleOutboxPush } = await import("@/lib/sync/push");
      const result = recordLocalPayments(workspace, {
        orderId: parsed.data.orderId,
        payments: parsed.data.payments.map((payment) => ({
          method: payment.method,
          amountApplied: payment.amountApplied,
          amountReceived: payment.amountReceived ?? null,
          provider: payment.provider ?? payment.method,
          notes: payment.notes ?? null,
          transactionReference: payment.transactionReference ?? null,
        })),
        idempotencyKey: parsed.data.idempotencyKey ?? idempotencyKey,
      });
      scheduleOutboxPush();
      revalidatePaymentPages(parsed.data.orderId, result.receiptId);
      return result;
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Encaissement impossible.",
      };
    }
  }

  const supabase = await createClient();

  const rpcPayments = parsed.data.payments.map((payment) => ({
    method: payment.method,
    amount_applied: payment.amountApplied,
    amount_received: payment.amountReceived ?? null,
    transaction_reference: payment.transactionReference ?? null,
    provider: payment.provider ?? payment.method,
    notes: payment.notes ?? null,
  }));

  const { data, error } = await supabase.rpc("record_order_payments", {
    p_order_id: parsed.data.orderId,
    p_payments: rpcPayments,
    p_idempotency_key: parsed.data.idempotencyKey ?? idempotencyKey,
  });

  if (error) {
    console.error("[recordPaymentsAction] RPC error", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      payments: rpcPayments,
    });
    return { error: mapRpcError(error) };
  }

  const result = data as {
    receipt_id?: string;
    fully_paid?: boolean;
    change_given?: number;
    remaining?: number;
  };

  revalidatePaymentPages(parsed.data.orderId, result.receipt_id);

  return {
    success: result.fully_paid
      ? "Commande entièrement encaissée."
      : "Paiement enregistré.",
    orderId: parsed.data.orderId,
    receiptId: result.receipt_id,
    fullyPaid: result.fully_paid,
    changeGiven: result.change_given,
  };
}

export async function voidPaymentAction(
  _prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  await requireOrderManagementMutationContext();

  const parsed = voidPaymentSchema.safeParse({
    paymentId: formData.get("paymentId"),
    reason: formData.get("reason"),
    confirmed: parseCheckbox(formData.get("confirmed")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (!parsed.data.confirmed) {
    return { error: "Veuillez confirmer l'annulation du paiement." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("void_payment", {
    p_payment_id: parsed.data.paymentId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return { error: mapRpcError(error) };
  }

  revalidatePaymentPages();
  return { success: "Paiement annulé." };
}
