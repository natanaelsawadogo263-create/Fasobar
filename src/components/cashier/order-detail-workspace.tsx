"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Banknote,
  Pencil,
  Printer,
} from "lucide-react";

import {
  cancelOrderAction,
  prepareOrderForPaymentAction,
} from "@/app/(protected)/application/caisse/actions";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { AlertMessage } from "@/components/auth/alert-message";
import { OrderPrepBadges } from "@/components/ops/order-prep-badges";
import { LiveClock } from "@/components/ui/live-clock";
import { ToggleField } from "@/components/ui/form-controls";
import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  formatOrderNumber,
  formatPriceXof,
  ORDER_PAYMENT_STATUS_LABELS,
  ORDER_PAYMENT_STATUS_STYLES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  ORDER_TYPE_LABELS,
} from "@/lib/orders/constants";
import type { OrderDetail } from "@/lib/orders/types";

type OrderDetailWorkspaceProps = {
  order: OrderDetail;
  canManageOrders: boolean;
  canOperateCashRegister?: boolean;
};

type PaymentStatusKey = keyof typeof ORDER_PAYMENT_STATUS_LABELS;

function resolvePaymentStatus(status: string): PaymentStatusKey {
  if (status in ORDER_PAYMENT_STATUS_LABELS) {
    return status as PaymentStatusKey;
  }
  return "UNPAID";
}

export function OrderDetailWorkspace({
  order,
  canManageOrders,
  canOperateCashRegister = false,
}: OrderDetailWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const isEditable =
    canOperateCashRegister &&
    order.paymentStatus !== "PAID" &&
    order.status !== "CANCELLED";

  const canCancel =
    canManageOrders &&
    order.paymentStatus !== "PAID" &&
    order.status !== "CANCELLED";

  const canPrintAddition =
    order.paymentStatus !== "PAID" && order.status !== "CANCELLED";

  const hasActions = isEditable || canCancel || canPrintAddition;
  const paymentStatus = resolvePaymentStatus(order.paymentStatus);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const reference = order.tableReference ?? order.customerReference ?? "—";
  const backHref = canOperateCashRegister
    ? "/application/caisse"
    : "/application/commandes";
  const backLabel = canOperateCashRegister
    ? "Retour à la caisse"
    : "Retour aux commandes";
  const additionNext = encodeURIComponent(`/application/commandes/${order.id}`);
  const createdLabel = new Date(order.createdAt).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  function openCancelModal() {
    setCancelError(null);
    setCancelReason("");
    setCancelConfirmed(false);
    setShowCancelModal(true);
  }

  function handlePrepare() {
    startTransition(async () => {
      const result = await prepareOrderForPaymentAction(order.id);

      if (result.error) {
        setError(result.error);
        return;
      }

      setError(null);
      router.push(`/application/caisse?order=${order.id}`);
    });
  }

  function handleCancelSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const formData = new FormData(event.currentTarget);
      const result = await cancelOrderAction({}, formData);

      if (result.error) {
        setCancelError(result.error);
        return;
      }

      setShowCancelModal(false);
      setMessage(result.success ?? "Commande annulée.");
      refreshSoon(() => router.refresh());
    });
  }

  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden p-2">
      <div className="flex w-full max-w-[720px] flex-col gap-2">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <Link
            href={backHref}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 text-[12px] font-semibold text-white transition hover:bg-emerald-500"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
            {backLabel}
          </Link>
          {(error || message) && (
            <div className="min-w-0 flex-1">
              {error ? <AlertMessage message={error} /> : null}
              {message ? <AlertMessage message={message} tone="success" /> : null}
            </div>
          )}
          <LiveClock showDate={false} className="shrink-0" />
        </div>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-[20px] font-bold leading-none tracking-tight text-slate-900">
                  {formatOrderNumber(order.orderNumber)}
                </h1>
                <p className="mt-1 truncate text-[11px] text-slate-500">
                  {ORDER_TYPE_LABELS[order.orderType]}
                  <span className="mx-1 text-slate-300">·</span>
                  Table {reference}
                  <span className="mx-1 text-slate-300">·</span>
                  {itemCount} art.
                  <span className="mx-1 text-slate-300">·</span>
                  {createdLabel}
                  {order.createdByName ? ` · ${order.createdByName}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORDER_STATUS_STYLES[order.status]}`}
                >
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORDER_PAYMENT_STATUS_STYLES[paymentStatus]}`}
                >
                  {ORDER_PAYMENT_STATUS_LABELS[paymentStatus]}
                </span>
                <OrderPrepBadges
                  barStatus={order.barStatus}
                  kitchenStatus={order.kitchenStatus}
                />
              </div>
            </div>
          </header>

          <div className="grid sm:grid-cols-[minmax(0,1fr)_200px]">
            <section className="min-w-0 border-b border-slate-100 sm:border-b-0 sm:border-r">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-1.5">
                <h2 className="text-[12px] font-semibold text-slate-900">Articles</h2>
                <p className="text-[10px] text-slate-400">
                  {order.items.length} ligne{order.items.length > 1 ? "s" : ""}
                </p>
              </div>

              <div className="max-h-[220px] overflow-y-auto">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                      <th className="px-3.5 py-1.5 font-semibold">Produit</th>
                      <th className="hidden px-2 py-1.5 font-semibold sm:table-cell">
                        Dépt.
                      </th>
                      <th className="px-2 py-1.5 text-right font-semibold">Qté</th>
                      <th className="px-2 py-1.5 text-right font-semibold">P.U.</th>
                      <th className="px-3.5 py-1.5 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3.5 py-5 text-center text-slate-500">
                          Aucun article.
                        </td>
                      </tr>
                    ) : (
                      order.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-slate-50 last:border-b-0"
                        >
                          <td className="px-3.5 py-1.5">
                            <p className="font-semibold leading-tight text-slate-900">
                              {item.productName}
                            </p>
                            {item.notes?.trim() ? (
                              <p className="mt-0.5 text-[10px] text-amber-800">
                                {item.notes}
                              </p>
                            ) : null}
                          </td>
                          <td className="hidden px-2 py-1.5 text-slate-500 sm:table-cell">
                            {item.departmentName}
                          </td>
                          <td className="pos-tabular px-2 py-1.5 text-right font-medium text-slate-800">
                            {item.quantity}
                          </td>
                          <td className="pos-tabular px-2 py-1.5 text-right text-slate-500">
                            {formatPriceXof(item.unitPrice)}
                          </td>
                          <td className="pos-tabular px-3.5 py-1.5 text-right font-semibold text-slate-900">
                            {formatPriceXof(item.lineTotal)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-3.5 py-1.5 text-[12px]">
                <span className="text-slate-500">
                  Sous-total{" "}
                  <span className="pos-tabular font-medium text-slate-800">
                    {formatPriceXof(order.subtotal)}
                  </span>
                </span>
                <span className="pos-tabular font-bold text-emerald-700">
                  {formatPriceXof(order.totalAmount)}
                </span>
              </div>
            </section>

            <aside className="flex flex-col gap-1.5 bg-slate-50/60 px-3 py-2.5">
              <div className="rounded-lg bg-slate-950 px-3 py-2 text-white">
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-400">
                  Total à payer
                </p>
                <p className="pos-tabular mt-1 text-[18px] font-bold leading-none text-emerald-400">
                  {formatPriceXof(order.totalAmount)}
                </p>
              </div>

              {hasActions ? (
                <div className="grid gap-1">
                  {isEditable ? (
                    <button
                      type="button"
                      disabled={isPending || order.items.length === 0}
                      onClick={handlePrepare}
                      className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-2.5 text-[12px] font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      <Banknote className="h-3.5 w-3.5" strokeWidth={2} />
                      {isPending ? "…" : "Encaisser"}
                    </button>
                  ) : null}

                  {canPrintAddition ? (
                    <Link
                      href={`/application/commandes/${order.id}/addition?print=1&next=${additionNext}`}
                      className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 text-[12px] font-semibold text-amber-900 transition hover:bg-amber-100"
                    >
                      <Printer className="h-3.5 w-3.5" strokeWidth={2} />
                      Addition
                    </Link>
                  ) : null}

                  {isEditable ? (
                    <Link
                      href={`/application/caisse?order=${order.id}`}
                      className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={2} />
                      Modifier
                    </Link>
                  ) : null}

                  {canCancel ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={openCancelModal}
                      className="inline-flex h-8 w-full items-center justify-center rounded-md border border-red-200 bg-white px-2.5 text-[12px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Annuler
                    </button>
                  ) : null}
                </div>
              ) : null}

              {order.status === "CANCELLED" ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-800">
                  <p className="font-semibold">Annulée</p>
                  {order.cancellationReason ? (
                    <p className="mt-0.5 line-clamp-2">{order.cancellationReason}</p>
                  ) : null}
                </div>
              ) : null}
            </aside>
          </div>
        </article>
      </div>

      {showCancelModal ? (
        <ModalShell
          formId="cancel-order-form"
          title="Annuler la commande"
          subtitle={`${formatOrderNumber(order.orderNumber)} — cette action est définitive.`}
          onClose={() => setShowCancelModal(false)}
          onSubmit={handleCancelSubmit}
          footer={
            <ModalFooter
              onCancel={() => setShowCancelModal(false)}
              submitLabel="Confirmer l'annulation"
              pendingLabel="Annulation..."
            />
          }
        >
          <input type="hidden" name="orderId" value={order.id} />
          {cancelError ? (
            <div className="mb-4">
              <AlertMessage message={cancelError} />
            </div>
          ) : null}
          <label htmlFor="reason" className="block text-sm font-medium text-slate-700">
            Motif d&apos;annulation
          </label>
          <textarea
            id="reason"
            name="reason"
            required
            rows={3}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            placeholder="Ex. Erreur de saisie, client parti..."
          />
          <div className="mt-4">
            <ToggleField
              id="confirmed"
              name="confirmed"
              label="Je confirme l'annulation"
              checked={cancelConfirmed}
              onChange={setCancelConfirmed}
            />
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
