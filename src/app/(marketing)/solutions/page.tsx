import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/marketing/page-hero";
import { MARKETING_ACTIVITIES } from "@/lib/marketing/config";

export const metadata: Metadata = {
  title: "Solutions — FasoBar",
  description:
    "FasoBar, logiciel de gestion des stocks et des ventes pour toute activité commerciale.",
};

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        kicker="Solutions"
        title="Un logiciel, toutes vos activités."
        subtitle="FasoBar n’est pas réservé à un métier. C’est un outil de gestion de stock et de ventes, dès qu’une activité a des articles à suivre et des encaissements à faire."
      />
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MARKETING_ACTIVITIES.map((item) => (
            <article
              key={item.id}
              id={item.id}
              className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white px-5 py-6"
            >
              <h2 className="text-[16px] font-semibold text-slate-900">
                {item.label}
              </h2>
              <p className="mt-1.5 text-[13px] leading-snug text-slate-500">
                {item.description}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-8 max-w-2xl text-[14px] leading-relaxed text-slate-600">
          FasoBar s’adapte à l’activité choisie à l’inscription : boutique,
          pharmacie, quincaillerie, restaurant ou un autre commerce.
        </p>
        <Link
          href="/inscription/activite"
          className="mt-8 inline-flex h-11 items-center rounded-xl bg-emerald-700 px-5 text-[14px] font-semibold text-white hover:bg-emerald-600"
        >
          Créer mon établissement
        </Link>
      </section>
    </>
  );
}
