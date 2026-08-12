import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/marketing/page-hero";
import { formatPriceXof } from "@/lib/products/constants";
import { getPublicSubscriptionPlans } from "@/lib/marketing/plans";

export const metadata: Metadata = {
  title: "Tarifs — FasoBar",
  description: "Offres d’abonnement FasoBar : mensuel et annuel.",
};

export default async function TarifsPage() {
  const plans = await getPublicSubscriptionPlans();

  return (
    <>
      <PageHero
        kicker="Tarifs"
        title="Deux offres, un seul FasoBar."
        subtitle="Mensuel ou annuel. L’abonnement se gère après la création de votre établissement."
      />
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2">
          {plans.map((plan) => {
            const yearly = plan.billingPeriod === "YEARLY" || plan.durationMonths >= 12;
            return (
              <article
                key={plan.code}
                className={`rounded-2xl border bg-white p-6 shadow-sm sm:p-8 ${
                  yearly
                    ? "border-amber-300 ring-1 ring-amber-200"
                    : "border-slate-200"
                }`}
              >
                {yearly ? (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                    Recommandé
                  </p>
                ) : null}
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                  {plan.name}
                </h2>
                <p className="mt-2 text-[14px] text-slate-500">
                  {plan.description ??
                    (yearly ? "12 mois d’accès FasoBar" : "1 mois d’accès FasoBar")}
                </p>
                <p className="mt-6 text-4xl font-semibold tracking-tight text-slate-900">
                  {formatPriceXof(plan.priceXof)}
                </p>
                <p className="mt-1 text-[13px] text-slate-500">
                  {yearly ? "par an" : "par mois"} · FCFA
                </p>
                <ul className="mt-6 space-y-2 text-[14px] text-slate-600">
                  <li>Espace Admin Web</li>
                  <li>FasoBar Desktop</li>
                  <li>Employés et rôles</li>
                  <li>Ventes, caisse et stock</li>
                </ul>
                <Link
                  href="/inscription"
                  className={`mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl text-[14px] font-semibold ${
                    yearly
                      ? "bg-emerald-700 text-white hover:bg-emerald-600"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  }`}
                >
                  Choisir {plan.name.toLowerCase()}
                </Link>
              </article>
            );
          })}
        </div>
        <p className="mt-8 text-[13px] text-slate-500">
          Déjà client ?{" "}
          <Link href="/connexion" className="font-semibold text-emerald-800 hover:underline">
            Se connecter
          </Link>{" "}
          pour gérer votre abonnement dans FasoBar.
        </p>
      </section>
    </>
  );
}
