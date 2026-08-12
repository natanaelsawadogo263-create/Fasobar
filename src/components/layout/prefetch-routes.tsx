"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Routes admin les plus utilisées — préchargées en premier. */
const PRIORITY_PREFIXES = [
  "/application/tableau-de-bord",
  "/application/produits",
  "/application/stock",
  "/application/ventes",
  "/application/commandes",
  "/application/caisse",
  "/application/approvisionnements",
];

function sortByPriority(hrefs: string[]): string[] {
  const rank = (href: string) => {
    const index = PRIORITY_PREFIXES.findIndex(
      (prefix) => href === prefix || href.startsWith(`${prefix}/`),
    );
    return index === -1 ? PRIORITY_PREFIXES.length : index;
  };
  return [...hrefs].sort((a, b) => rank(a) - rank(b));
}

/**
 * Prefetch progressif hors chemin critique : idle + décalage,
 * pour ne pas saturer le réseau au premier rendu.
 */
export function PrefetchRoutes({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const key = hrefs.join("|");
  const doneRef = useRef<string>("");

  useEffect(() => {
    if (doneRef.current === key) return;
    doneRef.current = key;

    const ordered = sortByPriority(
      key.split("|").filter((href) => href && href !== pathname),
    );
    if (ordered.length === 0) return;

    let cancelled = false;
    let index = 0;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const prefetchNext = () => {
      if (cancelled || index >= ordered.length) return;
      const href = ordered[index++];
      try {
        router.prefetch(href);
      } catch {
        // ignore
      }
      if (index >= ordered.length) return;

      const schedule =
        typeof window !== "undefined" && "requestIdleCallback" in window
          ? (cb: () => void) => {
              idleId = window.requestIdleCallback(() => cb(), { timeout: 1500 });
            }
          : (cb: () => void) => {
              timeoutId = setTimeout(cb, 80);
            };

      schedule(prefetchNext);
    };

    // Laisser le premier paint / hydratation passer avant de précharger.
    timeoutId = setTimeout(prefetchNext, 120);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [router, key, pathname]);

  return null;
}
