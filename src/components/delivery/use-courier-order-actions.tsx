"use client";

import { useState, useTransition, type FormEvent } from "react";

import {
  acceptDeliveryOrderAction,
  completeDeliveryOrderAction,
  releaseDeliveryOrderAction,
} from "@/app/(protected)/application/livreur/actions";
import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import { useToast } from "@/components/ui/toast";
import { formatDeliveryOrderNumber } from "@/lib/delivery/constants";
import type { DeliveryOrder } from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";

type ActionResult = { success?: string; error?: string };

/** Montants de course les plus courants, en un toucher. */
const QUICK_FEES = [0, 500, 1000, 1500, 2000];

type PendingConfirm = {
  kind: "complete" | "release";
  order: DeliveryOrder;
};

/**
 * Actions du livreur sur une commande (accepter, se désister, finaliser),
 * avec confirmation en fenêtre pour les deux dernières.
 */
export function useCourierOrderActions() {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [deliveryFee, setDeliveryFee] = useState("");

  function run(
    orderId: string,
    action: (id: string) => Promise<ActionResult>,
    onSuccess?: () => void,
  ) {
    setBusyOrderId(orderId);
    startTransition(async () => {
      let result: ActionResult;
      try {
        result = await action(orderId);
      } catch {
        result = { error: "Connexion au serveur interrompue. Rechargez la page puis réessayez." };
      }
      setBusyOrderId(null);
      setConfirm(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "C’est fait.");
      onSuccess?.();
    });
  }

  function accept(order: DeliveryOrder, onSuccess?: () => void) {
    run(order.id, acceptDeliveryOrderAction, onSuccess);
  }

  function submitConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirm) return;
    if (confirm.kind === "complete") {
      const fee = Number(deliveryFee);
      if (deliveryFee.trim() === "" || !Number.isInteger(fee) || fee < 0) {
        toast.error("Indiquez combien a coûté la course (0 si gratuite).");
        return;
      }
      if (fee > confirm.order.totalAmount) {
        toast.error("Les frais ne peuvent pas dépasser le montant de la commande.");
        return;
      }
      run(confirm.order.id, (id) => completeDeliveryOrderAction(id, fee));
      return;
    }
    run(confirm.order.id, releaseDeliveryOrderAction);
  }

  const feeValue = deliveryFee.trim() === "" ? 0 : Number(deliveryFee);
  const feeTooHigh = confirm?.kind === "complete" && feeValue > confirm.order.totalAmount;
  const toHandOver = confirm ? Math.max(confirm.order.totalAmount - feeValue, 0) : 0;

  const confirmDialog = confirm ? (
    <ModalShell
      formId="courier-confirm"
      compact
      title={
        confirm.kind === "complete"
          ? `Livraison ${formatDeliveryOrderNumber(confirm.order.orderNumber)}`
          : `Se désister de ${formatDeliveryOrderNumber(confirm.order.orderNumber)}`
      }
      subtitle={
        confirm.kind === "complete"
          ? "Commande remise et paiement reçu."
          : "La commande redeviendra disponible pour les autres livreurs."
      }
      onClose={() => {
        if (!isPending) setConfirm(null);
      }}
      onSubmit={submitConfirm}
      footer={
        <ModalFooter
          onCancel={() => setConfirm(null)}
          submitLabel={confirm.kind === "complete" ? "Confirmer la livraison" : "Oui, me désister"}
          pendingLabel="Enregistrement…"
          isPending={isPending}
        />
      }
    >
      {confirm.kind === "complete" ? (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between text-[13px] text-slate-500">
            <span>Payé par le client</span>
            <span className="font-semibold tabular-nums text-slate-800">
              {formatPriceXof(confirm.order.totalAmount)}
            </span>
          </div>

          <div>
            <label htmlFor="deliveryFee" className="text-[13px] font-semibold text-slate-800">
              Coût de la course
            </label>
            <div className="mt-1.5 flex h-12 items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
              <input
                id="deliveryFee"
                name="deliveryFee"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="0"
                required
                value={deliveryFee}
                onChange={(event) => setDeliveryFee(event.target.value.replace(/\D/g, ""))}
                disabled={isPending}
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
              />
              <span className="text-[13px] text-slate-400">F CFA</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_FEES.map((fee) => {
                const active = deliveryFee === String(fee);
                return (
                  <button
                    key={fee}
                    type="button"
                    disabled={isPending}
                    onClick={() => setDeliveryFee(String(fee))}
                    className={`h-8 rounded-full border px-3 text-[12px] font-semibold tabular-nums transition ${
                      active
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 active:bg-slate-50 sm:hover:border-emerald-400"
                    }`}
                  >
                    {fee === 0 ? "Gratuit" : formatPriceXof(fee)}
                  </button>
                );
              })}
            </div>
            {feeTooHigh ? (
              <p className="mt-2 text-[12px] font-medium text-red-600">
                Les frais ne peuvent pas dépasser le montant de la commande.
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-slate-500">
                Vous gardez ce montant ; il est noté dans les dépenses de la boutique.
              </p>
            )}
          </div>

          <div className="flex items-baseline justify-between rounded-xl bg-emerald-50 px-3 py-2.5">
            <span className="text-[13px] font-semibold text-emerald-900">À remettre à la caisse</span>
            <span className="text-[18px] font-bold tabular-nums text-emerald-800">
              {formatPriceXof(toHandOver)}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-slate-600">
          Les articles réservés pour cette commande seront libérés dans votre stock.
        </p>
      )}
    </ModalShell>
  ) : null;

  return {
    isPending,
    busyOrderId,
    accept,
    requestComplete: (order: DeliveryOrder) => {
      setDeliveryFee("");
      setConfirm({ kind: "complete", order });
    },
    requestRelease: (order: DeliveryOrder) => setConfirm({ kind: "release", order }),
    confirmDialog,
  };
}

export const courierButtons = {
  primary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-[13px] font-semibold text-white shadow-sm transition active:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:hover:bg-emerald-700",
  secondary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-600 transition active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:hover:bg-slate-50",
};
