export const HARDWARE_CREDIT_LIMIT_XOF = 300_000;

export const HARDWARE_CUSTOMER_TYPES = [
  { id: "INDIVIDUAL", label: "Particulier" },
  { id: "CRAFTSMAN", label: "Artisan" },
  { id: "COMPANY", label: "Entreprise" },
  { id: "RESELLER", label: "Revendeur" },
] as const;

export type HardwareCustomerType =
  (typeof HARDWARE_CUSTOMER_TYPES)[number]["id"];

export const HARDWARE_SALE_MODES = [
  { id: "RETAIL", label: "Détail" },
  { id: "WHOLESALE", label: "Gros" },
] as const;

export type HardwareSaleMode = (typeof HARDWARE_SALE_MODES)[number]["id"];

export const HARDWARE_PAYMENT_METHODS = [
  { id: "CASH", label: "Espèces" },
  { id: "MOOV_MONEY", label: "Moov Money" },
  { id: "ORANGE_MONEY", label: "Mobile Money" },
] as const;

export const HARDWARE_EXPENSE_CATEGORIES = [
  { id: "TRANSPORT", label: "Transport" },
  { id: "HANDLING", label: "Manutention" },
  { id: "FUEL", label: "Carburant" },
  { id: "ELECTRICITY", label: "Électricité" },
  { id: "RENT", label: "Loyer" },
  { id: "MAINTENANCE", label: "Entretien" },
  { id: "SUPPLY", label: "Approvisionnement" },
  { id: "OTHER", label: "Autres" },
] as const;

export const HARDWARE_PO_STATUSES = [
  { id: "DRAFT", label: "Brouillon" },
  { id: "SENT", label: "Envoyé" },
  { id: "PENDING", label: "En attente" },
  { id: "PARTIAL", label: "Reçu partiellement" },
  { id: "RECEIVED", label: "Reçu" },
  { id: "CANCELLED", label: "Annulé" },
] as const;

export const HARDWARE_CATEGORY_SUGGESTIONS = [
  "Ciment",
  "Peinture",
  "Plomberie",
  "Électricité",
  "Outillage",
  "Visserie",
  "Bois",
  "Fer",
  "Quincaillerie générale",
] as const;
