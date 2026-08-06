"use client";

import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type PosToastProps = {
  message: string;
  tone?: "success" | "error" | "info";
  onDismiss?: () => void;
};

const TONE_STYLES = {
  success: "border-emerald-200 bg-emerald-950 text-emerald-50",
  error: "border-red-200 bg-red-950 text-red-50",
  info: "border-slate-600 bg-slate-900 text-slate-100",
};

const TONE_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function PosToast({ message, tone = "info", onDismiss }: PosToastProps) {
  const Icon = TONE_ICONS[tone];

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${TONE_STYLES[tone]}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md px-2 py-0.5 text-xs opacity-80 hover:opacity-100"
        >
          Fermer
        </button>
      ) : null}
    </div>
  );
}
