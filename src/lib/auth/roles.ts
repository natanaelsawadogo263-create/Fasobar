import { isHardwareActivity } from "@/lib/hardware/activity";

export type UserSpace = "admin" | "cashier_kitchen" | "bar_manager";

export const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "MANAGER"]);
export const BAR_MANAGER_ROLES = new Set(["BAR_MANAGER"]);
export const CASHIER_KITCHEN_ROLES = new Set([
  "CASHIER_KITCHEN",
  "CASHIER",
  "KITCHEN_MANAGER",
]);

export const INVITABLE_SPACES = [
  {
    id: "admin" as const,
    label: "Admin",
    description: "Gestion générale de l'établissement et de l'équipe.",
    role: "ADMIN" as const,
  },
  {
    id: "cashier_kitchen" as const,
    label: "Caisse–Cuisine",
    description: "Commandes, encaissements, reçus et opérations Cuisine.",
    role: "CASHIER_KITCHEN" as const,
  },
  {
    id: "bar_manager" as const,
    label: "Responsable Bar",
    description: "Commandes boissons, stock Bar, pertes et inventaires.",
    role: "BAR_MANAGER" as const,
  },
];

export const SPACE_LABELS: Record<UserSpace, string> = {
  admin: "Administration",
  cashier_kitchen: "Caisse–Cuisine",
  bar_manager: "Responsable Bar",
};

export const SPACE_HOME_PATHS: Record<UserSpace, string> = {
  admin: "/application/tableau-de-bord",
  cashier_kitchen: "/application/caisse",
  bar_manager: "/application/bar",
};

export function membershipRoleIsCashierKitchen(role: string): boolean {
  return CASHIER_KITCHEN_ROLES.has(role);
}

export function resolveEffectiveRole(
  organizationRole: string,
  establishmentRole: string,
): string {
  if (ADMIN_ROLES.has(organizationRole)) {
    return organizationRole;
  }

  if (ADMIN_ROLES.has(establishmentRole)) {
    return establishmentRole;
  }

  if (BAR_MANAGER_ROLES.has(organizationRole) || BAR_MANAGER_ROLES.has(establishmentRole)) {
    return BAR_MANAGER_ROLES.has(establishmentRole)
      ? establishmentRole
      : organizationRole;
  }

  if (
    membershipRoleIsCashierKitchen(organizationRole) ||
    membershipRoleIsCashierKitchen(establishmentRole)
  ) {
    return membershipRoleIsCashierKitchen(establishmentRole)
      ? establishmentRole
      : organizationRole;
  }

  return organizationRole || establishmentRole || "MEMBER";
}

export function resolveUserSpace(
  organizationRole: string,
  establishmentRole: string,
): UserSpace {
  const role = resolveEffectiveRole(organizationRole, establishmentRole);

  if (ADMIN_ROLES.has(role)) {
    return "admin";
  }

  if (BAR_MANAGER_ROLES.has(role)) {
    return "bar_manager";
  }

  if (membershipRoleIsCashierKitchen(role)) {
    return "cashier_kitchen";
  }

  return "admin";
}

export function resolveHomePathForRoles(
  organizationRole: string,
  establishmentRole: string,
  activityCode?: string | null,
): string {
  const space = resolveUserSpace(organizationRole, establishmentRole);
  if (space === "bar_manager" && isHardwareActivity(activityCode)) {
    return "/application/stock";
  }
  return SPACE_HOME_PATHS[space];
}

/** Ouverture / fermeture / usage caisse. Admin quincaillerie peut aussi vendre. */
export function canOperateCashRegister(
  organizationRole: string,
  establishmentRole: string,
  activityCode?: string | null,
): boolean {
  const space = resolveUserSpace(organizationRole, establishmentRole);
  if (space === "cashier_kitchen") return true;
  if (space === "admin" && isHardwareActivity(activityCode)) return true;
  return false;
}

export function inviteSpaceToRole(
  space: "admin" | "cashier_kitchen" | "bar_manager",
): "ADMIN" | "CASHIER_KITCHEN" | "BAR_MANAGER" {
  const match = INVITABLE_SPACES.find((item) => item.id === space);
  return match?.role ?? "CASHIER_KITCHEN";
}

export function roleToSpaceLabel(role: string): string {
  if (ADMIN_ROLES.has(role)) {
    return SPACE_LABELS.admin;
  }

  if (BAR_MANAGER_ROLES.has(role)) {
    return SPACE_LABELS.bar_manager;
  }

  if (membershipRoleIsCashierKitchen(role)) {
    return SPACE_LABELS.cashier_kitchen;
  }

  return role;
}
