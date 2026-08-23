import type { Metadata } from "next";

import { PageHero } from "@/components/marketing/page-hero";
import { buildPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = buildPageMetadata({
  path: "/conditions-utilisation",
  title: "Conditions d’utilisation",
  description:
    "Conditions d’utilisation de FasoBar : compte, rôles, responsabilités et accès au service selon l’essai ou l’abonnement.",
});

export default function ConditionsPage() {
  return (
    <>
      <PageHero kicker="Légal" title="Conditions d’utilisation" />
      <section className="mx-auto max-w-3xl space-y-4 px-4 py-14 text-[14px] leading-relaxed text-slate-600 sm:px-6">
        <p>
          En créant un compte FasoBar, vous acceptez d’utiliser le service pour
          la gestion de votre établissement, dans le respect des lois applicables.
        </p>
        <p>
          Le propriétaire est responsable des comptes employés créés, des rôles
          attribués et des opérations enregistrées dans l’établissement.
        </p>
        <p>
          L’accès au produit dépend de l’état de l’essai ou de l’abonnement
          FasoBar. Le détail des offres est disponible sur la page Tarifs et
          dans l’espace abonnement après inscription.
        </p>
      </section>
    </>
  );
}
