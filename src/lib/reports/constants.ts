import { getActivityPages } from "@/lib/activity/pages";
import type { ReportType } from "@/lib/reports/schemas";
import type { ReportColumnFormat } from "@/lib/reports/types";
import {
  hasBarService,
  hasKitchenService,
  type ServiceScope,
} from "@/lib/settings/service-scope";

export const REPORT_TYPE_OPTIONS: Array<{
  id: ReportType;
  label: string;
  description: string;
}> = [
  {
    id: "ventes",
    label: "Ventes",
    description:
      "Synthèse du chiffre d'affaires. Détail des commandes inclus à l'export / impression.",
  },
  {
    id: "produits_vendus",
    label: "Produits vendus",
    description: "Quantités et chiffre d'affaires par produit (ventes payées).",
  },
  {
    id: "benefices",
    label: "Bénéfices",
    description: "CA, approvisionnements, dépenses et bénéfice net.",
  },
  {
    id: "stock_boissons",
    label: "Stock boissons",
    description: "Niveaux de stock actuels du département Bar.",
  },
  {
    id: "approvisionnements",
    label: "Approvisionnements",
    description: "Entrées de stock (achats).",
  },
  {
    id: "pertes_casse",
    label: "Pertes / casse",
    description: "Pertes, casse, consommation personnel et articles offerts.",
  },
  {
    id: "depenses",
    label: "Dépenses",
    description: "Toutes les dépenses enregistrées.",
  },
  {
    id: "sessions_caisse",
    label: "Sessions caisse",
    description: "Historique des sessions de caisse ouvertes / fermées.",
  },
  {
    id: "ecarts_caisse",
    label: "Écarts caisse",
    description: "Sessions fermées présentant un écart de caisse non nul.",
  },
  {
    id: "activite_utilisateurs",
    label: "Activité utilisateurs",
    description: "Journal d'audit des actions de gestion de l'établissement.",
  },
];

export function reportOptionsForScope(
  scope: ServiceScope,
  activityCode?: string | null,
) {
  const pages = getActivityPages(activityCode);
  return REPORT_TYPE_OPTIONS.filter((option) => {
    if (option.id === "stock_boissons") return hasBarService(scope);
    return true;
  }).map((option) => {
    if (option.id === "ventes") {
      return { ...option, description: pages.reports.salesHint };
    }
    if (option.id === "produits_vendus") {
      return {
        ...option,
        label: pages.reports.productsSold,
        description: pages.reports.productsSoldHint,
      };
    }
    if (option.id === "benefices") {
      if (pages.retail) {
        return { ...option, description: pages.reports.profitHint };
      }
      if (scope === "BAR") {
        return {
          ...option,
          description: "Vue Boissons : CA, approvisionnements, dépenses et bénéfice net.",
        };
      }
      if (scope === "KITCHEN") {
        return {
          ...option,
          description:
            "Vue Nourriture : CA, approvisionnements, dépenses et bénéfice net.",
        };
      }
      return {
        ...option,
        description:
          "Vue Bar / Cuisine : CA, approvisionnements, dépenses et bénéfice net.",
      };
    }
    if (option.id === "stock_boissons") {
      return {
        ...option,
        label: pages.reports.stockLabel,
        description: pages.reports.stockHint,
      };
    }
    if (option.id === "approvisionnements") {
      if (pages.retail) {
        return { ...option, description: pages.reports.supplyHint };
      }
      if (scope === "BAR") {
        return { ...option, description: "Entrées de stock (achats) boissons." };
      }
      if (scope === "KITCHEN") {
        return { ...option, description: "Entrées de stock (achats) nourriture." };
      }
      return {
        ...option,
        description: "Entrées de stock (achats) Bar et Cuisine.",
      };
    }
    return option;
  });
}

export function defaultReportTypeForScope(_scope: ServiceScope): ReportType {
  return "ventes";
}

export function formatReportCell(
  value: string | number | null,
  format?: ReportColumnFormat,
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (format === "currency" && typeof value === "number") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (format === "number" && typeof value === "number") {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(value);
  }

  if ((format === "date" || format === "datetime") && typeof value === "string") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return format === "date"
      ? date.toLocaleDateString("fr-FR")
      : date.toLocaleString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  }

  return String(value);
}

export function humanizeActionCode(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
