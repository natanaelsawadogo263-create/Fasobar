"use client";

import { useState, useTransition, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";

import { createDeliveryOrderAction } from "@/app/(protected)/application/livraisons/actions";
import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import { formatDeliveryQuantity } from "@/lib/delivery/constants";
import type { CartLine } from "@/lib/orders/types";
import { formatPriceXof } from "@/lib/products/constants";

type PosDeliveryOrderModalProps = {
  cart: CartLine[];
  total: number;
  /** Nom saisi dans le champ client de la caisse (pré-rempli). */
  initialCustomerName?: string;
  onClose: () => void;
  /** Commande envoyée : `message` est la confirmation à afficher. */
  onSent: (message: string) => void;
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

/** Indicatif du Burkina Faso, affiché devant le numéro du client. */
const PHONE_PREFIX = "+226";

/**
 * Garde les 8 chiffres du numéro, groupés par deux (« 70 12 34 56 »). Retire
 * l'indicatif s'il est collé avec le numéro (+226, 00226 ou 226 suivi de 8 chiffres).
 */
function formatLocalPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (/^(00)?226\d{8}$/.test(digits)) digits = digits.slice(-8);
  return digits
    .slice(0, 8)
    .replace(/(\d{2})(?=\d)/g, "$1 ");
}

/** Lignes vendues en lot (carton, pack…) : prix différent de l'unité, non pris en charge en livraison. */
function packedLines(cart: CartLine[]): CartLine[] {
  return cart.filter((line) => line.saleUnitId && (line.stockFactor ?? 1) !== 1);
}

/**
 * Caisse e-commerce : « Commander » envoie le panier aux livreurs (commande à
 * livrer). L'encaissement se fait plus tard, quand le livreur rapporte l'argent.
 */
export function PosDeliveryOrderModal({
  cart,
  total,
  initialCustomerName = "",
  onClose,
  onSent,
}: PosDeliveryOrderModalProps) {
  const [isPending, startTransition] = useTransition();
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const packed = packedLines(cart);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || packed.length > 0 || cart.length === 0) return;
    setError(null);

    startTransition(async () => {
      let result: { success?: string; error?: string };
      try {
        result = await createDeliveryOrderAction({
          items: cart.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          customerName,
          customerPhone: customerPhone.trim() ? `${PHONE_PREFIX} ${customerPhone.trim()}` : "",
          deliveryAddress,
          note,
        });
      } catch {
        result = { error: "Connexion au serveur interrompue. Rechargez la page puis réessayez." };
      }

      if (result.error) {
        setError(result.error);
        return;
      }
      onSent(result.success ?? "Commande envoyée aux livreurs.");
    });
  }

  return (
    <ModalShell
      formId="pos-delivery-order"
      compact
      title="Envoyer la commande aux livreurs"
      subtitle="Tous les livreurs connectés la reçoivent. Vous l’encaisserez quand le livreur rapportera l’argent."
      onClose={() => {
        if (!isPending) onClose();
      }}
      onSubmit={submit}
      footer={
        <ModalFooter
          onCancel={onClose}
          submitLabel={`Commander · ${formatPriceXof(total)}`}
          pendingLabel="Envoi…"
          isPending={isPending}
          submitDisabled={packed.length > 0 || cart.length === 0}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/60 text-[13px]">
          {cart.map((line) => (
            <li
              key={`${line.productId}:${line.saleUnitId ?? ""}`}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="min-w-0 truncate text-slate-800">
                <span className="font-semibold">{formatDeliveryQuantity(line.quantity)} ×</span>{" "}
                {line.name}
              </span>
              <span className="shrink-0 tabular-nums text-slate-600">
                {formatPriceXof(Math.round(line.unitPrice * line.quantity))}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 px-3 py-2.5 font-bold">
            <span className="text-slate-700">Total</span>
            <span className="tabular-nums text-emerald-700">{formatPriceXof(total)}</span>
          </li>
        </ul>

        {packed.length > 0 ? (
          <p className="flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-[12px] text-orange-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Les livraisons se font à l’unité. Remplacez dans le panier les lots (carton, pack…) :{" "}
            {packed.map((line) => line.name).join(", ")}.
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Nom du client"
            maxLength={120}
            className={inputClass}
          />
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-slate-500">
              {PHONE_PREFIX}
            </span>
            <input
              value={customerPhone}
              onChange={(event) => setCustomerPhone(formatLocalPhone(event.target.value))}
              placeholder="00 00 00 00"
              aria-label="Téléphone du client"
              title="Téléphone du client"
              inputMode="tel"
              maxLength={20}
              className={`${inputClass} pl-14`}
            />
          </div>
          <input
            value={deliveryAddress}
            onChange={(event) => setDeliveryAddress(event.target.value)}
            placeholder="Adresse de livraison"
            maxLength={300}
            className={`${inputClass} sm:col-span-2`}
          />
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Note pour le livreur (optionnel)"
            maxLength={500}
            className={`${inputClass} sm:col-span-2`}
          />
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p>
        ) : null}
      </div>
    </ModalShell>
  );
}
