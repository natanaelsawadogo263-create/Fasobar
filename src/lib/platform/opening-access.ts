export const ESTABLISHMENT_OPENING_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export type EstablishmentOpeningStatus =
  (typeof ESTABLISHMENT_OPENING_STATUSES)[number];

export function isEstablishmentOpeningStatus(
  value: string,
): value is EstablishmentOpeningStatus {
  return (ESTABLISHMENT_OPENING_STATUSES as readonly string[]).includes(value);
}

/** Redirection si l’organisation n’a pas encore l’accès admin. */
export function resolveOpeningRedirect(
  status: EstablishmentOpeningStatus | null,
): string | null {
  if (status === "PENDING") {
    return "/attente-validation";
  }
  if (status === "REJECTED") {
    return "/attente-validation?refused=1";
  }
  return null;
}
