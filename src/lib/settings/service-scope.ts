export const SERVICE_SCOPES = ["BOTH", "BAR", "KITCHEN"] as const;

export type ServiceScope = (typeof SERVICE_SCOPES)[number];
export type DepartmentCode = "BAR" | "KITCHEN";

export const SERVICE_SCOPE_OPTIONS = [
  {
    id: "BAR" as const,
    label: "Boissons uniquement",
    description: "Bar ou buvette : uniquement la gestion des boissons.",
  },
  {
    id: "KITCHEN" as const,
    label: "Nourriture uniquement",
    description: "Restaurant : uniquement la gestion de la restauration.",
  },
  {
    id: "BOTH" as const,
    label: "Les deux",
    description: "Bar et restauration dans le même établissement.",
  },
] as const;

export function parseServiceScope(value: unknown): ServiceScope {
  if (value === "BAR" || value === "KITCHEN" || value === "BOTH") {
    return value;
  }
  return "BOTH";
}

export function hasBarService(scope: ServiceScope): boolean {
  return scope === "BAR" || scope === "BOTH";
}

export function hasKitchenService(scope: ServiceScope): boolean {
  return scope === "KITCHEN" || scope === "BOTH";
}

export function isDepartmentAllowed(
  scope: ServiceScope,
  departmentCode: DepartmentCode,
): boolean {
  return departmentCode === "BAR" ? hasBarService(scope) : hasKitchenService(scope);
}

export function defaultDepartmentCode(scope: ServiceScope): DepartmentCode {
  return hasBarService(scope) ? "BAR" : "KITCHEN";
}

export function allowedDepartments(scope: ServiceScope): DepartmentCode[] {
  const departments: DepartmentCode[] = [];
  if (hasBarService(scope)) departments.push("BAR");
  if (hasKitchenService(scope)) departments.push("KITCHEN");
  return departments;
}

export function isSingleServiceScope(scope: ServiceScope): boolean {
  return scope === "BAR" || scope === "KITCHEN";
}

export function defaultPosDepartmentFilter(
  scope: ServiceScope,
): "all" | "bar" | "kitchen" {
  if (scope === "BAR") return "bar";
  if (scope === "KITCHEN") return "kitchen";
  return "all";
}

export function defaultStockTab(scope: ServiceScope): "all" | "bar" | "kitchen" {
  if (scope === "BAR") return "bar";
  if (scope === "KITCHEN") return "kitchen";
  return "all";
}

export function isInvitableSpaceAllowed(
  space: string,
  scope: ServiceScope,
): boolean {
  if (space === "bar_manager") return hasBarService(scope);
  return true;
}

/** Routes métier interdites selon le profil d’exploitation. */
export function isPathAllowedForServiceScope(
  pathname: string,
  scope: ServiceScope,
): boolean {
  if (!hasBarService(scope)) {
    if (
      pathname.startsWith("/application/sessions-bar") ||
      pathname.startsWith("/application/bar") ||
      pathname.startsWith("/application/stock/boissons")
    ) {
      return false;
    }
  }

  if (!hasKitchenService(scope)) {
    if (
      pathname.startsWith("/application/cuisine") ||
      pathname.startsWith("/application/stock/cuisine")
    ) {
      return false;
    }
  }

  return true;
}

export function coerceAdminOrderDepartment(
  scope: ServiceScope,
  department: string | undefined,
): "all" | "BAR" | "KITCHEN" {
  if (scope === "BAR") return "BAR";
  if (scope === "KITCHEN") return "KITCHEN";
  if (department === "BAR" || department === "KITCHEN") return department;
  return "all";
}

export function departmentLabel(code: DepartmentCode): string {
  return code === "BAR" ? "Boissons" : "Nourriture";
}
