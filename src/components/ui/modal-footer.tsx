"use client";

import { useFormStatus } from "react-dom";

type ModalFooterProps = {
  onCancel: () => void;
  submitLabel: string;
  pendingLabel?: string;
  hideCancel?: boolean;
  isPending?: boolean;
  submitDisabled?: boolean;
};

export function ModalFooter({
  onCancel,
  submitLabel,
  pendingLabel = "Enregistrement...",
  hideCancel = false,
  isPending,
  submitDisabled = false,
}: ModalFooterProps) {
  const { pending: formPending } = useFormStatus();
  const pending = isPending ?? formPending;

  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
      {hideCancel ? null : (
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          Annuler
        </button>
      )}
      <button
        type="submit"
        disabled={pending || submitDisabled}
        aria-busy={pending}
        className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}
