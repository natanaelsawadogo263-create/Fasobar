"use client";

import { useCallback, useEffect, useState } from "react";

import {
  downloadFasoBarUrlShortcut,
  isIosDevice,
  isStandaloneDisplayMode,
  type BeforeInstallPromptEvent,
  type FasoBarInstallOutcome,
} from "@/lib/pwa/install";

export function useFasoBarPwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    setIsIOS(isIosDevice());
    setIsInstalled(isStandaloneDisplayMode());

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }

    function onDisplayModeChange() {
      setIsInstalled(isStandaloneDisplayMode());
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window
      .matchMedia("(display-mode: standalone)")
      .addEventListener("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window
        .matchMedia("(display-mode: standalone)")
        .removeEventListener("change", onDisplayModeChange);
    };
  }, []);

  const canNativeInstall = deferredPrompt != null;

  const install = useCallback(async (): Promise<FasoBarInstallOutcome> => {
    if (isInstalled) return "already-installed";

    if (isIOS) {
      setShowIOSHelp(true);
      return "ios-help";
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
      return choice.outcome;
    }

    downloadFasoBarUrlShortcut();
    return "shortcut-download";
  }, [deferredPrompt, isInstalled, isIOS]);

  return {
    canNativeInstall,
    isInstalled,
    isIOS,
    showIOSHelp,
    setShowIOSHelp,
    install,
  };
}
