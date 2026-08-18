import { isRetailActivity } from "@/lib/activity/profile";
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
  const retail = isRetailActivity(activityCode);

  return REPORT_TYPE_OPTIONS.filter((option) => {
    if (option.id === "stock_boissons") {
      return !retail && hasBarService(scope);
    }
    return true;
  }).map((option) => {
    if (option.id === "benefices") {
      if (retail) {
        return {
          ...option,
          description: "CA, approvisionnements, dépenses et bénéfice net du magasin.",
        };
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
    if (option.id === "approvisionnements") {
      if (retail) {
        return { ...option, description: "Entrées de stock (achats) du magasin." };
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
  const labels: Record<string, string> = {
    CASH_SESSION_OPENED: "Caisse ouverte",
    CASH_SESSION_CLOSED: "Caisse fermée",
    PAYMENT_RECORDED: "Paiement enregistré",
    PAYMENT_VOIDED: "Paiement annulé",
    RECEIPT_ISSUED: "Reçu émis",
    EXPENSE_CREATED: "Dépense créée",
    EXPENSE_UPDATED: "Dépense modifiée",
    EXPENSE_CANCELLED: "Dépense annulée",
    ORDER_CREATED: "Commande créée",
    ORDER_UPDATED: "Commande mise à jour",
    ORDER_CANCELLED: "Commande annulée",
    BAR_SESSION_OPENED: "Session bar ouverte",
    BAR_SESSION_CLOSED: "Session bar fermée",
    STOCK_ENTRY_RECORDED: "Entrée de stock",
    STOCK_LOSS_RECORDED: "Perte de stock",
    STOCK_ADJUSTMENT_RECORDED: "Ajustement de stock",
    INVENTORY_COMPLETED: "Inventaire clôturé",
    PACKAGING_UPSERTED: "Conditionnement enregistré",
    SETTINGS_UPDATED: "Paramètres mis à jour",
    EMPLOYEE_ACCOUNT_CREATED: "Compte employé créé",
    EMPLOYEE_MEMBERSHIPS_CREATED: "Accès employé créé",
    TEMPORARY_PASSWORD_RESET: "Mot de passe temporaire réinitialisé",
    PERSONAL_PASSWORD_CREATED: "Mot de passe personnel créé",
    EMPLOYEE_CREATION_COMPENSATED: "Création employé compensée",
    USER_DEACTIVATED: "Compte désactivé",
    USER_REACTIVATED: "Compte réactivé",
    PRODUCT_CREATED: "Produit créé",
    PRODUCT_UPDATED: "Produit modifié",
    PRODUCT_ACTIVATED: "Produit activé",
    PRODUCT_DEACTIVATED: "Produit désactivé",
  };

  return labels[action] ?? action.replaceAll("_", " ").toLowerCase();
}

export function humanizeEntityType(entityType: string | null, action?: string): string {
  if (action?.startsWith("CASH_SESSION")) return "Caisse";
  if (action?.startsWith("BAR_SESSION")) return "Session bar";
  if (action?.startsWith("EXPENSE")) return "Dépense";
  if (action?.startsWith("ORDER")) return "Commande";
  if (action?.startsWith("PAYMENT") || action === "RECEIPT_ISSUED") return "Paiement";
  if (action?.startsWith("STOCK") || action === "INVENTORY_COMPLETED") return "Stock";
  if (action?.startsWith("EMPLOYEE") || action?.startsWith("USER") || action?.includes("PASSWORD")) {
    return "Utilisateur";
  }

  const labels: Record<string, string> = {
    payment: "Paiement",
    expense: "Dépense",
    order: "Commande",
    stock_item: "Stock",
    stock: "Stock",
    product: "Produit",
    product_packaging: "Conditionnement",
    establishment: "Établissement",
    supplier: "Fournisseur",
    membership: "Utilisateur",
    cash_session: "Caisse",
    bar_session: "Session bar",
  };

  if (!entityType) return "—";
  return labels[entityType] ?? entityType;
}
