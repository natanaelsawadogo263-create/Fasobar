"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type AlertMessageProps = {
  message: string;
  tone?: "error" | "success";
  /** Affiche une croix pour fermer la notification (défaut: true). */
  dismissible?: boolean;
  onDismiss?: () => void;
};

export function AlertMessage({
  message,
  tone = "error",
  dismissible = true,
  onDismiss,
}: AlertMessageProps) {
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
