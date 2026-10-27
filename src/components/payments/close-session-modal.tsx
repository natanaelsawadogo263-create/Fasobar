"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { closeCashSessionAction } from "@/app/(protected)/application/caisse/payment-actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { PriceField, TextField } from "@/components/ui/form-controls";
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
  const [showNote, setShowNote] = useState(false);

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
      // Caisse fermée et session déconnectée : rechargement complet vers l'accueil.
      window.location.assign("/");
    });
  }

  const balance =
    difference === 0
      ? { label: "Caisse juste", tone: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: CheckCircle2 }
      : difference < 0
        ? {
            label: `Manque ${formatPriceXof(Math.abs(difference))}`,
            tone: "border-amber-200 bg-amber-50 text-amber-800",
            Icon: AlertTriangle,
          }
        : {
            label: `Surplus ${formatPriceXof(difference)}`,
            tone: "border-sky-200 bg-sky-50 text-sky-800",
            Icon: AlertTriangle,
          };

  return (
    <ModalShell
      formId="close-session-form"
      compact
      title="Fermer la caisse"
      subtitle="Vous serez déconnecté après la clôture."
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <ModalFooter
          onCancel={onClose}
          submitLabel="Fermer la caisse"
          pendingLabel="Fermeture…"
          isPending={isPending}
        />
      }
    >
      <input type="hidden" name="sessionId" value={session.id} />
      {/* Le bouton « Fermer la caisse » vaut confirmation. */}
      <input type="hidden" name="confirmed" value="on" />

      {error ? (
        <div className="mb-3">
          <AlertMessage message={error} />
        </div>
      ) : null}

      <div className="space-y-4">
        <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-[13px]">
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-slate-500">Fond initial</dt>
            <dd className="pos-tabular font-medium text-slate-800">
              {formatPriceXof(session.openingCashAmount)}
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-slate-500">Espèces encaissées</dt>
            <dd className="pos-tabular font-medium text-slate-800">
              + {formatPriceXof(session.cashCollected)}
            </dd>
          </div>
          <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
            <dt className="font-semibold text-slate-700">Attendu en caisse</dt>
            <dd className="pos-tabular text-[17px] font-bold text-slate-900">
              {formatPriceXof(theoreticalAmount)}
            </dd>
          </div>
        </dl>

        <div>
          <PriceField
            id="countedCashAmount"
            name="countedCashAmount"
            label="Espèces comptées"
            required
            min={0}
            step={1}
            value={countedCash}
            onChange={(event) => setCountedCash(event.target.value)}
            disabled={isPending}
          />
          <p
            className={`mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-semibold ${balance.tone}`}
            aria-live="polite"
          >
            <balance.Icon className="h-4 w-4 shrink-0" />
            {balance.label}
          </p>
        </div>

        {showNote ? (
          <TextField
            id="closingNote"
            name="closingNote"
            label="Note de clôture"
            placeholder="Ex. écart expliqué, monnaie rendue…"
            disabled={isPending}
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="text-[13px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            + Ajouter une note
          </button>
        )}
      </div>
    </ModalShell>
  );
}
