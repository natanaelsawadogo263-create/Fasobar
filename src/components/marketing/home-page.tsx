import Link from "next/link";
import { ArrowRight, Monitor, ShieldCheck, Workflow } from "lucide-react";

import { ProductPreview } from "@/components/marketing/product-preview";
import { MARKETING_ACTIVITIES } from "@/lib/marketing/config";
import { MARKETING_FAQ_HOME } from "@/lib/marketing/faq";
import { MARKETING_FEATURES } from "@/lib/marketing/features";

const STEPS = [
  { n: "1", title: "Créez votre établissement" },
  { n: "2", title: "Ajoutez produits, stock et employés" },
  { n: "3", title: "Installez FasoBar sur vos postes Windows" },
  { n: "4", title: "Suivez l’activité depuis l’espace Admin" },
] as const;

export function MarketingHomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#07110e] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.08),transparent_40%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="fb-marketing-fade">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              FasoBar
            </p>
            <h1 className="mt-4 max-w-xl text-[34px] font-semibold leading-[1.12] tracking-tight sm:text-5xl">
              Gestion des stocks et des ventes.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-emerald-50/80 sm:text-base">
              Un logiciel pour toute activité qui a besoin de suivre son stock,
              ses ventes et sa caisse.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/inscription"
                className="inline-flex h-11 items-center rounded-xl bg-emerald-500 px-5 text-[14px] font-semibold text-white transition hover:bg-emerald-400"
              >
                Créer mon établissement
              </Link>
              <Link
                href="/telecharger"
                className="inline-flex h-11 items-center rounded-xl border border-white/15 bg-white/5 px-5 text-[14px] font-semibold text-white transition hover:bg-white/10"
              >
                Télécharger FasoBar
              </Link>
            </div>
            <p className="mt-4 text-[13px] text-emerald-100/70">
              Déjà client ?{" "}
              <Link href="/connexion" className="font-semibold text-amber-300 hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Pour toute activité à gérer.
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
          Boutique, magasin, pharmacie, quincaillerie, restaurant ou autre
          commerce : FasoBar sert dès qu’il y a du stock et des ventes à suivre.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          {MARKETING_ACTIVITIES.map((item) => (
            <Link
              key={item.id}
              href={`/solutions#${item.id}`}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-800 transition hover:border-emerald-300 hover:text-emerald-800"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-emerald-900/10 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Ce que vous pilotez.
            </h2>
            <Link
              href="/fonctionnalites"
              className="hidden items-center gap-1 text-[13px] font-semibold text-emerald-800 sm:inline-flex"
            >
              Toutes les fonctionnalités <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MARKETING_FEATURES.slice(0, 6).map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-[#f7f8f6] p-5"
              >
                <p className="text-[15px] font-semibold text-slate-900">
                  {feature.title}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/fonctionnalites"
            className="mt-6 inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-800 sm:hidden"
          >
            Toutes les fonctionnalités <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Mise en route.
        </h2>
        <ol className="mt-8 grid gap-3 md:grid-cols-2">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[13px] font-bold text-white">
                {step.n}
              </span>
              <span className="text-[15px] font-medium text-slate-900">
                {step.title}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-[#0b1220] text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <Monitor className="h-6 w-6 text-amber-300" />
            <h3 className="mt-4 text-xl font-semibold">FasoBar Desktop</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-300">
              Pour les postes de travail Windows de l’établissement.
            </p>
            <Link
              href="/telecharger"
              className="mt-5 inline-flex text-[13px] font-semibold text-amber-300 hover:underline"
            >
              Télécharger
            </Link>
          </div>
          <div>
            <Workflow className="h-6 w-6 text-emerald-300" />
            <h3 className="mt-4 text-xl font-semibold">Espace Admin</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-300">
              Pour suivre et administrer l’activité depuis un navigateur.
            </p>
            <Link
              href="/connexion"
              className="mt-5 inline-flex text-[13px] font-semibold text-emerald-300 hover:underline"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="flex items-start gap-4">
          <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-emerald-700" />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Comptes, rôles et traçabilité.
            </h2>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-slate-600">
              Chaque utilisateur a son accès. Les opérations sont historisées.
              Les données de l’établissement restent centralisées.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Questions fréquentes
            </h2>
            <Link
              href="/faq"
              className="text-[13px] font-semibold text-emerald-800 hover:underline"
            >
              Voir tout
            </Link>
          </div>
          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            {MARKETING_FAQ_HOME.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="cursor-pointer list-none text-[15px] font-semibold text-slate-900">
                  {item.question}
                </summary>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-emerald-800 py-14 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            Commencez avec FasoBar.
          </h2>
          <Link
            href="/inscription"
            className="inline-flex h-11 items-center rounded-xl bg-white px-5 text-[14px] font-semibold text-emerald-900 transition hover:bg-emerald-50"
          >
            Créer mon établissement
          </Link>
        </div>
      </section>
    </>
  );
}
