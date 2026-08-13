import type { Metadata } from "next";

import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Politique de confidentialité — FasoBar",
};

export default function ConfidentialitePage() {
  return (
    <>
      <PageHero kicker="Légal" title="Politique de confidentialité" />
      <section className="mx-auto max-w-3xl space-y-4 px-4 py-14 text-[14px] leading-relaxed text-slate-600 sm:px-6">
        <p>
          FasoBar traite les informations nécessaires au fonctionnement du
          service : compte propriétaire, employés, établissement, ventes, stock
          et abonnement.
        </p>
        <p>
          Ces données servent à authentifier les utilisateurs, tracer les
          opérations et fournir le service FasoBar.
        </p>
        <p>
          Nous ne vendons pas vos données à des partenaires marketing.
        </p>
      </section>
    </>
  );
}
