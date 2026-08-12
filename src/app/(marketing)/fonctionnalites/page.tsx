import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/marketing/page-hero";
import { MARKETING_FEATURES } from "@/lib/marketing/features";

export const metadata: Metadata = {
  title: "Fonctionnalités — FasoBar",
  description: "Stock, ventes, caisse, employés et suivi d’activité avec FasoBar.",
};

export default function FonctionnalitesPage() {
  return (
    <>
      <PageHero
        kicker="Fonctionnalités"
        title="Stock, ventes et caisse."
        subtitle="Les modules réellement disponibles dans FasoBar."
      />
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MARKETING_FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <h2 className="text-[16px] font-semibold text-slate-900">
                {feature.title}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/inscription/activite"
            className="inline-flex h-11 items-center rounded-xl bg-emerald-700 px-5 text-[14px] font-semibold text-white hover:bg-emerald-600"
          >
            Créer mon établissement
          </Link>
          <Link
            href="/tarifs"
            className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-[14px] font-semibold text-slate-800 hover:bg-slate-50"
          >
            Voir les tarifs
          </Link>
        </div>
      </section>
    </>
  );
}
