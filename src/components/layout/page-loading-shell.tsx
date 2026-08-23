type PageLoadingShellProps = {
  label?: string;
};

const ROW_WIDTHS = ["w-2/3", "w-1/2", "w-3/5", "w-5/12", "w-1/3"] as const;

/**
 * Fallback affiché pendant le chargement d'une page.
 *
 * Un squelette générique (bandeau titre + puces de filtre + lignes de
 * contenu qui pulsent) plutôt qu'une simple roue seule au centre de l'écran :
 * la page donne l'impression de déjà se construire, ce qui se perçoit comme
 * nettement plus rapide qu'un écran vide — surtout sensible sur mobile, où
 * cet écran est souvent la première chose vue après un tap.
 */
export function PageLoadingShell({ label = "Chargement…" }: PageLoadingShellProps) {
  return (
    <div
      className="flex min-h-[50vh] w-full flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-slate-500">
        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
        <span className="text-[12px] font-medium">{label}</span>
      </div>

      <div className="animate-pulse space-y-2">
        <div className="h-5 w-40 rounded-lg bg-slate-200 sm:h-6 sm:w-56" />
        <div className="h-3 w-52 rounded-md bg-slate-100 sm:w-72" />
      </div>

      <div className="flex animate-pulse flex-wrap gap-2">
        <div className="h-8 w-20 rounded-lg bg-slate-100" />
        <div className="h-8 w-24 rounded-lg bg-slate-100" />
        <div className="h-8 w-16 rounded-lg bg-slate-100" />
      </div>

      <div className="animate-pulse space-y-2.5">
        {ROW_WIDTHS.map((width, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className={`h-3 rounded bg-slate-200 ${width}`} />
              <div className="h-2.5 w-1/4 rounded bg-slate-100" />
            </div>
            <div className="h-4 w-12 shrink-0 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
