/**
 * Modèle opérationnel partagé entre Admin, Caisse–Cuisine et Responsable Bar.
 *
 * Source de vérité unique (tables) :
 * - orders (+ bar_status / kitchen_status / payment_status)
 * - payments / receipts
 * - cash_register_sessions
 * - bar_sessions
 * - stock_items / stock_movements
 * - products / categories (catalogue partagé caisse / bar)
 *
 * Chaque espace lit la même donnée, filtrée par son métier.
 * La fraîcheur vient de : revalidatePath cross-espaces + Realtime → router.refresh().
 */

/** Après création / màj produit admin → caisse + bar + stock. */
export const OPS_CATALOG_PATHS = [
  "/application",
  "/application/produits",
  "/application/caisse",
  "/application/cuisine",
  "/application/stock",
  "/application/stock/cuisine",
  "/application/approvisionnements",
  "/application/bar",
  "/application/bar/stock",
  "/application/bar/approvisionnements",
  "/application/bar/commandes",
] as const;


export const OPS_SHARED_PATHS = [
  "/application",
  "/application/tableau-de-bord",
  "/application/ventes",
  "/application/caisses",
  "/application/commandes",
  "/application/commandes-ouvertes",
  "/application/caisse",
  "/application/cuisine",
  "/application/encaissement",
  "/application/recus",
  "/application/bar",
  "/application/bar/commandes",
  "/application/bar/stock",
  "/application/bar/approvisionnements",
  "/application/bar/historique",
  "/application/bar/session",
  "/application/stock",
  "/application/stock/cuisine",
  "/application/approvisionnements",
  "/application/rapports",
] as const;

export const OPS_ORDER_PATHS = [
  "/application",
  "/application/tableau-de-bord",
  "/application/ventes",
  "/application/commandes",
  "/application/commandes-ouvertes",
  "/application/caisse",
  "/application/cuisine",
  "/application/bar",
  "/application/bar/commandes",
] as const;

export const OPS_PAYMENT_PATHS = [
  "/application",
  "/application/tableau-de-bord",
  "/application/ventes",
  "/application/caisses",
  "/application/commandes",
  "/application/commandes-ouvertes",
  "/application/caisse",
  "/application/caisse/session",
  "/application/encaissement",
  "/application/recus",
  "/application/bar",
  "/application/bar/commandes",
  "/application/rapports",
] as const;

export const OPS_STOCK_PATHS = [
  "/application",
  "/application/tableau-de-bord",
  "/application/stock",
  "/application/stock/cuisine",
  "/application/approvisionnements",
  "/application/inventaires",
  "/application/bar",
  "/application/bar/stock",
  "/application/bar/approvisionnements",
  "/application/bar/historique",
  "/application/bar/session",
  "/application/sessions-bar",
  "/application/rapports",
] as const;

export const OPS_BAR_SESSION_PATHS = [
  "/application",
  "/application/tableau-de-bord",
  "/application/bar",
  "/application/bar/commandes",
  "/application/bar/stock",
  "/application/bar/approvisionnements",
  "/application/bar/historique",
  "/application/bar/session",
  "/application/sessions-bar",
] as const;

export const OPS_CASH_SESSION_PATHS = [
  "/application",
  "/application/tableau-de-bord",
  "/application/caisses",
  "/application/caisse",
  "/application/caisse/session",
  "/application/rapports",
] as const;
