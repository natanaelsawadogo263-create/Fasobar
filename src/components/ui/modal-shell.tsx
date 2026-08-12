import type { ReactNode } from "react";
import { X } from "lucide-react";

type ModalShellProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  formId?: string;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  dismissible?: boolean;
  noValidate?: boolean;
  /** En-tête et paddings plus serrés (formulaires longs). */
  compact?: boolean;
};

export function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  formId,
  onSubmit,
  dismissible = true,
  noValidate = false,
  compact = false,
}: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={formId ? `${formId}-title` : undefined}
        aria-describedby={formId && subtitle ? `${formId}-subtitle` : undefined}
        className={`flex w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${
          compact
            ? "max-h-[90dvh] max-w-[560px]"
            : "max-h-[92dvh] max-w-[720px]"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <form
          id={formId}
          onSubmit={onSubmit}
          noValidate={noValidate}
          className="flex min-h-0 flex-1 flex-col"
        >
          <header
            className={`flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 ${
              compact ? "px-4 py-2.5 sm:px-5" : "px-4 py-3 sm:px-6 sm:py-5"
            }`}
          >
            <div className="min-w-0">
              <h2
                id={formId ? `${formId}-title` : undefined}
                className={
                  compact
                    ? "text-[15px] font-semibold tracking-tight text-slate-900"
                    : "text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
                }
              >
                {title}
              </h2>
              {subtitle ? (
                <p
                  id={formId ? `${formId}-subtitle` : undefined}
                  className={
                    compact
                      ? "mt-0.5 text-[11px] leading-snug text-slate-500"
                      : "mt-1 text-sm text-slate-500"
                  }
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la fenêtre"
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 sm:h-9 sm:w-9 sm:rounded-lg ${
                dismissible ? "" : "hidden"
              }`}
            >
              <X className="h-5 w-5 sm:h-[18px] sm:w-[18px]" />
            </button>
          </header>

          <div
            className={`min-h-0 flex-1 overflow-y-auto ${
              compact ? "px-4 py-3 sm:px-5" : "px-4 py-4 sm:px-6 sm:py-5"
            }`}
          >
            {children}
          </div>

          <footer
            className={`shrink-0 border-t border-slate-100 bg-slate-50/80 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
              compact ? "px-4 pt-2.5 sm:px-5" : "px-4 pt-3 sm:px-6 sm:pt-4"
            }`}
          >
            {footer}
          </footer>
        </form>
      </div>
    </div>
  );
}
