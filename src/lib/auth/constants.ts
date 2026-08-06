import type { EstablishmentType } from "@/lib/auth/schemas";

export const ESTABLISHMENT_TYPE_LABELS: Record<EstablishmentType, string> = {
  RESTAURANT_MAQUIS: "Restaurant maquis",
  RESTAURANT: "Restaurant",
  MAQUIS: "Maquis",
  BAR: "Bar",
};

export const ESTABLISHMENT_TYPES = Object.keys(
  ESTABLISHMENT_TYPE_LABELS,
) as EstablishmentType[];
