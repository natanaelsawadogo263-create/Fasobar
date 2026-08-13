"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useToastOptional } from "@/components/ui/toast";
import { toUserFacingError } from "@/lib/errors/user-facing";

type AlertMessageProps = {
  message: string;
  tone?: "error" | "success";
  /** Affiche une croix pour fermer la notification (défaut: true). */
  dismissible?: boolean;
  onDismiss?: () => void;
  /**
   * `toast` = overlay éphémère (défaut pour success).
   * `inline` = bandeau dans le flux (formulaires / erreurs persistantes).
   */
  variant?: "auto" | "toast" | "inline";
};

const AUTO_DISMISS_MS = 3500;

/**
 * Succès → toast flottant auto-dismiss (ne prend pas de place).
 * Erreur → bandeau inline par défaut (lisible dans les formulaires).
 */
export function AlertMessage({
  message,
  tone = "error",
  dismissible = true,
  onDismiss,
  variant = "auto",
}: AlertMessageProps) {
  const toast = useToastOptional();
  const displayMessage =
    tone === "error" ? toUserFacingError(message) : message;
  const mode =
    variant === "auto" ? (tone === "success" ? "toast" : "inline") : variant;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const pushedRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== "toast" || !toast) return;
    const key = `${tone}:${displayMessage}`;
    if (pushedRef.current === key) return;
    pushedRef.current = key;
    toast.show(displayMessage, tone);
    // Libère l’état parent pour éviter un 2ᵉ toast après router.refresh().
    queueMicrotask(() => onDismissRef.current?.());
  }, [mode, toast, displayMessage, tone]);

  if (mode === "toast" && toast) {
    return null;
  }

  if (mode === "toast") {
    return (
      <StandaloneToast
        message={displayMessage}
        tone={tone}
        dismissible={dismissible}
        onDismiss={onDismiss}
      />
    );
  }

  return (
    <InlineAlert
      message={displayMessage}
      tone={tone}
      dismissible={dismissible}
      onDismiss={onDismiss}
    />
  );
}

function InlineAlert({
  message,
  tone,
  dismissible,
  onDismiss,
}: {
  message: string;
  tone: "error" | "success";
  dismissible: boolean;
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [message]);

  if (!visible) return null;

  const styles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";

  const closeStyles =
    tone === "success"
      ? "text-emerald-600 hover:bg-emerald-100/80 hover:text-emerald-900"
      : "text-red-600 hover:bg-red-100/80 hover:text-red-900";

  function handleDismiss() {
    setVisible(false);
    onDismiss?.();
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${styles}`}
    >
      <p className="min-w-0 flex-1">{message}</p>
      {dismissible ? (
        <button
          type="button"
          onClick={handleDismiss}
          className={`-mr-1 -mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${closeStyles}`}
          aria-label="Fermer la notification"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      ) : null}
    </div>
  );
}

/** Fallback si le provider n’est pas encore monté (pages auth hors shell). */
function StandaloneToast({
  message,
  tone,
  dismissible,
  onDismiss,
}: {
  message: string;
  tone: "error" | "success";
  dismissible: boolean;
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDismissRef.current?.();
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!mounted || !visible) return null;

  const styles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";
  const closeStyles =
    tone === "success"
      ? "text-emerald-600 hover:bg-emerald-100/80 hover:text-emerald-900"
      : "text-red-600 hover:bg-red-100/80 hover:text-red-900";

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg shadow-slate-900/10 ${styles}`}
      >
        <p className="min-w-0 flex-1 font-medium leading-snug">{message}</p>
        {dismissible ? (
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              onDismissRef.current?.();
            }}
            className={`-mr-1 -mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${closeStyles}`}
            aria-label="Fermer la notification"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
