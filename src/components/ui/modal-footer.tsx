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
          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 transition active:bg-slate-50 disabled:opacity-60 sm:h-9 sm:rounded-lg sm:hover:bg-slate-50"
        >
          Annuler
        </button>
      )}
      <button
        type="submit"
        disabled={pending || submitDisabled}
        aria-busy={pending}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-[13px] font-semibold text-white shadow-sm transition active:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 sm:h-9 sm:rounded-lg sm:hover:bg-emerald-700"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}
