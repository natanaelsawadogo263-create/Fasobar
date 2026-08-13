import Link from "next/link";
import { ArrowRight, Calendar, Check, CreditCard, Gift } from "lucide-react";

import {
  formatPriceAmountXof,
  PUBLIC_TRIAL_DURATION_DAYS,
  type PublicPlan,
  yearlySavingsXof,
} from "@/lib/marketing/plan-constants";

type PricingCardsProps = {
  plans: PublicPlan[];
};

export function PricingCards({ plans }: PricingCardsProps) {
  const monthly = plans.find(
    (p) => p.billingPeriod === "MONTHLY" || p.code === "MONTHLY",
  );
  const yearly = plans.find(
    (p) => p.billingPeriod === "YEARLY" || p.durationMonths >= 12,
  );

  const monthlyPrice = monthly?.priceXof ?? 10_000;
  const yearlyPrice = yearly?.priceXof ?? 100_000;
  const savings = yearlySavingsXof(monthlyPrice, yearlyPrice);

  return (
    <div className="grid items-stretch gap-6 lg:grid-cols-3 lg:gap-5">
      <PricingCard
        variant="trial"
        badge="Gratuit"
        icon={Gift}
        title="Essai gratuit"
        price={String(PUBLIC_TRIAL_DURATION_DAYS)}
        priceUnit="jours"
        subtitle="Accès complet à FasoBar"
        features={[
          "Toutes les fonctionnalités",
          "Sans engagement immédiat",
          "Démarrage après création de l’établissement",
        ]}
        cta="Commencer l’essai gratuit"
        href="/inscription/activite"
        buttonStyle="outline-emerald"
      />

      <PricingCard
        variant="yearly"
        badge="Populaire"
        icon={Calendar}
        title="Annuel"
        price={formatPriceAmountXof(yearlyPrice)}
        priceUnit="FCFA / an"
        featured
        features={[
          "Tout le plan mensuel",
          savings > 0
            ? `Économisez ${formatPriceAmountXof(savings)} FCFA`
            : "Meilleur rapport sur 12 mois",
          "Facturation annuelle",
        ]}
        cta="Choisir le plan annuel"
        href="/inscription/activite"
        buttonStyle="solid-amber"
      />

      <PricingCard
        variant="monthly"
        badge="Flexible"
        icon={CreditCard}
        title="Mensuel"
        price={formatPriceAmountXof(monthlyPrice)}
        priceUnit="FCFA / mois"
        features={[
          "Caisse, stock et ventes",
          "Employés et rôles",
          "Renouvellement mensuel",
        ]}
        cta="Choisir le plan mensuel"
        href="/inscription/activite"
        buttonStyle="outline-slate"
      />
    </div>
  );
}

type CardVariant = "trial" | "yearly" | "monthly";

const CARD_THEME: Record<
  CardVariant,
  {
    shell: string;
    badge: string;
    iconWrap: string;
    price: string;
    check: string;
  }
> = {
  trial: {
    shell:
      "border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-white",
    badge: "bg-emerald-600/10 text-emerald-800 ring-1 ring-emerald-600/15",
    iconWrap: "bg-emerald-600 text-white shadow-sm shadow-emerald-900/10",
    price: "text-emerald-800",
    check: "text-emerald-600",
  },
  yearly: {
    shell:
      "border-amber-300/90 bg-gradient-to-b from-amber-50/95 to-white shadow-lg shadow-amber-950/5",
    badge: "bg-amber-500 text-[#07110e] shadow-sm",
    iconWrap: "bg-amber-500 text-[#07110e] shadow-sm shadow-amber-900/15",
    price: "text-amber-800",
    check: "text-amber-700",
  },
  monthly: {
    shell: "border-slate-200 bg-gradient-to-b from-slate-50/80 to-white",
    badge: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    iconWrap: "bg-[#0b1220] text-emerald-300 shadow-sm",
    price: "text-slate-900",
    check: "text-emerald-600",
  },
};

const BUTTON_STYLES = {
  "outline-emerald":
    "border border-emerald-600/25 bg-white text-emerald-800 hover:border-emerald-500 hover:bg-emerald-50",
  "solid-amber":
    "border border-amber-500 bg-amber-500 text-[#07110e] hover:bg-amber-400 hover:border-amber-400 shadow-sm shadow-amber-900/10",
  "outline-slate":
    "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50",
} as const;

function PricingCard({
  variant,
  badge,
  icon: Icon,
  title,
  price,
  priceUnit,
  subtitle,
  features,
  cta,
  href,
  buttonStyle,
  featured = false,
}: {
  variant: CardVariant;
  badge: string;
  icon: typeof Gift;
  title: string;
  price: string;
  priceUnit: string;
  subtitle?: string;
  features: readonly string[];
  cta: string;
  href: string;
  buttonStyle: keyof typeof BUTTON_STYLES;
  featured?: boolean;
}) {
  const theme = CARD_THEME[variant];

  return (
    <article
      className={`relative flex flex-col rounded-2xl border p-5 ${theme.shell}`}
    >
      {featured ? (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${theme.badge}`}
        >
          {badge}
        </span>
      ) : (
        <span
          className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${theme.badge}`}
        >
          {badge}
        </span>
      )}

      <div
        className={`mt-4 inline-flex h-9 w-9 items-center justify-center rounded-xl ${theme.iconWrap}`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </div>

      <h2 className="mt-3 text-[18px] font-semibold tracking-tight text-slate-900">
        {title}
      </h2>

      <div className="mt-3">
        <p
          className={`text-[32px] font-bold leading-none tracking-tight tabular-nums ${theme.price}`}
        >
          {price}
        </p>
        <p className="mt-1 text-[13px] font-medium text-slate-600">{priceUnit}</p>
        {subtitle ? (
          <p className="mt-1 text-[12px] text-slate-500">{subtitle}</p>
        ) : null}
      </div>

      <div className="my-4 h-px bg-slate-200/80" />

      <ul className="flex flex-1 flex-col gap-2">
        {features.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-[13px] leading-snug text-slate-700"
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-slate-200/80">
              <Check className={`h-2.5 w-2.5 ${theme.check}`} strokeWidth={3} />
            </span>
            {item}
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={`mt-5 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition ${BUTTON_STYLES[buttonStyle]}`}
      >
        {cta}
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
      </Link>
    </article>
  );
}
