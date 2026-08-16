export type PublicPlan = {
  code: string;
  name: string;
  description: string | null;
  billingPeriod: string;
  durationMonths: number;
  priceXof: number;
};

/** Durée essai gratuit (migration platform_settings, défaut 7 jours). */
export const PUBLIC_TRIAL_DURATION_DAYS = 7;

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

/** Kit matériel (caisse, clavier, souris, imprimante) + abonnement annuel. */
export const KIT_PLUS_YEARLY_XOF = 350_000;

export function formatPriceAmountXof(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function yearlySavingsXof(monthlyPrice: number, yearlyPrice: number): number {
  return Math.max(0, monthlyPrice * 12 - yearlyPrice);
}
