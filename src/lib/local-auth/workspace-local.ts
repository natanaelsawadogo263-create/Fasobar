import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import {
  ADMIN_ROLES,
  canOperateCashRegister,
  resolveHomePathForRoles,
  resolveUserSpace,
} from "@/lib/auth/roles";
import type { LocalUserRow } from "@/lib/local-auth/users-repository";
import { MANAGEMENT_ROLES } from "@/lib/products/constants";
import { resolveOrderPermissions } from "@/lib/orders/constants";
import { resolveStockPermissions } from "@/lib/stock/constants";

/**
 * Build WorkspaceContext from a local SQLite user row (offline / local session).
 * Uses login_identifier for the email-facing field (never internal auth email).
 */
export function buildWorkspaceContextFromLocalUser(
  user: LocalUserRow,
): WorkspaceContext {
  // Local roster stores the establishment membership role; reuse for org role.
  const establishmentRole = user.role;
  const organizationRole = user.role;
  const role = MANAGEMENT_ROLES.has(establishmentRole)
    ? establishmentRole
    : establishmentRole || "MEMBER";

  const userSpace = resolveUserSpace(organizationRole, establishmentRole);
  const homePath = resolveHomePathForRoles(organizationRole, establishmentRole);
  const stockPermissions = resolveStockPermissions(
    organizationRole,
    establishmentRole,
  );
  const orderPermissions = resolveOrderPermissions(
    organizationRole,
    establishmentRole,
  );

  const cashierKitchenRoles = new Set([
    "CASHIER",
    "CASHIER_KITCHEN",
    "KITCHEN_MANAGER",
  ]);
  const canManageOrders =
    orderPermissions.canManageOrders ||
    cashierKitchenRoles.has(organizationRole) ||
    cashierKitchenRoles.has(establishmentRole);

  return {
    userId: user.id,
    ownerName: user.displayName || user.loginIdentifier,
    email: user.loginIdentifier,
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    establishmentId: user.establishmentId,
    establishmentName: user.establishmentName,
    organizationRole,
    establishmentRole,
    role,
    userSpace,
    homePath,
    isActive: user.status === "ACTIVE",
    canManageProducts: MANAGEMENT_ROLES.has(role),
    canManageUsers: ADMIN_ROLES.has(organizationRole),
    ...stockPermissions,
    canManageOrders,
    canReadOrders: orderPermissions.canReadOrders || canManageOrders,
    canOperateCashRegister: canOperateCashRegister(
      organizationRole,
      establishmentRole,
      user.activityCode ?? null,
    ),
    serviceScope: "BOTH",
    activityCode: user.activityCode ?? null,
  };
}
