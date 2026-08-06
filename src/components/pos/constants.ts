import type { DepartmentCode } from "@/lib/products/schemas";

export type DepartmentFilter = "all" | "bar" | "kitchen";

export const POS_DEPARTMENT_FILTERS: Array<{
  id: DepartmentFilter;
  label: string;
}> = [
  { id: "all", label: "Tous" },
  { id: "bar", label: "Boissons" },
  { id: "kitchen", label: "Cuisine" },
];

export const POS_DEPARTMENT_BADGE: Record<
  DepartmentCode,
  { label: string; className: string }
> = {
  BAR: {
    label: "BAR",
    className: "bg-[#f5e6d3] text-[#8b6914] ring-1 ring-[#e8d5b8]",
  },
  KITCHEN: {
    label: "CUISINE",
    className: "bg-[#ede9fe] text-[#6d28d9] ring-1 ring-[#ddd6fe]",
  },
};

export function productInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}
