export { formatPriceXof } from "@/lib/orders/constants";

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}h`;
}

export function formatDayLabel(dateIso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(
    new Date(`${dateIso}T00:00:00.000Z`),
  );
}

export function formatDateTimeFr(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
