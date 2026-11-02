"use client";

import { useState } from "react";
import { Copy, Download, EllipsisVertical, MoreHorizontal, PlusSquare, Share, Smartphone, X } from "lucide-react";

import { useFasoBarPwaInstall } from "@/hooks/use-fasobar-pwa-install";
import type { InstallEnvironment } from "@/lib/pwa/install";

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
    environment,
    showIOSHelp,
    setShowIOSHelp,
    install,
  } = useFasoBarPwaInstall();
  const onPhone = environment !== "desktop";

  if (hideWhenInstalled && isInstalled && !showInstalledLabel) {
    return null;
  }

  const label = isInstalled
    ? "Application installée"
    : canNativeInstall || isIOS || onPhone
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
                  {HELP_TITLES[environment]}
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  {environment === "in-app"
                    ? "Ce navigateur intégré ne permet pas d’installer d’application."
                    : "Ajoutez l’app à votre écran d’accueil, elle s’ouvrira comme une vraie application."}
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
            <InstallSteps environment={environment} />
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

const HELP_TITLES: Record<InstallEnvironment, string> = {
  "in-app": "Ouvrez FasoBar dans votre navigateur",
  "ios-safari": "Installer FasoBar sur iPhone / iPad",
  "ios-other": "Installer FasoBar sur iPhone / iPad",
  android: "Installer FasoBar sur Android",
  desktop: "Installer FasoBar",
};

function Step({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-800">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

/** Étapes adaptées au téléphone et au navigateur utilisés. */
function InstallSteps({ environment }: { environment: InstallEnvironment }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/connexion`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <ol className="space-y-3 px-4 py-4 text-[13px] leading-relaxed text-slate-700">
      {environment === "in-app" ? (
        <>
          <Step icon={<MoreHorizontal className="h-3.5 w-3.5" />}>
            Appuyez sur <strong>⋯</strong> ou <strong>⋮</strong> (en haut à droite), puis{" "}
            <strong>Ouvrir dans Safari</strong> (iPhone) ou <strong>Ouvrir dans Chrome</strong> (Android).
          </Step>
          <Step icon={<Copy className="h-3.5 w-3.5" />}>
            Sinon, copiez le lien et collez-le dans Safari ou Chrome :{" "}
            <button
              type="button"
              onClick={() => void copyLink()}
              className="font-semibold text-emerald-700 underline"
            >
              {copied ? "Lien copié" : "Copier le lien"}
            </button>
          </Step>
          <Step icon={<Download className="h-3.5 w-3.5" />}>
            Dans le navigateur, appuyez de nouveau sur <strong>Installer FasoBar</strong>.
          </Step>
        </>
      ) : environment === "ios-safari" ? (
        <>
          <Step icon={<Share className="h-3.5 w-3.5" />}>
            Appuyez sur <strong>Partager</strong> <Share className="inline h-3.5 w-3.5" /> en bas de
            Safari. Sur les iPhone récents, appuyez d’abord sur <strong>⋯</strong> puis{" "}
            <strong>Partager</strong>.
          </Step>
          <Step icon={<PlusSquare className="h-3.5 w-3.5" />}>
            Faites défiler et choisissez <strong>Sur l’écran d’accueil</strong>.
          </Step>
          <Step icon={<Smartphone className="h-3.5 w-3.5" />}>
            Laissez <strong>Ouvrir comme app web</strong> activé si proposé, puis appuyez sur{" "}
            <strong>Ajouter</strong>. L’icône FasoBar apparaît sur l’écran d’accueil.
          </Step>
        </>
      ) : environment === "ios-other" ? (
        <>
          <Step icon={<Share className="h-3.5 w-3.5" />}>
            Appuyez sur <strong>Partager</strong> <Share className="inline h-3.5 w-3.5" /> (dans la
            barre d’adresse ou le menu <strong>⋯</strong>).
          </Step>
          <Step icon={<PlusSquare className="h-3.5 w-3.5" />}>
            Choisissez <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>.
          </Step>
          <Step icon={<Smartphone className="h-3.5 w-3.5" />}>
            Option absente ? Mettez l’iPhone à jour, ou ouvrez fasobar.com dans{" "}
            <strong>Safari</strong> et recommencez.
          </Step>
        </>
      ) : (
        <>
          <Step icon={<EllipsisVertical className="h-3.5 w-3.5" />}>
            Appuyez sur le menu <strong>⋮</strong> du navigateur (en haut ou en bas à droite).
          </Step>
          <Step icon={<PlusSquare className="h-3.5 w-3.5" />}>
            Choisissez <strong>Installer l’application</strong> ou{" "}
            <strong>Ajouter à l’écran d’accueil</strong>.
          </Step>
          <Step icon={<Smartphone className="h-3.5 w-3.5" />}>
            Confirmez avec <strong>Installer</strong> : l’icône FasoBar apparaît sur l’écran
            d’accueil.
          </Step>
        </>
      )}
    </ol>
  );
}
