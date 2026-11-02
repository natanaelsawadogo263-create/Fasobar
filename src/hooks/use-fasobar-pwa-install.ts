"use client";

import { useCallback, useEffect, useState } from "react";

import {
  detectInstallEnvironment,
  downloadFasoBarUrlShortcut,
  isIosDevice,
  isStandaloneDisplayMode,
  type BeforeInstallPromptEvent,
  type FasoBarInstallOutcome,
  type InstallEnvironment,
} from "@/lib/pwa/install";

export function useFasoBarPwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [environment, setEnvironment] = useState<InstallEnvironment>("desktop");

  useEffect(() => {
    setIsIOS(isIosDevice());
    setEnvironment(detectInstallEnvironment());
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

    // Navigateur intégré (WhatsApp, Facebook…) : impossible d'installer d'ici.
    if (environment === "in-app") {
      setShowIOSHelp(true);
      return "manual-help";
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

    // Téléphone Android sans fenêtre automatique : étapes via le menu ⋮
    // (un fichier raccourci .url ne sert à rien sur un téléphone).
    if (environment === "android") {
      setShowIOSHelp(true);
      return "manual-help";
    }

    downloadFasoBarUrlShortcut();
    return "shortcut-download";
  }, [deferredPrompt, environment, isInstalled, isIOS]);

  return {
    canNativeInstall,
    isInstalled,
    isIOS,
    environment,
    showIOSHelp,
    setShowIOSHelp,
    install,
  };
}
