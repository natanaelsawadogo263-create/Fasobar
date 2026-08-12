"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

function getFullscreenElement(): Element | null {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

async function enterFullscreen(target: HTMLElement) {
  const el = target as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  if (el.requestFullscreen) {
    await el.requestFullscreen();
    return;
  }
  if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen();
  }
}

async function exitFullscreen() {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
  };
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
  }
}

type FullscreenButtonProps = {
  className?: string;
  showLabel?: boolean;
};

/** Passe la fenêtre / l’app en plein écran (API navigateur). */
export function FullscreenButton({
  className = "",
  showLabel = true,
}: FullscreenButtonProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    function sync() {
      setActive(Boolean(getFullscreenElement()));
    }
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  async function toggle() {
    try {
      if (getFullscreenElement()) {
        await exitFullscreen();
      } else {
        await enterFullscreen(document.documentElement);
      }
    } catch {
      // Navigateur a refusé / non supporté
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      title={active ? "Quitter le plein écran" : "Plein écran"}
      aria-label={active ? "Quitter le plein écran" : "Plein écran"}
      aria-pressed={active}
      className={
        className ||
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-100"
      }
    >
      {active ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
      {showLabel ? (
        <span className="hidden lg:inline">
          {active ? "Réduire" : "Plein écran"}
        </span>
      ) : null}
    </button>
  );
}
