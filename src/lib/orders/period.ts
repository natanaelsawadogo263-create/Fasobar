import type { AdminOrderPeriodFilter } from "@/lib/orders/schemas";

/**
 * Périodes (jour, semaine, mois) calculées à l'heure de Ouagadougou (UTC+0, sans
 * heure d'été), quel que soit le fuseau de l'appareil ou du serveur : un PC réglé
 * sur un autre fuseau ne doit pas décaler les filtres. Les objets `Date` manipulés
 * ici représentent minuit UTC du jour concerné.
 */

/** Date YYYY-MM-DD à l'heure de Ouagadougou. */
export function toLocalIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD → minuit (Ouagadougou) de ce jour. */
export function parseLocalIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return startOfDay(new Date());
  return new Date(Date.UTC(y, m - 1, d));
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Semaine : lundi → dimanche. */
export function startOfWeekMonday(date: Date): Date {
  const day = startOfDay(date);
  const offset = day.getUTCDay() === 0 ? -6 : 1 - day.getUTCDay();
  return addDays(day, offset);
}

export function endOfWeekSunday(date: Date): Date {
  return addDays(startOfWeekMonday(date), 6);
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function resolveOrderPeriodRange(
  period: AdminOrderPeriodFilter,
  anchorIso?: string,
): { from?: string; to?: string } {
  if (period === "all" || period === "custom") {
    return { from: undefined, to: undefined };
  }

  const anchor = anchorIso ? parseLocalIsoDate(anchorIso) : new Date();

  if (period === "day") {
    const day = toLocalIsoDate(anchor);
    return { from: day, to: day };
  }

  if (period === "week") {
    return {
      from: toLocalIsoDate(startOfWeekMonday(anchor)),
      to: toLocalIsoDate(endOfWeekSunday(anchor)),
    };
  }

  return {
    from: toLocalIsoDate(startOfMonth(anchor)),
    to: toLocalIsoDate(endOfMonth(anchor)),
  };
}

export function shiftOrderPeriodAnchor(
  period: Exclude<AdminOrderPeriodFilter, "all" | "custom">,
  anchorIso: string,
  direction: -1 | 1,
): string {
  const anchor = parseLocalIsoDate(anchorIso);

  if (period === "day") {
    return toLocalIsoDate(addDays(anchor, direction));
  }

  if (period === "week") {
    return toLocalIsoDate(addDays(anchor, direction * 7));
  }

  // Mois : on part du 1er pour éviter les débordements (31 → mois suivant).
  return toLocalIsoDate(
    new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + direction, 1)),
  );
}

export function formatOrderPeriodLabel(
  period: AdminOrderPeriodFilter,
  from?: string,
  to?: string,
): string {
  if (period === "all" || period === "custom" || !from || !to) return "Toutes les périodes";

  const fromDate = parseLocalIsoDate(from);
  const toDate = parseLocalIsoDate(to);

  if (period === "day") {
    return fromDate.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  if (period === "week") {
    const start = fromDate.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    const end = toDate.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    return `${start} – ${end}`;
  }

  return fromDate.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
