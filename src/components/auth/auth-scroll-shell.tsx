"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Ce div (et non la fenêtre) porte le scroll de tout le tunnel d'authentification
 * (activité → inscription → connexion → ...). Next.js ne réinitialise que le
 * scroll de la fenêtre lors d'une navigation, jamais celui d'un conteneur
 * interne : en passant d'une page haute (grille de 14 activités, scrollée
 * jusqu'en bas) à une page bien plus courte (formulaire d'inscription), ce
 * div gardait son ancienne position de scroll et affichait une bande vide.
 *
 * Composant client séparé du layout : `layout.tsx` reste un composant serveur
 * pour pouvoir exporter `metadata` (noindex), ce qu'un composant "use client"
 * ne peut pas faire.
 */
export function AuthScrollShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div
      ref={scrollRef}
      className="h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain bg-slate-50"
    >
      <div className="mx-auto flex min-h-full w-full items-center justify-center px-4 py-4 sm:py-8">
        {children}
      </div>
    </div>
  );
}
