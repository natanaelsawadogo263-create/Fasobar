/**
 * Période d'analyse des livraisons (admin) : jour, semaine, mois ou plage libre.
 * Dates au format `AAAA-MM-JJ`, à l'heure de Ouagadougou (UTC+0) quel que soit le
 * fuseau du serveur ou de l'appareil ; `end` est exclusif.
 */

export const DELIVERY_PERIOD_PRESETS = [
  { id: "jour", label: "Aujourd’hui" },
  { id: "semaine", label: "Cette semaine" },
  { id: "mois", label: "Ce mois" },
] as const;

export type DeliveryPeriodPresetId = (typeof DELIVERY_PERIOD_PRESETS)[number]["id"];

export type DeliveryPeriod = {
  /** Préréglage actif, ou "personnalise" pour une plage libre. */
  preset: DeliveryPeriodPresetId | "personnalise";
  /** Premier jour inclus (AAAA-MM-JJ). */
  from: string;
  /** Dernier jour inclus (AAAA-MM-JJ). */
  to: string;
  /** Début de période (minuit local, inclus). */
  start: Date;
  /** Lendemain du dernier jour (minuit local, exclu). */
  end: Date;
};

const DEFAULT_PRESET: DeliveryPeriodPresetId = "jour";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toLocalIsoDate(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function parseLocalIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejette les dates impossibles (ex. 2026-02-31).
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/** Bornes d'un préréglage (la semaine commence le lundi). */
export function deliveryPresetRange(
  preset: DeliveryPeriodPresetId,
  now: Date = new Date(),
): { from: string; to: string } {
  const today = startOfDay(now);
  if (preset === "semaine") {
    const mondayOffset = (today.getUTCDay() + 6) % 7;
    return { from: toLocalIsoDate(addDays(today, -mondayOffset)), to: toLocalIsoDate(today) };
  }
  if (preset === "mois") {
    return {
      from: toLocalIsoDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))),
      to: toLocalIsoDate(today),
    };
  }
  return { from: toLocalIsoDate(today), to: toLocalIsoDate(today) };
}

/** Lit la période depuis l'URL (`periode`, `du`, `au`) ; valeurs invalides → aujourd'hui. */
export function resolveDeliveryPeriod(
  params: { periode?: unknown; du?: unknown; au?: unknown },
  now: Date = new Date(),
): DeliveryPeriod {
  const fromDate = parseLocalIsoDate(params.du);
  const toDate = parseLocalIsoDate(params.au);

  if (params.periode === "personnalise" && (fromDate || toDate)) {
    let start = fromDate ?? toDate!;
    let last = toDate ?? fromDate!;
    if (start > last) [start, last] = [last, start];
    return {
      preset: "personnalise",
      from: toLocalIsoDate(start),
      to: toLocalIsoDate(last),
      start,
      end: addDays(last, 1),
    };
  }

  const preset =
    DELIVERY_PERIOD_PRESETS.find((item) => item.id === params.periode)?.id ?? DEFAULT_PRESET;
  const range = deliveryPresetRange(preset, now);
  const start = parseLocalIsoDate(range.from)!;
  const last = parseLocalIsoDate(range.to)!;
  return { preset, from: range.from, to: range.to, start, end: addDays(last, 1) };
}

/** Paramètres d'URL représentant une période. */
export function deliveryPeriodSearch(period: Pick<DeliveryPeriod, "preset" | "from" | "to">): string {
  const params = new URLSearchParams({ periode: period.preset });
  if (period.preset === "personnalise") {
    params.set("du", period.from);
    params.set("au", period.to);
  }
  return params.toString();
}

/** « 25 oct. 2026 » ou « 1 oct. → 25 oct. 2026 ». */
export function formatDeliveryPeriodLabel(period: Pick<DeliveryPeriod, "from" | "to">): string {
  const format = (value: string, withYear: boolean) =>
    parseLocalIsoDate(value)?.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: withYear ? "numeric" : undefined,
      timeZone: "UTC",
    }) ?? value;

  if (period.from === period.to) return format(period.from, true);
  const sameYear = period.from.slice(0, 4) === period.to.slice(0, 4);
  return `${format(period.from, !sameYear)} → ${format(period.to, true)}`;
}
