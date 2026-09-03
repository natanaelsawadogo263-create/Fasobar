"use client";

import { useEffect } from "react";

function clearAppBadge() {
  const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
  if (typeof nav.clearAppBadge === "function") {
    void nav.clearAppBadge().catch(() => {
      // ignore
    });
  }
}

export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NEXT_PUBLIC_FASOBAR_RUNTIME === "desktop-server") return;

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // PWA optionnelle — ne pas bloquer l'app si le SW échoue.
    });

    // L'utilisateur peut aussi rouvrir FasoBar directement depuis l'icône
    // (pas forcément en tapant sur la notification) — effacer la pastille
    // rouge dès que l'app redevient visible, pas seulement au clic dessus.
    clearAppBadge();
    function onVisibilityChange() {
      if (document.visibilityState === "visible") clearAppBadge();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
