import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

import { JsonLd } from "@/components/marketing/json-ld";
import { PageHero } from "@/components/marketing/page-hero";
import { SOLUTION_SECTORS } from "@/lib/marketing/solutions";
import { buildPageMetadata, SITE_URL } from "@/lib/marketing/seo";

// Page pilier dédiée au mot-clé « application de gestion de stock au Burkina
// Faso » — contenu propre (pas un doublon des pages Solutions/Fonctionnalités),
// mais qui pointe vers elles pour le maillage interne. Ne décrit que des
// fonctionnalités réellement présentes dans FasoBar.

export const metadata: Metadata = buildPageMetadata({
  path: "/gestion-de-stock-burkina-faso",
  title: "Application de gestion de stock au Burkina Faso",
  description:
    "FasoBar est l’application de gestion de stock pour les commerces du Burkina Faso : quantités en temps réel, seuils d’alerte, approvisionnements et rapports.",
});

const PAIN_POINTS = [
  {
    title: "Le cahier de stock, tenu à la main",
    body: "Des quantités notées sur papier ou dans un tableur, jamais vraiment à jour, difficiles à croiser avec les ventes du jour.",
  },
  {
    title: "Une rupture découverte au comptoir",
    body: "Un produit qui manque, appris seulement quand un client le demande — la vente est perdue, parfois le client aussi.",
  },
  {
    title: "Un écart entre stock théorique et stock réel",
    body: "Sans mouvements tracés (ventes, réceptions, pertes), impossible de savoir d’où vient l’écart constaté à l’inventaire.",
  },
  {
    title: "Une visibilité qui s’arrête à la boutique",
    body: "Le gérant ou le propriétaire ne voit l’état du stock qu’en se déplaçant sur place, jamais à distance.",
  },
] as const;

const STOCK_FEATURES = [
  {
    title: "Stock en temps réel",
    body: "Chaque vente et chaque réception met à jour la quantité disponible immédiatement — pas de ressaisie, pas de décalage.",
  },
  {
    title: "Seuils d’alerte",
    body: "Un seuil par produit pour repérer une rupture qui approche avant qu’elle n’arrive au comptoir.",
  },
  {
    title: "Vente à l’unité ou au conditionnement",
    body: "Une même référence peut se vendre à la pièce, au carton ou au lot, avec un stock qui reste cohérent des deux côtés.",
  },
  {
    title: "Approvisionnements fournisseurs",
    body: "Chaque réception enregistrée met à jour le stock et le coût d’achat automatiquement, sans double saisie.",
  },
  {
    title: "Caisse liée au stock",
    body: "La caisse et le stock partagent les mêmes données : une vente encaissée déduit le stock au même instant.",
  },
  {
    title: "Rapports et historique",
    body: "Chaque mouvement de stock est tracé — retrouvez une vente, une perte ou une réception à tout moment.",
  },
] as const;

const STOCK_FAQ = [
  {
    question: "Comment gérer le stock d’un commerce au Burkina Faso avec FasoBar ?",
    answer:
      "En saisissant votre catalogue produits une fois, puis en laissant FasoBar mettre à jour les quantités à chaque vente et chaque réception fournisseur. Un seuil d’alerte par produit signale une rupture avant qu’elle n’arrive au comptoir.",
  },
  {
    question: "FasoBar gère-t-il la vente à l’unité et au conditionnement ?",
    answer:
      "Oui. Une même référence peut être vendue à la pièce, au carton ou au lot selon le produit, avec un prix propre à chaque mode de vente et un stock qui reste cohérent des deux côtés.",
  },
  {
    question: "Combien coûte l’application de gestion de stock FasoBar ?",
    answer:
      "Après un essai gratuit de 7 jours, l’abonnement est de 10 000 FCFA par mois ou 100 000 FCFA par an. Un kit complet (caisse, clavier, souris, imprimante, installation et suivi) avec abonnement annuel est proposé à 350 000 FCFA.",
  },
  {
    question: "FasoBar convient-il à mon type de commerce ?",
    answer:
      "FasoBar est utilisé par des boutiques d’alimentation, quincailleries, stations-service, restaurants, maquis, bars et commerces généraux au Burkina Faso — chacun avec ses propres habitudes de stock, sur le même socle.",
  },
] as const;

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: STOCK_FAQ.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function GestionDeStockPage() {
  return (
    <>
      <JsonLd data={FAQ_JSON_LD} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
            {
              "@type": "ListItem",
              position: 2,
              name: "Application de gestion de stock au Burkina Faso",
              item: `${SITE_URL}/gestion-de-stock-burkina-faso`,
            },
          ],
        }}
      />

      <PageHero
        kicker="Gestion de stock"
        title="Application de gestion de stock au Burkina Faso"
        subtitle="Quantités à jour, seuils d’alerte et approvisionnements suivis — un logiciel de gestion de stock pensé pour les commerçants d’Ouagadougou, Bobo-Dioulasso et de tout le Burkina Faso."
      />

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Le stock, un problème quotidien pour beaucoup de commerçants
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Cahier papier, tableur, ou simplement la mémoire du gérant : sans
            outil dédié, le stock finit toujours par s’écarter de la réalité.
            FasoBar remplace cette gestion manuelle par un suivi automatique,
            à jour à chaque vente.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {PAIN_POINTS.map((point) => (
              <article
                key={point.title}
                className="rounded-2xl border border-slate-200 bg-[#f7f8f6] p-5"
              >
                <h3 className="text-[15px] font-semibold text-slate-900">
                  {point.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                  {point.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f4f6f4] py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Ce que l’application FasoBar apporte à votre stock
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Une gestion de stock qui suit vraiment ce qui se passe en caisse
            et à la réception des marchandises — sans ressaisie.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STOCK_FEATURES.map((feature) => (
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

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Une gestion de stock adaptée à votre secteur
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Le socle est le même partout, mais chaque secteur a ses propres
            habitudes de stock.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {SOLUTION_SECTORS.map((sector) => (
              <Link
                key={sector.slug}
                href={`/solutions/${sector.slug}`}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-[#f7f8f6] p-5 transition hover:border-emerald-400 hover:bg-white"
              >
                <h3 className="text-[15px] font-semibold text-slate-900">
                  {sector.navLabel}
                </h3>
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

      <section className="bg-[#f4f6f4] py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Questions fréquentes sur la gestion de stock
          </h2>
          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            {STOCK_FAQ.map((item) => (
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
              Prêt à reprendre le contrôle de votre stock ?
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
