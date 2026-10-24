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
    run(
      confirm.order.id,
      confirm.kind === "complete" ? completeDeliveryOrderAction : releaseDeliveryOrderAction,
    );
  }

  const confirmDialog = confirm ? (
    <ModalShell
      formId="courier-confirm"
      compact
      title={
        confirm.kind === "complete"
          ? `Confirmer la livraison ${formatDeliveryOrderNumber(confirm.order.orderNumber)}`
          : `Se désister de ${formatDeliveryOrderNumber(confirm.order.orderNumber)}`
      }
      subtitle={
        confirm.kind === "complete"
          ? "La commande a été remise au client et le montant encaissé."
          : "La commande redeviendra disponible pour les autres livreurs."
      }
      onClose={() => {
        if (!isPending) setConfirm(null);
      }}
      onSubmit={submitConfirm}
      footer={
        <ModalFooter
          onCancel={() => setConfirm(null)}
          submitLabel={confirm.kind === "complete" ? "Oui, c’est livré" : "Oui, me désister"}
          pendingLabel="Enregistrement…"
          isPending={isPending}
        />
      }
    >
      {confirm.kind === "complete" ? (
        <div className="grid gap-2 text-[13px] text-slate-700">
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5">
            <span className="font-semibold text-emerald-900">Montant encaissé</span>
            <span className="text-[16px] font-bold tabular-nums text-emerald-800">
              {formatPriceXof(confirm.order.totalAmount)}
            </span>
          </div>
          <p className="text-[12px] text-slate-500">
            Les articles livrés seront retirés de votre stock. Cette action est définitive.
          </p>
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
    requestComplete: (order: DeliveryOrder) => setConfirm({ kind: "complete", order }),
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
