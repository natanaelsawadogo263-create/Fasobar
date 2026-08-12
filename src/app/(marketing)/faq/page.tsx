import type { Metadata } from "next";

import { PageHero } from "@/components/marketing/page-hero";
import { MARKETING_FAQ } from "@/lib/marketing/faq";

export const metadata: Metadata = {
  title: "FAQ — FasoBar",
  description: "Questions fréquentes sur FasoBar.",
};

export default function FaqPage() {
  return (
    <>
      <PageHero
        kicker="FAQ"
        title="Questions fréquentes."
        subtitle="Stock, ventes, inscription et abonnement."
      />
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {MARKETING_FAQ.map((item) => (
            <details key={item.question} className="py-4">
              <summary className="cursor-pointer list-none text-[15px] font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
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
