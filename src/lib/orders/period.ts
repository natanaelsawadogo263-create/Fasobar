import type { AdminOrderPeriodFilter } from "@/lib/orders/schemas";

/** Date locale YYYY-MM-DD (évite le décalage UTC de toISOString). */
export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseLocalIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

/** Semaine ISO locale : lundi → dimanche. */
export function startOfWeekMonday(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  return result;
}

export function endOfWeekSunday(date: Date): Date {
  const start = startOfWeekMonday(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function resolveOrderPeriodRange(
  period: AdminOrderPeriodFilter,
  anchorIso?: string,
): { from?: string; to?: string } {
  if (period === "all") {
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
  period: Exclude<AdminOrderPeriodFilter, "all">,
  anchorIso: string,
  direction: -1 | 1,
): string {
  const anchor = parseLocalIsoDate(anchorIso);

  if (period === "day") {
    anchor.setDate(anchor.getDate() + direction);
    return toLocalIsoDate(anchor);
  }

  if (period === "week") {
    anchor.setDate(anchor.getDate() + direction * 7);
    return toLocalIsoDate(anchor);
  }

  anchor.setMonth(anchor.getMonth() + direction);
  return toLocalIsoDate(anchor);
}

export function formatOrderPeriodLabel(
  period: AdminOrderPeriodFilter,
  from?: string,
  to?: string,
): string {
  if (period === "all" || !from || !to) return "Toutes les périodes";

  const fromDate = parseLocalIsoDate(from);
  const toDate = parseLocalIsoDate(to);

  if (period === "day") {
    return fromDate.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  if (period === "week") {
    const start = fromDate.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
    const end = toDate.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${start} – ${end}`;
  }

  return fromDate.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}
