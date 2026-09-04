import type { Metadata } from "next";
import Link from "next/link";
import {
  History,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Tags,
  Truck,
  Users,
} from "lucide-react";

import { PageHero } from "@/components/marketing/page-hero";
import { buildPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = buildPageMetadata({
  path: "/fonctionnalites",
  title: "Fonctionnalités de gestion de stock et de caisse",
  description:
    "Gestion de stock, caisse, produits, approvisionnements, équipe et rapports : ce que l’application FasoBar gère réellement pour votre commerce au Burkina Faso.",
});

const FEATURES = [
  {
    icon: ShoppingCart,
    title: "Caisse et ventes",
    body: "Caisse tactile, adaptée au clavier et à la souris. Encaissez, imprimez le ticket ou le reçu, clôturez la session de caisse en fin de journée.",
  },
  {
    icon: Package,
    title: "Gestion de stock",
    body: "Quantités, seuils d’alerte et ruptures, visibles en temps réel. Le stock se met à jour à chaque vente et à chaque réception.",
  },
  {
    icon: Tags,
    title: "Produits et prix",
    body: "Catalogue organisé par catégories, avec vente à l’unité ou au conditionnement selon le produit. Recherche rapide et code-barres.",
  },
  {
    icon: Truck,
    title: "Approvisionnements",
    body: "Enregistrez vos réceptions fournisseurs : le stock et le coût d’achat se mettent à jour automatiquement.",
  },
  {
    icon: Users,
    title: "Équipe et rôles",
    body: "Un compte par personne, avec un accès adapté à son rôle (caisse, stock, gestion) et à votre type d’établissement.",
  },
  {
    icon: LayoutDashboard,
    title: "Tableau de bord",
    body: "Ventes, caisse et alertes stock, d’un seul coup d’œil, dès l’ouverture de l’espace de gestion.",
  },
  {
    icon: History,
    title: "Historique et rapports",
    body: "Chaque opération est tracée. Retrouvez les ventes, les mouvements de stock et le bénéfice sur la période de votre choix.",
  },
] as const;

export default function FonctionnalitesPage() {
  return (
    <>
      <PageHero
        kicker="Fonctionnalités"
        title="La gestion de stock et de caisse pour votre commerce"
        subtitle="Un seul outil pour la gestion de stock, la caisse, les produits et l’équipe — sans pages inutiles. Chaque fonctionnalité listée ici est réellement présente dans FasoBar."
      />

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-[#f7f8f6] p-5"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                  <feature.icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <h2 className="mt-3 text-[15px] font-semibold text-slate-900">
                  {feature.title}
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                  {feature.body}
                </p>
              </article>
            ))}
          </div>

          <p className="mt-10 text-[13px] text-slate-500">
            Tout savoir sur la{" "}
            <Link
              href="/gestion-de-stock-burkina-faso"
              className="font-medium text-emerald-700 hover:underline"
            >
              gestion de stock avec FasoBar
            </Link>
            , ou votre activité a ses propres habitudes ?{" "}
            <Link
              href="/solutions"
              className="font-medium text-emerald-700 hover:underline"
            >
              Voir FasoBar par secteur
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
