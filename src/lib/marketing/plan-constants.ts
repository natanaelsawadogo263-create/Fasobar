export type PublicPlan = {
  code: string;
  name: string;
  description: string | null;
  billingPeriod: string;
  durationMonths: number;
  priceXof: number;
};

/** Offres seed FasoBar (migration plateforme) — fallback si lecture cloud indisponible. */
export const FALLBACK_PUBLIC_PLANS: PublicPlan[] = [
  {
    code: "MONTHLY",
    name: "Mensuel",
    description: "Abonnement FasoBar — 1 mois",
    billingPeriod: "MONTHLY",
    durationMonths: 1,
    priceXof: 10_000,
  },
  {
    code: "YEARLY",
    name: "Annuel",
    description: "Abonnement FasoBar — 12 mois",
    billingPeriod: "YEARLY",
    durationMonths: 12,
    priceXof: 100_000,
  },
];
