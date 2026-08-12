import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/marketing/page-hero";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { PUBLIC_TRIAL_DURATION_DAYS } from "@/lib/marketing/plan-constants";
import { getPublicSubscriptionPlans } from "@/lib/marketing/plans";

export const metadata: Metadata = {
  title: "Tarifs — FasoBar",
  description: `Tarifs FasoBar : essai gratuit ${PUBLIC_TRIAL_DURATION_DAYS} jours, abonnement mensuel et annuel.`,
};

export default async function TarifsPage() {
  const plans = await getPublicSubscriptionPlans();

  return (
    <>
      <PageHero
        kicker="Tarifs"
        title="Simple et transparent."
        subtitle="Essai gratuit, puis choisissez l’offre qui convient à votre établissement."
      />
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pb-20 lg:pt-12">
        <PricingCards plans={plans} />
        <p className="mt-10 text-center text-[13px] text-slate-500">
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
