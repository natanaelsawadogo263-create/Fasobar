"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  cancelOrderAction,
  prepareOrderForPaymentAction,
} from "@/app/(protected)/application/caisse/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { OrderPrepBadges } from "@/components/ops/order-prep-badges";
import { ToggleField } from "@/components/ui/form-controls";
import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  formatOrderNumber,
  formatPriceXof,
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
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
            Commande
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            {formatOrderNumber(order.orderNumber)}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {ORDER_TYPE_LABELS[order.orderType]} · Créée le{" "}
            {new Date(order.createdAt).toLocaleString("fr-FR")}
            {order.createdByName ? ` par ${order.createdByName}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${ORDER_STATUS_STYLES[order.status]}`}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </span>
          <OrderPrepBadges
            barStatus={order.barStatus}
            kitchenStatus={order.kitchenStatus}
          />
        </div>
      </div>

      {error ? <AlertMessage message={error} /> : null}
      {message ? <AlertMessage message={message} tone="success" /> : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Articles</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Produit</th>
                  <th className="px-4 py-3 font-medium">Département</th>
                  <th className="px-4 py-3 font-medium">Qté</th>
                  <th className="px-4 py-3 font-medium">P.U.</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Aucun article.
                    </td>
                  </tr>
                ) : (
                  order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 font-medium text-slate-900">
                        {item.productName}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {item.departmentName}
                      </td>
                      <td className="px-4 py-4">{item.quantity}</td>
                      <td className="px-4 py-4">{formatPriceXof(item.unitPrice)}</td>
                      <td className="px-4 py-4 font-medium">
                        {formatPriceXof(item.lineTotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Informations</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Table / Référence</dt>
                <dd className="font-medium text-slate-900">
                  {order.tableReference ?? order.customerReference ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Sous-total</dt>
                <dd className="font-medium text-slate-900">
                  {formatPriceXof(order.subtotal)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Total</dt>
                <dd className="text-xl font-semibold text-emerald-700">
                  {formatPriceXof(order.totalAmount)}
                </dd>
              </div>
            </dl>
          </section>

          {isEditable ? (
            <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Actions</h2>
              <div className="mt-4 grid gap-2">
                <Link
                  href={`/application/caisse?order=${order.id}`}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Modifier la commande
                </Link>
                <button
                  type="button"
                  disabled={isPending || order.items.length === 0}
                  onClick={handlePrepare}
                  className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                >
                  Encaisser la commande
                </button>
                <Link
                  href={`/application/caisse?order=${order.id}`}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Ouvrir en caisse
                </Link>
                {canCancel ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setCancelError(null);
                      setCancelReason("");
                      setCancelConfirmed(false);
                      setShowCancelModal(true);
                    }}
                    className="rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Annuler la commande
                  </button>
                ) : null}
              </div>
            </section>
          ) : canCancel ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Actions</h2>
              <p className="mt-2 text-sm text-slate-500">
                Consultation seule — l&apos;encaissement est réservé aux caissiers.
              </p>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setCancelError(null);
                  setCancelReason("");
                  setCancelConfirmed(false);
                  setShowCancelModal(true);
                }}
                className="mt-4 w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Annuler la commande
              </button>
            </section>
          ) : null}

          {order.status === "CANCELLED" && order.cancellationReason ? (
            <section className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-800">
              <p className="font-semibold">Commande annulée</p>
              <p className="mt-1">{order.cancellationReason}</p>
            </section>
          ) : null}
        </aside>
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
