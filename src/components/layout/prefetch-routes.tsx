"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Ordre de priorité pour trier les liens déjà dans la nav (pas d’ajout global). */
const PRIORITY_PREFIXES = [
  "/application/tableau-de-bord",
  "/application/caisse",
  "/application/station/pompiste/session",
  "/application/station",
  "/application/bar",
  "/application/cuisine",
  "/application/produits",
  "/application/stock",
  "/application/ventes",
  "/application/commandes",
  "/application/commandes-ouvertes",
  "/application/approvisionnements",
  "/application/depenses",
];

const IMMEDIATE_PREFETCH_LIMIT = 8;

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
 * Précharge uniquement les routes de la nav de l’espace courant
 * (pas de prefetch station pour un caissier alimentation, etc.).
 */
export function PrefetchRoutes({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const key = Array.from(new Set(hrefs.filter(Boolean))).join("|");
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
