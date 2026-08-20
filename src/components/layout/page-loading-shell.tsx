type PageLoadingShellProps = {
  label?: string;
};

/** Fallback ultra-léger — affiché avant le SSR des données lourdes. */
export function PageLoadingShell({ label = "Chargement…" }: PageLoadingShellProps) {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-emerald-600" />
      <p className="text-[13px] font-medium text-slate-600">{label}</p>
    </div>
  );
}
