import type { Metadata } from "next";

import { AffichePoster } from "@/components/marketing/affiche-poster";

export const metadata: Metadata = {
  title: "Affiche",
  description: "Affiche publicitaire FasoBar : tarifs logiciel et kit.",
  // Outil interne (affiche à imprimer), pas un contenu pour Google.
  robots: {
    index: false,
    follow: false,
  },
};

export default function AffichePage() {
  return (
    <section className="bg-[#0b1220] px-4 py-8 print:bg-white print:p-0 sm:px-6 sm:py-10">
      <p className="mx-auto mb-4 max-w-[794px] text-center text-[13px] text-emerald-100/70 print:hidden">
        Affiche à imprimer ou à enregistrer (Ctrl+P).
      </p>
      <AffichePoster />
    </section>
  );
}
