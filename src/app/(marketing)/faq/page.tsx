import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";

import { JsonLd } from "@/components/marketing/json-ld";
import { PageHero } from "@/components/marketing/page-hero";
import { MARKETING_FAQ } from "@/lib/marketing/faq";
import { buildPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = buildPageMetadata({
  path: "/faq",
  title: "Questions fréquentes",
  description:
    "Les réponses aux questions les plus fréquentes sur FasoBar : fonctionnement, équipe, tarifs et contact.",
});

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: MARKETING_FAQ.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function FaqPage() {
  return (
    <>
      <JsonLd data={FAQ_JSON_LD} />
      <PageHero
        kicker="FAQ"
        title="Questions fréquentes"
        subtitle="Tout ce qu’on nous demande le plus souvent sur FasoBar."
      />

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {MARKETING_FAQ.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
                </summary>
                <p className="mt-2 pr-8 text-[14px] leading-relaxed text-slate-600">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
