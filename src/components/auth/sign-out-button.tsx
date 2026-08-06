"use client";

import { LogOut } from "lucide-react";

import { signOutAction } from "@/lib/auth/actions";

type SignOutButtonProps = {
  variant?: "default" | "dark";
  label?: string;
  compact?: boolean;
};

export function SignOutButton({
  variant = "default",
  label = "Se déconnecter",
  compact = false,
}: SignOutButtonProps) {
  const isDark = variant === "dark";

  return (
    <form action={signOutAction}>
      <button
        type="submit"
        title={label}
        aria-label={label}
        className={
          isDark
            ? "inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
            : "rounded-xl border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50"
        }
      >
        {isDark ? <LogOut className="h-3.5 w-3.5" /> : null}
        {compact && isDark ? (
          <span className="hidden sm:inline">{label}</span>
        ) : (
          label
        )}
      </button>
    </form>
  );
}
