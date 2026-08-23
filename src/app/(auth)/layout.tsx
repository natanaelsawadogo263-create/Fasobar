"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ce div (et non la fenêtre) porte le scroll de tout le tunnel d'inscription
  // (activité → inscription → connexion → ...). Next.js ne réinitialise que le
  // scroll de la fenêtre lors d'une navigation, jamais celui d'un conteneur
  // interne : en passant d'une page haute (grille de 14 activités, scrollée
  // jusqu'en bas) à une page bien plus courte (formulaire d'inscription), ce
  // div gardait son ancienne position de scroll et affichait une bande vide —
  // c'est ce qui donnait l'impression que « la page devient bizarre ».
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div
      ref={scrollRef}
      className="h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain bg-slate-50"
    >
      <div className="mx-auto flex min-h-full w-full items-center justify-center px-4 py-8 sm:py-12">
        {children}
      </div>
    </div>
  );
}
