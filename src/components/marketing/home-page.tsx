import Link from "next/link";
import {
  ChevronDown,
  History,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Tags,
  Users,
} from "lucide-react";

import { DemoVideoSection } from "@/components/marketing/demo-video-section";
import { MarketingVideoBanner } from "@/components/marketing/marketing-video-banner";
import { MARKETING_FAQ } from "@/lib/marketing/faq";
import { MARKETING_FEATURES } from "@/lib/marketing/features";

const FEATURE_ICONS = [
  ShoppingCart,
  Package,
  Tags,
  Users,
  LayoutDashboard,
  History,
] as const;

const STEPS = [
  {
    n: "1",
    title: "Créez votre établissement",
    body: "Choisissez votre activité, donnez un nom, et c’est parti.",
  },
  {
    n: "2",
    title: "Ajoutez produits et équipe",
    body: "Catalogue, prix, stock, et un accès par employé.",
  },
  {
    n: "3",
    title: "Encaissez et imprimez",
    body: "Caisse tactile, clavier, souris, tickets, reçus thermiques, stock.",
  },
] as const;

const TRUST = [
  "Caisse tactile",
  "Clavier et souris",
  "Imprimante thermique",
  "Tickets et reçus",
] as const;

export function MarketingHomePage() {
  return (
    <>
      <MarketingVideoBanner />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 py-4 sm:gap-3 sm:px-6 sm:py-5">
          {TRUST.map((item) => (
            <span
              key={item}
              className="inline-flex min-h-9 items-center rounded-full border border-slate-200 bg-[#f7f8f6] px-3 text-[12px] font-medium text-slate-700 sm:text-[13px]"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      <section
        id="fonctionnalites"
        className="scroll-mt-20 bg-[#f4f6f4] py-14 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Ce que vous pilotez.
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-600">
            L’essentiel du quotidien, sans pages inutiles.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MARKETING_FEATURES.map((feature, index) => {
              const Icon = FEATURE_ICONS[index];
              return (
                <article
                  key={feature.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <h3 className="mt-3 text-[15px] font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                    {feature.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            En trois étapes.
          </h2>
          <ol className="mt-8 grid gap-3 md:grid-cols-3">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="rounded-2xl border border-slate-200 bg-[#f7f8f6] p-5"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-[13px] font-bold text-white">
                  {step.n}
                </span>
                <p className="mt-3 text-[15px] font-semibold text-slate-900">
                  {step.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="faq" className="scroll-mt-20 bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Questions fréquentes
          </h2>
          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
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

      <DemoVideoSection />
    </>
  );
}
