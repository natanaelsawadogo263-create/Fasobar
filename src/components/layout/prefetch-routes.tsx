"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Écrans les plus utilisés — préchargés immédiatement. */
const PRIORITY_PREFIXES = [
  "/application/tableau-de-bord",
  "/application/caisse",
  "/application/produits",
  "/application/stock",
  "/application/ventes",
  "/application/commandes",
  "/application/commandes-ouvertes",
  "/application/approvisionnements",
  "/application/depenses",
  "/application/caisse/session",
  "/application/station",
  "/application/station/employes",
  "/application/station/sessions",
  "/application/station/bilans",
  "/application/station/parametres",
  "/application/station/pompiste/session",
];

const IMMEDIATE_PREFETCH_LIMIT = 6;

function sortByPriority(hrefs: string[]): string[] {
  const rank = (href: string) => {
    const index = PRIORITY_PREFIXES.findIndex(
      (prefix) => href === prefix || href.startsWith(`${prefix}/`),
    );
    return index === -1 ? PRIORITY_PREFIXES.length : index;
  };
  return [...hrefs].sort((a, b) => rank(a) - rank(b));
}

function scheduleIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const timer = window.setTimeout(callback, 1200);
  return () => window.clearTimeout(timer);
}

/**
 * Précharge les routes chaudes en priorité, le reste en idle
 * pour ne pas concurrencer le chargement de la page courante.
 */
export function PrefetchRoutes({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const key = Array.from(new Set([...PRIORITY_PREFIXES, ...hrefs].filter(Boolean))).join(
    "|",
  );
  const doneRef = useRef<string>("");

  useEffect(() => {
    if (doneRef.current === key) return;
    doneRef.current = key;

    const ordered = sortByPriority(
      key.split("|").filter((href) => href && href !== pathname),
    );
    if (ordered.length === 0) return;

    let cancelled = false;
    let cancelIdle: (() => void) | null = null;

    const prefetch = (routes: string[]) => {
      if (cancelled) return;
      for (const href of routes) {
        try {
          router.prefetch(href);
        } catch {
          // ignore
        }
      }
    };

    const immediate = ordered.slice(0, IMMEDIATE_PREFETCH_LIMIT);
    const deferred = ordered.slice(IMMEDIATE_PREFETCH_LIMIT);

    const frame = requestAnimationFrame(() => {
      prefetch(immediate);
      if (deferred.length > 0) {
        cancelIdle = scheduleIdle(() => prefetch(deferred));
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      cancelIdle?.();
    };
  }, [router, key, pathname]);

  return null;
}
