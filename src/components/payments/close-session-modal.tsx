"use client";

import { useState, useTransition } from "react";

import { closeCashSessionAction } from "@/app/(protected)/application/caisse/payment-actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { FormSection, PriceField, TextField, ToggleField } from "@/components/ui/form-controls";
import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import { formatPriceXof } from "@/lib/payments/constants";
import type { CashSessionDetail } from "@/lib/payments/types";

type CloseSessionModalProps = {
  session: CashSessionDetail;
  onClose: () => void;
  onClosed?: () => void;
};

export function CloseSessionModal({
  session,
  onClose,
  onClosed,
}: CloseSessionModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [countedCash, setCountedCash] = useState(
    String(session.openingCashAmount + session.cashCollected),
  );
  const [confirmed, setConfirmed] = useState(false);

  const theoreticalAmount = session.openingCashAmount + session.cashCollected;
  const countedValue = Number.parseInt(countedCash, 10) || 0;
  const difference = countedValue - theoreticalAmount;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await closeCashSessionAction({}, formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      setError(null);
      onClosed?.();
    });
  }

  return (
    <ModalShell
      formId="close-session-form"
      title="Fermer la caisse"
      subtitle="Comptez les espèces. Après clôture, vous serez déconnecté automatiquement."
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <ModalFooter
          onCancel={onClose}
          submitLabel={
            isPending ? "Fermeture et déconnexion…" : "Fermer et me déconnecter"
          }
          pendingLabel="Fermeture et déconnexion…"
        />
      }
    >
      <input type="hidden" name="sessionId" value={session.id} />

      {error ? (
        <div className="mb-4">
          <AlertMessage message={error} />
        </div>
      ) : null}

      <FormSection title="Récapitulatif de caisse">
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Fond initial</span>
            <span className="pos-tabular font-semibold text-slate-900">
              {formatPriceXof(session.openingCashAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Espèces encaissées</span>
            <span className="pos-tabular font-semibold text-emerald-700">
              {formatPriceXof(session.cashCollected)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-300 pt-3">
            <span className="font-medium text-slate-700">Montant théorique</span>
            <span className="pos-tabular text-2xl font-bold text-slate-900">
              {formatPriceXof(theoreticalAmount)}
            </span>
          </div>
        </div>
      </FormSection>

      <div className="mt-5 space-y-4">
        <PriceField
          id="countedCashAmount"
          name="countedCashAmount"
          label="Montant compté"
          required
          min={0}
          step={1}
          value={countedCash}
          onChange={(event) => setCountedCash(event.target.value)}
          disabled={isPending}
        />

        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            difference === 0
              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
              : difference > 0
                ? "border-sky-100 bg-sky-50 text-sky-800"
                : "border-amber-100 bg-amber-50 text-amber-800"
          }`}
        >
          <p className="font-medium">Écart calculé</p>
          <p className="mt-1 text-lg font-semibold">
            {difference === 0
              ? "Aucun écart"
              : `${difference > 0 ? "+" : ""}${formatPriceXof(Math.abs(difference))}`}
          </p>
        </div>

        <TextField
          id="closingNote"
          name="closingNote"
          label="Note de clôture (facultatif)"
          placeholder="Ex. surplus de monnaie, écart expliqué..."
          disabled={isPending}
        />

        <ToggleField
          id="confirmed"
          name="confirmed"
          label="Je confirme la fermeture définitive de la caisse"
          checked={confirmed}
          onChange={setConfirmed}
        />
      </div>
    </ModalShell>
  );
}
