import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageHero } from "@/components/marketing/page-hero";
import { SOLUTION_SECTORS } from "@/lib/marketing/solutions";
import { buildPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = buildPageMetadata({
  path: "/solutions",
  title: "Solutions par secteur",
  description:
    "FasoBar adapté à votre commerce : alimentation, quincaillerie, station-service, restaurant/bar/maquis et commerce général.",
});

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        kicker="Solutions"
        title="FasoBar, adapté à votre type de commerce"
        subtitle="Le socle est le même — caisse, stock, produits, approvisionnements, équipe et rapports — mais chaque secteur a ses propres habitudes. Choisissez le vôtre."
      />

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {SOLUTION_SECTORS.map((sector) => (
              <Link
                key={sector.slug}
                href={`/solutions/${sector.slug}`}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-[#f7f8f6] p-5 transition hover:border-emerald-400 hover:bg-white"
              >
                <h2 className="text-[17px] font-semibold text-slate-900">
                  {sector.navLabel}
                </h2>
                <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-slate-600">
                  {sector.summary}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
                  Découvrir
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
