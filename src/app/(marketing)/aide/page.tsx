import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/marketing/page-hero";
import { WhatsAppContact } from "@/components/marketing/whatsapp-contact";
import { MARKETING_FAQ } from "@/lib/marketing/faq";

export const metadata: Metadata = {
  title: "Aide — FasoBar",
  description: "Aide et questions fréquentes sur FasoBar.",
};

export default function AidePage() {
  return (
    <>
      <PageHero
        kicker="Aide"
        title="Centre d’aide FasoBar."
        subtitle="Inscription, connexion, Desktop et abonnement."
      />
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Démarrer</h2>
          <ul className="mt-3 space-y-2 text-[14px] text-slate-600">
            <li>
              <Link href="/inscription/activite" className="font-medium text-emerald-800 hover:underline">
                Créer mon établissement
              </Link>
            </li>
            <li>
              <Link href="/connexion" className="font-medium text-emerald-800 hover:underline">
                Se connecter
              </Link>
            </li>
            <li>
              <Link href="/telecharger" className="font-medium text-emerald-800 hover:underline">
                Télécharger FasoBar Desktop
              </Link>
            </li>
            <li>
              <Link href="/tarifs" className="font-medium text-emerald-800 hover:underline">
                Consulter les tarifs
              </Link>
            </li>
            <li>
              <Link href="/contact" className="font-medium text-emerald-800 hover:underline">
                Contact / WhatsApp
              </Link>
            </li>
          </ul>
          <div className="mt-5">
            <WhatsAppContact />
          </div>
        </div>

        <h2 id="faq" className="mt-10 scroll-mt-24 text-xl font-semibold text-slate-900">
          FAQ
        </h2>
        <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
          {MARKETING_FAQ.map((item) => (
            <details key={item.question} className="py-4">
              <summary className="cursor-pointer list-none text-[15px] font-semibold text-slate-900">
                {item.question}
              </summary>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
