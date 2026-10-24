import { isRetailShopOps } from "@/lib/activity/ops-model";

export type UserSpace = "admin" | "cashier_kitchen" | "bar_manager" | "delivery";

export const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "MANAGER"]);
export const BAR_MANAGER_ROLES = new Set(["BAR_MANAGER"]);
export const CASHIER_KITCHEN_ROLES = new Set([
  "CASHIER_KITCHEN",
  "CASHIER",
  "KITCHEN_MANAGER",
]);
/** Livreur — établissements e-commerce uniquement. */
export const DELIVERY_ROLES = new Set(["DELIVERY_AGENT"]);

export const INVITABLE_SPACES = [
  {
    id: "admin" as const,
    label: "Admin",
    description: "Gestion générale de l'établissement et de l'équipe.",
    role: "ADMIN" as const,
  },
  {
    id: "cashier_kitchen" as const,
    label: "Cuisine",
    description: "Commandes cuisine, préparation et opérations Cuisine.",
    role: "CASHIER_KITCHEN" as const,
  },
  {
    id: "bar_manager" as const,
    label: "Bar",
    description: "Commandes boissons, stock Bar et pertes.",
    role: "BAR_MANAGER" as const,
  },
  {
    id: "delivery" as const,
    label: "Livreur",
    description: "Accepte les commandes, livre et gère son stock de livraison.",
    role: "DELIVERY_AGENT" as const,
  },
];

export const SPACE_LABELS: Record<UserSpace, string> = {
  admin: "Administration",
  cashier_kitchen: "Cuisine",
  bar_manager: "Bar",
  delivery: "Livreur",
};

export const SPACE_HOME_PATHS: Record<UserSpace, string> = {
  admin: "/application/tableau-de-bord",
  cashier_kitchen: "/application/caisse",
  bar_manager: "/application/bar",
  delivery: "/application/livreur",
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

  if (DELIVERY_ROLES.has(organizationRole) || DELIVERY_ROLES.has(establishmentRole)) {
    return DELIVERY_ROLES.has(establishmentRole) ? establishmentRole : organizationRole;
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

  if (DELIVERY_ROLES.has(role)) {
    return "delivery";
  }

  return "admin";
}

export function resolveHomePathForRoles(
  organizationRole: string,
  establishmentRole: string,
  activityCode?: string | null,
): string {
  const space = resolveUserSpace(organizationRole, establishmentRole);
  if (activityCode === "gas_station") {
    if (space === "cashier_kitchen") {
      return "/application/station/pompiste/session";
    }
    if (space === "admin" || space === "bar_manager") {
      return "/application/station";
    }
  }
  if (space === "bar_manager" && isRetailShopOps(activityCode)) {
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
  if (space === "admin" && isRetailShopOps(activityCode)) return true;
  return false;
}

export function inviteSpaceToRole(
  space: UserSpace,
): "ADMIN" | "CASHIER_KITCHEN" | "BAR_MANAGER" | "DELIVERY_AGENT" {
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

  if (DELIVERY_ROLES.has(role)) {
    return SPACE_LABELS.delivery;
  }

  return role;
}
