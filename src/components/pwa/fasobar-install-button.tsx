"use client";

import { Download, Share, Smartphone, X } from "lucide-react";

import { useFasoBarPwaInstall } from "@/hooks/use-fasobar-pwa-install";

type FasoBarInstallButtonProps = {
  variant?: "primary" | "secondary" | "outline" | "header" | "ghost";
  className?: string;
  /** Masquer si l'app est déjà installée (défaut: true). */
  hideWhenInstalled?: boolean;
  showInstalledLabel?: boolean;
};

const VARIANT_CLASSES: Record<
  NonNullable<FasoBarInstallButtonProps["variant"]>,
  string
> = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-[13px] font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:opacity-60",
  outline:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60",
  header:
    "inline-flex h-11 min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 text-[13px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 disabled:opacity-60",
  ghost:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-emerald-100 transition hover:bg-white/10 disabled:opacity-60",
};

export function FasoBarInstallButton({
  variant = "outline",
  className = "",
  hideWhenInstalled = true,
  showInstalledLabel = false,
}: FasoBarInstallButtonProps) {
  const {
    canNativeInstall,
    isInstalled,
    isIOS,
    showIOSHelp,
    setShowIOSHelp,
    install,
  } = useFasoBarPwaInstall();

  if (hideWhenInstalled && isInstalled && !showInstalledLabel) {
    return null;
  }

  const label = isInstalled
    ? "Application installée"
    : canNativeInstall || isIOS
      ? "Installer FasoBar"
      : "Télécharger le raccourci";

  return (
    <>
      <button
        type="button"
        onClick={() => void install()}
        disabled={isInstalled && !showInstalledLabel}
        className={`${VARIANT_CLASSES[variant]} ${className}`.trim()}
        title="Installer FasoBar sur cet appareil"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </button>

      {showIOSHelp ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-[2px] sm:items-center">
          <div
            role="dialog"
            aria-labelledby="ios-install-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-4 py-3.5">
              <div>
                <p
                  id="ios-install-title"
                  className="text-[15px] font-semibold text-slate-900"
                >
                  Installer FasoBar sur iPhone / iPad
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Ajoutez l’app à votre écran d’accueil.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSHelp(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="space-y-3 px-4 py-4 text-[13px] leading-relaxed text-slate-700">
              <li className="flex gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-800">
                  <Share className="h-3.5 w-3.5" />
                </span>
                <span>
                  Appuyez sur <strong>Partager</strong> en bas de Safari.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-800">
                  <Smartphone className="h-3.5 w-3.5" />
                </span>
                <span>
                  Choisissez <strong>Sur l’écran d’accueil</strong>, puis{" "}
                  <strong>Ajouter</strong>.
                </span>
              </li>
            </ol>
            <div className="border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowIOSHelp(false)}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-700 text-[13px] font-semibold text-white hover:bg-emerald-600"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
