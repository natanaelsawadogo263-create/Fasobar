"use client";

import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/lib/auth/actions";

type SignOutFormProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Bouton de déconnexion : le premier clic ouvre une confirmation, la
 * déconnexion n'a lieu qu'après « Se déconnecter ».
 */
export function SignOutForm({ children, className }: SignOutFormProps) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmOpen(true);
  }

  function confirmSignOut() {
    startTransition(async () => {
      try {
        await signOutAction();
      } catch {
        // redirect() lève une exception côté client — navigation de secours.
      }
      window.location.assign("/");
    });
  }

  return (
    <>
      <form className={className} onSubmit={handleSubmit}>
        <fieldset disabled={pending} className="contents">
          {children}
        </fieldset>
      </form>
      {confirmOpen ? (
        <SignOutConfirmDialog
          pending={pending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={confirmSignOut}
        />
      ) : null}
    </>
  );
}

function SignOutConfirmDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, onCancel]);

  // Portail : la fenêtre ne doit pas hériter du placement de la barre (overflow, z-index).
  return createPortal(
    <div
      data-sign-out-confirm=""
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={pending ? undefined : onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sign-out-confirm-title"
        aria-describedby="sign-out-confirm-text"
        className="w-full max-w-sm overflow-hidden rounded-t-2xl bg-white text-left shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-2 px-5 pb-4 pt-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <LogOut className="h-5 w-5" />
          </span>
          <h2 id="sign-out-confirm-title" className="text-[16px] font-bold tracking-tight text-slate-900">
            Se déconnecter ?
          </h2>
          <p id="sign-out-confirm-text" className="text-[13px] text-slate-500">
            Vous devrez saisir à nouveau vos identifiants pour revenir dans l’application.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            autoFocus
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 transition active:bg-slate-50 disabled:opacity-60 sm:h-9 sm:rounded-lg sm:hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-[13px] font-semibold text-white shadow-sm transition active:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70 sm:h-9 sm:rounded-lg sm:hover:bg-red-700"
          >
            <LogOut className="h-4 w-4" />
            {pending ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
