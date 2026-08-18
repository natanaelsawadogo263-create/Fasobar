"use client";

import { useEffect } from "react";

export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NEXT_PUBLIC_FASOBAR_RUNTIME === "desktop-server") return;

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // PWA optionnelle — ne pas bloquer l'app si le SW échoue.
    });
  }, []);

  return null;
}
