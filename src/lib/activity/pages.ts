import { getActivityProfile, isRetailActivity } from "@/lib/activity/profile";

export function getActivityPages(activityCode: string | null | undefined) {
  const profile = getActivityProfile(activityCode);
  const retail = profile.kind === "retail";
  const items = profile.productNavLabel.toLowerCase();
  const cashier = profile.cashierSpaceLabel.toLowerCase();

  return {
    retail,
    profile,
    ticketNoun: retail ? "ticket" : "commande",
    ticketNounPlural: retail ? "tickets" : "commandes",
    sales: {
      paidSubtitle: retail ? "nombre de ventes" : "commandes payées",
      paidTitle: retail ? "Nombre de ventes" : "Commandes payées",
      paidShort: retail ? "Ventes" : "Commandes",
      basketSubtitle: retail ? "par vente" : "par commande",
      emptyDetail: retail
        ? "Aucune vente encaissée sur la période. Ajustez les dates ou le vendeur."
        : "Aucune commande payée sur la période. Ajustez les dates ou le caissier.",
      productsTab: profile.productNavLabel,
      cashierTab: retail ? `Par ${cashier}` : "Par caissier·ère",
      cashierFilterAll: retail ? "Tous les vendeurs" : "Tous caissiers",
      cashierColumn: retail ? "Vendeur" : "Caissier·ère",
      orderCountLabel: retail ? "vente" : "commande",
      productColumn: retail ? profile.productNavLabel.replace(/s$/, "") : "Produit",
      listTab: retail ? "Tickets" : "Commandes",
      basketHint: retail
        ? "CA ÷ nombre de ventes payées"
        : "CA ÷ nombre de commandes payées",
    },
    tickets: {
      title: retail ? profile.ticketsNavLabel : "Commandes",
      emptyTitle: retail ? "Aucun ticket" : "Aucune commande",
      emptyDetail: retail
        ? "Ajustez les filtres pour retrouver les ventes de l’établissement."
        : "Ajustez les filtres pour retrouver les commandes de l'établissement.",
      searchPlaceholder: retail
        ? "N°, client, vendeur…"
        : "N°, table, caissière…",
      clientColumn: retail ? "Client" : "Table / Réf.",
      cancelLabel: retail ? "Annuler le ticket" : "Annuler la commande",
      cashierColumn: retail ? "Vendeur" : "Caissière",
      cashierFilterAll: retail ? "Tous les vendeurs" : "Tous caissiers",
    },
    openTickets: {
      title: retail ? "Ventes du jour" : "Commandes du jour",
      emptyTitle: retail ? "Aucune vente du jour" : "Aucune commande du jour",
      emptyDetail: retail
        ? "Les ventes ouvertes, en attente et terminées de la journée apparaîtront ici."
        : "Les commandes ouvertes, en attente et terminées de la journée apparaîtront ici.",
      searchPlaceholder: retail
        ? "Rechercher un ticket, un client…"
        : "Rechercher une commande, table…",
      newButton: retail ? "Nouvelle vente" : "Nouvelle commande",
    },
    cash: {
      subtitle: retail
        ? `${cashier} — ouverture et fermeture de caisse, lecture admin`
        : "supervision lecture seule — ouverture et fermeture réservées aux caissiers",
      orderColumn: retail ? "Ticket" : "Commande",
    },
    session: {
      cashierLabel: retail ? profile.cashierSpaceLabel : "Caissier",
      ticketsLabel: retail ? "Ventes" : "Commandes",
    },
    supply: {
      subtitle: retail
        ? `Livraisons ${profile.catalogDepartmentLabel.toLowerCase()}`
        : "Achats bar/cuisine",
      emptySuppliers: retail
        ? "Ajoutez un fournisseur avant d’enregistrer une entrée."
        : null,
      spaceLabel: profile.catalogDepartmentLabel,
    },
    expenses: {
      kitchenPurchase: retail ? "Achats magasin" : "Achats Cuisine",
      barArea: retail ? profile.catalogDepartmentLabel : "Bar",
      caisseArea: retail ? "Caisse" : "Cuisine",
      allAreas: retail ? "Toutes" : "Cuisine & Bar",
    },
    reports: {
      productsSold: retail ? `${profile.productNavLabel} vendus` : "Produits vendus",
      productsSoldHint: retail
        ? `Quantités et chiffre d’affaires par ${items.slice(0, -1) || "article"} (ventes encaissées).`
        : "Quantités et chiffre d'affaires par produit (ventes payées).",
      stockLabel: `Stock ${profile.stockNavLabel === "Stock" ? profile.catalogDepartmentLabel.toLowerCase() : profile.stockNavLabel.toLowerCase()}`,
      stockHint: `Niveaux de stock actuels — ${profile.catalogDepartmentLabel.toLowerCase()}.`,
      salesHint: retail
        ? "Synthèse du chiffre d’affaires. Détail des ventes inclus à l’export / impression."
        : "Synthèse du chiffre d'affaires. Détail des commandes inclus à l'export / impression.",
      profitHint: "CA, approvisionnements, dépenses et bénéfice net.",
      supplyHint: retail
        ? "Entrées de stock (achats fournisseurs)."
        : "Entrées de stock (achats).",
    },
    pos: {
      productsTab: profile.productNavLabel,
      cartTab: retail ? "Vente" : "Commande",
      savedToast: retail ? "Vente enregistrée." : "Commande enregistrée.",
      sentToast: retail ? "Vente enregistrée." : "Commande envoyée.",
      holdToast: retail
        ? "Ticket mis en attente d’encaissement. Vous pouvez ouvrir une nouvelle vente."
        : "Commande mise en attente d'encaissement. Vous pouvez ouvrir une nouvelle commande.",
      notFound: retail ? "Ticket introuvable." : "Commande introuvable.",
      emptyCart: retail
        ? "Ajoutez au moins un article."
        : "Ajoutez au moins un article à la commande.",
      additionLabel: retail ? "Ticket" : "Addition",
      allProducts: retail
        ? `Tous les ${profile.productNavLabel.toLowerCase()}`
        : "Tous les produits",
      openTicketsTitle: retail ? "Tickets ouverts" : "Commandes ouvertes",
    },
    detail: {
      backLabel: retail ? "Retour aux tickets" : "Retour aux commandes",
      referencePrefix: retail ? "Client" : "Table",
      cancelToast: retail ? "Ticket annulé." : "Commande annulée.",
      productColumn: retail ? profile.productNavLabel.replace(/s$/, "") : "Produit",
    },
  };
}

export { isRetailActivity };
