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
        title="Parler à FasoBar."
        subtitle="Une question sur FasoBar ? Écrivez-nous sur WhatsApp."
      />
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 leading-relaxed text-slate-600">
          <p className="text-[15px] font-semibold text-slate-900">WhatsApp</p>
          <p className="mt-2">
            Cliquez sur le bouton pour ouvrir WhatsApp directement avec le
            numéro FasoBar :{" "}
            <span className="font-semibold text-slate-800">
              {FASOBAR_WHATSAPP.display}
            </span>
            .
          </p>
          <div className="mt-6">
            <WhatsAppContact />
          </div>
          <p className="mt-8 text-[14px]">
            Vous pouvez aussi créer votre établissement ou vous connecter à
            votre espace existant.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/inscription"
              className="inline-flex h-11 items-center rounded-xl bg-emerald-700 px-5 text-[14px] font-semibold text-white hover:bg-emerald-600"
            >
              Créer mon établissement
            </Link>
            <Link
              href="/connexion"
              className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-5 text-[14px] font-semibold text-slate-800 hover:bg-slate-50"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
