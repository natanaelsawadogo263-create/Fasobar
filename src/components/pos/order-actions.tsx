"use client";

type OrderActionsProps = {
  isPending: boolean;
  isEmpty: boolean;
  onHold: () => void;
  onCheckout: () => void;
  onClear: () => void;
};

export function OrderActions({
  isPending,
  isEmpty,
  onHold,
  onCheckout,
  onClear,
}: OrderActionsProps) {
  const actionsDisabled = isPending || isEmpty;

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        disabled={actionsDisabled}
        onClick={onCheckout}
        title="Encaisser maintenant (F8)"
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-md transition hover:bg-emerald-500 active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:hover:bg-slate-200"
      >
        {isPending ? "Traitement…" : "Encaisser maintenant"}
      </button>

      <button
        type="button"
        disabled={actionsDisabled}
        onClick={onHold}
        className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300"
      >
        Mettre en attente d&apos;encaissement
      </button>

      {isEmpty ? (
        <p className="text-center text-[11px] text-slate-400">
          Ajoutez des articles, puis encaisser ou mettre en attente pour ouvrir une autre
          commande.
        </p>
      ) : (
        <button
          type="button"
          disabled={actionsDisabled}
          onClick={onClear}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          Vider le panier
        </button>
      )}
    </div>
  );
}
