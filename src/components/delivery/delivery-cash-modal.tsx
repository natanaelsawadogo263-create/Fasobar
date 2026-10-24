"use client";

import { useState, useTransition, type FormEvent } from "react";

import { cashDeliveryOrderAction } from "@/app/(protected)/application/livraisons/actions";
import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import { useToast } from "@/components/ui/toast";
import { formatDeliveryOrderNumber } from "@/lib/delivery/constants";
import type { DeliveryOrder } from "@/lib/delivery/types";
import {
  calculateChange,
  MOBILE_MONEY_METHODS,
  PAYMENT_METHOD_ICONS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/payments/constants";
import type { PaymentMethod } from "@/lib/payments/schemas";
import { formatPriceXof } from "@/lib/products/constants";

const METHODS: PaymentMethod[] = ["CASH", "ORANGE_MONEY", "MOOV_MONEY", "TELECEL_MONEY", "CARD"];

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

type DeliveryCashModalProps = {
  order: DeliveryOrder;
  onClose: () => void;
};

/** Encaissement d'une livraison livrée : le livreur a remis l'argent à la caisse. */
export function DeliveryCashModal({ order, onClose }: DeliveryCashModalProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amountReceived, setAmountReceived] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const received = Number(amountReceived);
  const hasReceived = method === "CASH" && amountReceived !== "" && Number.isFinite(received);
  const insufficient = hasReceived && received < order.totalAmount;
  const change = hasReceived ? calculateChange(received, order.totalAmount) : 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || insufficient) return;
    setError(null);

    startTransition(async () => {
      let result: { success?: string; error?: string };
      try {
        result = await cashDeliveryOrderAction({
          orderId: order.id,
          method,
          amountReceived: hasReceived ? Math.round(received) : undefined,
          transactionReference: method === "CASH" ? undefined : reference,
        });
      } catch {
        result = { error: "Connexion au serveur interrompue. Rechargez la page puis réessayez." };
      }

      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(result.success ?? "Commande encaissée.");
      onClose();
    });
  }

  return (
    <ModalShell
      formId="delivery-cash"
      compact
      title={`Encaisser ${formatDeliveryOrderNumber(order.orderNumber)}`}
      subtitle={`Livrée par ${order.courierName ?? "le livreur"}${
        order.customerName ? ` à ${order.customerName}` : ""
      }. La vente sera enregistrée dans votre session de caisse.`}
      onClose={() => {
        if (!isPending) onClose();
      }}
      onSubmit={submit}
      footer={
        <ModalFooter
          onCancel={onClose}
          submitLabel={`Encaisser ${formatPriceXof(order.totalAmount)}`}
          pendingLabel="Encaissement…"
          isPending={isPending}
          submitDisabled={insufficient}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
          <span className="text-[13px] font-semibold text-emerald-900">Montant à encaisser</span>
          <span className="text-[20px] font-bold tabular-nums text-emerald-800">
            {formatPriceXof(order.totalAmount)}
          </span>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[12px] font-semibold text-slate-700">Mode de paiement</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {METHODS.map((item) => {
              const active = method === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMethod(item)}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition ${
                    active
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span aria-hidden>{PAYMENT_METHOD_ICONS[item]}</span>
                  {PAYMENT_METHOD_LABELS[item]}
                </button>
              );
            })}
          </div>
        </fieldset>

        {method === "CASH" ? (
          <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-slate-700">
            Montant reçu (optionnel, pour calculer la monnaie)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={amountReceived}
              onChange={(event) => setAmountReceived(event.target.value)}
              placeholder={String(order.totalAmount)}
              className={`${inputClass} input-no-spinner`}
            />
            {insufficient ? (
              <span className="text-[12px] font-medium text-red-600">
                Montant inférieur au total de la commande.
              </span>
            ) : hasReceived ? (
              <span className="text-[12px] font-medium text-slate-600">
                Monnaie à rendre : <strong>{formatPriceXof(change)}</strong>
              </span>
            ) : null}
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-slate-700">
            {MOBILE_MONEY_METHODS.has(method) ? "Référence de la transaction (optionnel)" : "Référence (optionnel)"}
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Ex. : CI230512.1234.A56789"
              maxLength={100}
              className={inputClass}
            />
          </label>
        )}

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p>
        ) : null}
      </div>
    </ModalShell>
  );
}
