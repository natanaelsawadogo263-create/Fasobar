import Link from "next/link";

import { PageHero } from "@/components/marketing/page-hero";
import type { SolutionSector } from "@/lib/marketing/solutions";

/**
 * Gabarit commun aux pages Solutions par secteur — structure partagée, mais
 * le contenu (défis, réponses, fonctionnalités) vient entièrement du secteur
 * passé en prop, donc réellement distinct d’une page à l’autre.
 */
export function SolutionSectorPage({ sector }: { sector: SolutionSector }) {
  return (
    <>
      <PageHero kicker="Solutions" title={sector.title} subtitle={sector.intro} />

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Ce que vous vivez au quotidien
          </h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {sector.challenges.map((challenge) => (
              <article
                key={challenge.title}
                className="rounded-2xl border border-slate-200 bg-[#f7f8f6] p-5"
              >
                <h3 className="text-[15px] font-semibold text-slate-900">
                  {challenge.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                  {challenge.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f4f6f4] py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Comment FasoBar répond
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            {sector.solutionIntro}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sector.features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <h3 className="text-[15px] font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                  {feature.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-10 sm:py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-[13px] text-slate-500">
            Voir aussi :{" "}
            <Link
              href="/fonctionnalites"
              className="font-medium text-emerald-700 hover:underline"
            >
              toutes les fonctionnalités
            </Link>
            {", "}
            <Link
              href="/tarifs"
              className="font-medium text-emerald-700 hover:underline"
            >
              les tarifs
            </Link>
            {" ou "}
            <Link
              href="/telecharger"
              className="font-medium text-emerald-700 hover:underline"
            >
              installer l’application
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="bg-emerald-800 py-12 text-white sm:py-14">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Prêt à démarrer ?
            </h2>
            <p className="mt-1 text-[14px] text-emerald-50/80">
              Créez votre établissement en quelques minutes.
            </p>
          </div>
          <Link
            href="/inscription/activite"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-[15px] font-semibold text-emerald-900 transition hover:bg-emerald-50 sm:w-auto"
          >
            Créer mon établissement
          </Link>
        </div>
      </section>
    </>
  );
}
