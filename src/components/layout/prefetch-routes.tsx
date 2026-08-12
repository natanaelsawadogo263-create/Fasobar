"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Prefetch manuel : fonctionne aussi en `next dev`. */
export function PrefetchRoutes({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();
  const key = hrefs.join("|");

  useEffect(() => {
    for (const href of key.split("|")) {
      if (!href) continue;
      try {
        router.prefetch(href);
      } catch {
        // ignore
      }
    }
  }, [router, key]);

  return null;
}
