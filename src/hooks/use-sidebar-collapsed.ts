"use client";

import { useEffect, useState } from "react";

/**
 * Persiste l’état replié de la sidebar desktop (localStorage).
 */
export function useSidebarCollapsed(storageKey: string, defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === "1") setCollapsed(true);
      if (raw === "0") setCollapsed(false);
    } catch {
      // ignore
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed, ready, storageKey]);

  return {
    collapsed,
    setCollapsed,
    toggle: () => setCollapsed((current) => !current),
  };
}
