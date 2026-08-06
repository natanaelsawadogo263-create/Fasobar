import type { ReactNode } from "react";
import { X } from "lucide-react";

type ModalShellProps = {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  formId?: string;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  dismissible?: boolean;
  noValidate?: boolean;
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
        aria-describedby={formId ? `${formId}-subtitle` : undefined}
        className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <form
          id={formId}
          onSubmit={onSubmit}
          noValidate={noValidate}
          className="flex min-h-0 flex-1 flex-col"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <h2
                id={formId ? `${formId}-title` : undefined}
                className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
              >
                {title}
              </h2>
              <p
                id={formId ? `${formId}-subtitle` : undefined}
                className="mt-1 text-sm text-slate-500"
              >
                {subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la fenêtre"
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 ${
                dismissible ? "" : "hidden"
              }`}
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {children}
          </div>

          <footer className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
            {footer}
          </footer>
        </form>
      </div>
    </div>
  );
}
