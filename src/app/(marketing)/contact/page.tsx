import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/marketing/page-hero";
import { WhatsAppContact } from "@/components/marketing/whatsapp-contact";
import { FASOBAR_WHATSAPP } from "@/lib/marketing/config";

export const metadata: Metadata = {
  title: "Contact — FasoBar",
  description: `Contacter FasoBar sur WhatsApp au ${FASOBAR_WHATSAPP.display}.`,
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        kicker="Contact"
        title="On vous répond sur WhatsApp."
        subtitle="Une question sur FasoBar, l’essai ou l’abonnement ? Écrivez-nous."
      />
      <section className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
            WhatsApp
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {FASOBAR_WHATSAPP.display}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
            Le message s’ouvre directement avec le numéro FasoBar.
          </p>
          <div className="mt-6">
            <WhatsAppContact className="w-full justify-center" />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/inscription/activite"
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-emerald-700 px-5 text-[14px] font-semibold text-white hover:bg-emerald-600"
          >
            Créer mon établissement
          </Link>
          <Link
            href="/connexion"
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-[14px] font-semibold text-slate-800 hover:bg-slate-50"
          >
            Se connecter
          </Link>
        </div>
      </section>
    </>
  );
}
