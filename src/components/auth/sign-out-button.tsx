"use client";

import { LogOut } from "lucide-react";

import { signOutAction } from "@/lib/auth/actions";

type SignOutButtonProps = {
  variant?: "default" | "dark" | "ghost";
  label?: string;
  compact?: boolean;
};

export function SignOutButton({
  variant = "default",
  label = "Se déconnecter",
  compact = false,
}: SignOutButtonProps) {
  const isDark = variant === "dark";
  const isGhost = variant === "ghost";

  return (
    <form action={signOutAction}>
      <button
        type="submit"
        title={label}
        aria-label={label}
        className={
          isDark
            ? "inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
            : isGhost
              ? "inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              : "rounded-xl border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50"
        }
      >
        {isDark || isGhost ? <LogOut className="h-3.5 w-3.5" /> : null}
        {compact && (isDark || isGhost) ? (
          <span className="hidden sm:inline">{label}</span>
        ) : (
          label
        )}
      </button>
    </form>
  );
}
