import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/marketing/page-hero";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { PUBLIC_TRIAL_DURATION_DAYS } from "@/lib/marketing/plan-constants";
import { getPublicSubscriptionPlans } from "@/lib/marketing/plans";
import { buildPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = buildPageMetadata({
  path: "/tarifs",
  title: "Tarifs",
  description: `Tarifs FasoBar : essai gratuit ${PUBLIC_TRIAL_DURATION_DAYS} jours, puis abonnement mensuel ou annuel. Caisse, stock et gestion commerciale pour tout établissement.`,
});

export default async function TarifsPage() {
  const plans = await getPublicSubscriptionPlans();

  return (
    <>
      <PageHero
        kicker="Tarifs"
        title="Simple, en francs CFA."
        subtitle={`Essai ${PUBLIC_TRIAL_DURATION_DAYS} jours. Logiciel : 10 000 F/mois ou 100 000 F/an. Kit + abonnement : 350 000 F.`}
      />
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pb-20 lg:pt-12">
        <PricingCards plans={plans} />
        <p className="mt-10 text-center text-[13px] text-slate-500">
          Une question ?{" "}
          <Link
            href="/contact"
            className="font-semibold text-emerald-800 hover:underline"
          >
            Contactez-nous
          </Link>
          {" · "}
          Déjà client ?{" "}
          <Link
            href="/connexion"
            className="font-semibold text-emerald-800 hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </section>
    </>
  );
}
