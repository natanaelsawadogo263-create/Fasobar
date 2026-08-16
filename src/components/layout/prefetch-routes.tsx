"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Écrans les plus utilisés — préchargés en premier, en parallèle. */
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
 * Précharge toutes les routes de navigation dès le premier paint,
 * pour que le clic suivant ouvre l’écran déjà en cache.
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
    let frame1 = 0;
    let frame2 = 0;

    const run = () => {
      if (cancelled) return;
      for (const href of ordered) {
        try {
          router.prefetch(href);
        } catch {
          // ignore
        }
      }
    };

    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(run);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [router, key, pathname]);

  return null;
}
