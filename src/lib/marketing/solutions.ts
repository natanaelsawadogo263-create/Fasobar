/**
 * Registre des pages Solutions — une seule source de vérité utilisée par la
 * page hub /solutions, le footer, la nav et chaque page sectorielle. Le
 * contenu (défis, réponses, fonctionnalités) reflète uniquement des modules
 * réellement présents dans FasoBar — pas de promesse de fonctionnalité non
 * construite.
 */

export type SolutionFeature = {
  title: string;
  body: string;
};

export type SolutionSector = {
  slug: string;
  /** Nom court utilisé en nav/footer. */
  navLabel: string;
  /** Titre H1 de la page sectorielle. */
  title: string;
  /** Résumé court utilisé sur la page hub /solutions. */
  summary: string;
  /** Description meta (page sectorielle). */
  metaDescription: string;
  /** Chapô sous le H1. */
  intro: string;
  /** Défis concrets du secteur. */
  challenges: SolutionFeature[];
  /** Comment FasoBar y répond — chapô avant la grille de fonctionnalités. */
  solutionIntro: string;
  /** Fonctionnalités réellement présentes, adaptées au secteur. */
  features: SolutionFeature[];
};

export const SOLUTION_SECTORS: SolutionSector[] = [
  {
    slug: "alimentation",
    navLabel: "Alimentation",
    title: "Logiciel de gestion pour alimentation et boutique",
    summary:
      "Caisse rapide, code-barres et stock pour épiceries, supérettes et boutiques d’alimentation.",
    metaDescription:
      "Logiciel de caisse et gestion de stock pour commerces d’alimentation : code-barres, ventes rapides, approvisionnements et rapports.",
    intro:
      "Une épicerie ou une boutique d’alimentation vend beaucoup de références différentes, avec un passage en caisse qui doit rester rapide même aux heures d’affluence. FasoBar est pensé pour ce rythme.",
    challenges: [
      {
        title: "Beaucoup de références, peu de temps en caisse",
        body: "Des dizaines voire des centaines de produits à retrouver vite pour ne pas faire attendre le client.",
      },
      {
        title: "Ruptures qui passent inaperçues",
        body: "Un produit de première nécessité en rupture, découvert seulement quand un client le demande.",
      },
      {
        title: "Marges difficiles à suivre",
        body: "Beaucoup de petites lignes de vente, sans vision claire du bénéfice réel en fin de journée.",
      },
      {
        title: "Écarts de caisse et de stock",
        body: "Sans historique précis, une erreur de caisse ou une perte de stock est difficile à retrouver.",
      },
    ],
    solutionIntro:
      "FasoBar apporte une caisse tactile rapide, un suivi de stock en temps réel et un historique complet de chaque opération — sans complexité inutile.",
    features: [
      {
        title: "Caisse tactile et code-barres",
        body: "Scannez un produit avec une douchette USB pour l’ajouter directement au panier, ou recherchez-le au clavier.",
      },
      {
        title: "Stock en temps réel",
        body: "Quantités et seuils d’alerte visibles à tout moment, pour ne plus découvrir une rupture au comptoir.",
      },
      {
        title: "Vente à l’unité ou au lot",
        body: "Certains produits se vendent à la pièce, d’autres au carton ou au lot — FasoBar gère les deux sur la même fiche produit.",
      },
      {
        title: "Approvisionnements",
        body: "Enregistrez vos réceptions fournisseurs, le stock et le coût d’achat se mettent à jour automatiquement.",
      },
      {
        title: "Tickets et reçus thermiques",
        body: "Impression du ticket de caisse à chaque vente, sur imprimante thermique standard.",
      },
      {
        title: "Équipe et rapports",
        body: "Un compte par caissier, et un tableau de bord avec ventes, bénéfice et alertes stock du jour.",
      },
    ],
  },
  {
    slug: "quincaillerie",
    navLabel: "Quincaillerie",
    title: "Logiciel de gestion pour quincaillerie",
    summary:
      "Vente à l’unité et au conditionnement, stock et caisse pour quincailleries et magasins de bricolage.",
    metaDescription:
      "Logiciel de caisse et gestion de stock pour quincaillerie : vente à l’unité ou au conditionnement, approvisionnements et suivi des références.",
    intro:
      "Une quincaillerie gère un très grand nombre de références — outillage, visserie, plomberie, peinture — souvent vendues à la fois à l’unité et en conditionnement. FasoBar est construit pour ce fonctionnement.",
    challenges: [
      {
        title: "Un même article, plusieurs façons de le vendre",
        body: "Une vis se vend à la pièce, un tuyau au mètre, un carton de visserie en gros — sur la même référence.",
      },
      {
        title: "Catalogue très étendu",
        body: "Des centaines de petites références à organiser pour les retrouver vite en caisse.",
      },
      {
        title: "Clients chantiers et clients particuliers",
        body: "Deux profils d’achat différents, avec des volumes et des habitudes de paiement différents.",
      },
      {
        title: "Stock difficile à garder à jour",
        body: "Sans suivi précis, difficile de savoir ce qu’il reste réellement en rayon ou en dépôt.",
      },
    ],
    solutionIntro:
      "FasoBar gère nativement la vente à l’unité et au conditionnement sur la même fiche produit, avec un catalogue structuré par catégories et un stock à jour à chaque vente ou réception.",
    features: [
      {
        title: "Vente à l’unité et au conditionnement",
        body: "Une même référence peut être vendue à la pièce ou par carton/lot, avec un prix propre à chaque mode de vente.",
      },
      {
        title: "Catalogue par catégories",
        body: "Organisez vos produits par rayon (outillage, plomberie, électricité...) pour les retrouver rapidement.",
      },
      {
        title: "Stock en temps réel",
        body: "Quantités et seuils d’alerte à jour à chaque vente ou réception, par référence.",
      },
      {
        title: "Approvisionnements fournisseurs",
        body: "Enregistrez vos réceptions, le stock et le coût d’achat se mettent à jour automatiquement.",
      },
      {
        title: "Caisse tactile",
        body: "Encaissement rapide, ticket imprimé, clôture de session de caisse en fin de journée.",
      },
      {
        title: "Rapports",
        body: "Ventes, bénéfice et alertes stock du jour, visibles d’un coup d’œil.",
      },
    ],
  },
  {
    slug: "station-service",
    navLabel: "Station-service",
    title: "Logiciel de gestion pour station-service",
    summary:
      "Suivi des pompistes, des cuves et bilan journalier des ventes pour stations-service.",
    metaDescription:
      "Logiciel de gestion pour station-service : sessions pompiste, suivi des cuves, ventes de carburant et bilan journalier.",
    intro:
      "Une station-service fonctionne par sessions de pompistes qui se relaient, avec un carburant en cuve qu’il faut rapprocher précisément des ventes chaque jour. FasoBar a un module dédié à ce fonctionnement.",
    challenges: [
      {
        title: "Plusieurs pompistes, plusieurs sessions",
        body: "Chaque poste doit être ouvert et clôturé proprement, avec ses propres ventes et encaissements.",
      },
      {
        title: "Rapprocher le carburant vendu et le stock en cuve",
        body: "Un écart entre stock théorique et stock réel, découvert trop tard, coûte cher.",
      },
      {
        title: "Bilan journalier fastidieux",
        body: "Compiler à la main les ventes de carburant, lubrifiants et boutique en fin de journée prend du temps.",
      },
    ],
    solutionIntro:
      "Le module Station de FasoBar suit les sessions de chaque pompiste, le stock des cuves et produit un bilan journalier des ventes — construit à partir du fonctionnement réel d’une station.",
    features: [
      {
        title: "Sessions pompiste",
        body: "Chaque pompiste ouvre et clôture sa session, avec ses ventes et encaissements déclarés séparément.",
      },
      {
        title: "Suivi des cuves et pompes",
        body: "Stock de carburant et de lubrifiants suivi par cuve, mis à jour avec les réceptions et les ventes.",
      },
      {
        title: "Bilan journalier",
        body: "Un état journalier des ventes reprenant les mouvements de carburant, le stock d’ouverture et de fin de journée.",
      },
      {
        title: "Rapprochement de caisse",
        body: "Les encaissements de chaque session sont rapprochés en fin de poste, pour repérer rapidement un écart.",
      },
      {
        title: "Stock boutique station",
        body: "Les produits vendus en boutique (lubrifiants, accessoires) suivent le même stock que le reste de FasoBar.",
      },
    ],
  },
  {
    slug: "restaurant-bar-maquis",
    navLabel: "Restaurant / Bar / Maquis",
    title: "Logiciel de gestion pour restaurant, bar et maquis",
    summary:
      "Caisse, commandes et stock séparé bar/cuisine pour restaurants, maquis, bars et buvettes.",
    metaDescription:
      "Logiciel de caisse pour restaurant, bar et maquis au Burkina Faso : commandes ouvertes, encaissement, stock bar et cuisine séparés.",
    intro:
      "Dans un restaurant, un maquis ou un bar, une commande passe par plusieurs étapes avant d’être encaissée — et rien ne doit se perdre entre les deux. FasoBar sépare clairement ce qui est en attente de ce qui est encaissé.",
    challenges: [
      {
        title: "Commandes en attente vs commandes encaissées",
        body: "Une commande mise de côté pour être réglée plus tard doit rester visible et facile à retrouver.",
      },
      {
        title: "Stock bar et stock cuisine mélangés",
        body: "Boissons et plats n’ont pas le même rythme de rotation ni les mêmes responsables.",
      },
      {
        title: "Rush aux heures de pointe",
        body: "Prendre une commande, encaisser et imprimer le ticket doit rester rapide même quand la salle est pleine.",
      },
    ],
    solutionIntro:
      "FasoBar distingue clairement les commandes à encaisser des commandes terminées, avec un stock bar et un stock cuisine suivis séparément.",
    features: [
      {
        title: "Commandes ouvertes",
        body: "Une commande mise en attente reste visible dans « à encaisser » jusqu’à son règlement — rien ne se perd.",
      },
      {
        title: "Caisse tactile",
        body: "Prise de commande et encaissement rapides, avec impression du ticket ou du reçu.",
      },
      {
        title: "Stock bar et stock cuisine",
        body: "Deux espaces de stock séparés, adaptés aux rôles de l’établissement (bar, cuisine).",
      },
      {
        title: "Sessions de caisse",
        body: "Ouverture et clôture de session avec suivi des encaissements sur la journée.",
      },
      {
        title: "Équipe et rôles",
        body: "Des accès distincts pour la caisse, la cuisine et la gestion du bar.",
      },
      {
        title: "Rapports",
        body: "Ventes, bénéfice et alertes stock, visibles d’un coup d’œil.",
      },
    ],
  },
  {
    slug: "commerce",
    navLabel: "Commerce général",
    title: "Logiciel de gestion pour commerçants",
    summary:
      "Catalogue, stock, caisse et rapports pour boutiques, téléphonerie, pharmacie, pièces détachées et grossistes.",
    metaDescription:
      "Logiciel de gestion commerciale pour boutiques, téléphonerie, pharmacie, cosmétiques, pièces détachées et grossistes : caisse, stock et rapports.",
    intro:
      "Boutique de vêtements, téléphonerie, pharmacie, cosmétiques, pièces détachées, matériaux de construction ou vente en gros : ces commerces n’ont pas les mêmes produits, mais les mêmes besoins de base. FasoBar couvre ce socle commun.",
    challenges: [
      {
        title: "Un catalogue à tenir à jour",
        body: "Produits, prix et catégories doivent rester justes pour que la caisse et le stock suivent la réalité.",
      },
      {
        title: "Stock difficile à suivre à la main",
        body: "Sans outil, le stock réel finit toujours par s’écarter du stock théorique.",
      },
      {
        title: "Plusieurs employés, un seul commerce",
        body: "Chacun doit pouvoir vendre et encaisser sans avoir accès à tout ce qui ne le concerne pas.",
      },
    ],
    solutionIntro:
      "FasoBar propose le socle utile à tout commerce — catalogue, stock, caisse, approvisionnements, équipe et rapports — quel que soit le type de produits vendus.",
    features: [
      {
        title: "Catalogue et prix",
        body: "Produits, catégories et tarifs, prêts pour la caisse.",
      },
      {
        title: "Stock en temps réel",
        body: "Quantités, seuils et ruptures, visibles à tout moment.",
      },
      {
        title: "Caisse tactile",
        body: "Encaissement rapide, ticket imprimé, clôture de session de caisse.",
      },
      {
        title: "Approvisionnements",
        body: "Réceptions fournisseurs, avec mise à jour automatique du stock et du coût d’achat.",
      },
      {
        title: "Équipe et rôles",
        body: "Un compte par employé, adapté à votre type d’établissement.",
      },
      {
        title: "Rapports",
        body: "Ventes, caisse et alertes stock, d’un seul coup d’œil.",
      },
    ],
  },
];

export function getSolutionSector(slug: string): SolutionSector | null {
  return SOLUTION_SECTORS.find((sector) => sector.slug === slug) ?? null;
}
