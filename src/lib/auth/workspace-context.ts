import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import {
  ADMIN_ROLES,
  resolveHomePathForRoles,
  resolveUserSpace,
  canOperateCashRegister,
  type UserSpace,
} from "@/lib/auth/roles";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";
import { MANAGEMENT_ROLES } from "@/lib/products/constants";
import { resolveOrderPermissions } from "@/lib/orders/constants";
import { resolveStockPermissions } from "@/lib/stock/constants";
import { membershipRoleIsCashierKitchen } from "@/lib/auth/roles";
import { profileRequiresPasswordChange } from "@/lib/users/queries";
import { createClient } from "@/lib/supabase/server";

type NamedEntity = {
  id?: string;
  name: string;
};

export type WorkspaceContext = {
  userId: string;
  ownerName: string;
  email: string;
  organizationId: string;
  organizationName: string;
  establishmentId: string;
  establishmentName: string;
  organizationRole: string;
  establishmentRole: string;
  role: string;
  userSpace: UserSpace;
  homePath: string;
  isActive: boolean;
  canManageProducts: boolean;
  canManageStock: boolean;
  canManageBarStock: boolean;
  canManageKitchenStock: boolean;
  canReadStock: boolean;
  canManageOrders: boolean;
  canReadOrders: boolean;
  canManageUsers: boolean;
  canOperateCashRegister: boolean;
};

/** Priorité stable si plusieurs memberships (évite LIMIT 1 non déterministe). */
const MEMBERSHIP_ROLE_PRIORITY = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "BAR_MANAGER",
  "CASHIER_KITCHEN",
  "CASHIER",
  "KITCHEN_MANAGER",
] as const;

function readRelatedEntity<T extends NamedEntity>(
  relation: T | T[] | null | undefined,
): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function membershipRoleRank(role: string): number {
  const index = MEMBERSHIP_ROLE_PRIORITY.indexOf(
    role as (typeof MEMBERSHIP_ROLE_PRIORITY)[number],
  );
  return index === -1 ? MEMBERSHIP_ROLE_PRIORITY.length : index;
}

function pickPreferredMembership<T extends { role: string }>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort(
    (a, b) => membershipRoleRank(a.role) - membershipRoleRank(b.role),
  )[0]!;
}

function resolveManagementRole(
  organizationRole: string | null,
  establishmentRole: string | null,
): string {
  if (organizationRole && MANAGEMENT_ROLES.has(organizationRole)) {
    return organizationRole;
  }
  if (establishmentRole && MANAGEMENT_ROLES.has(establishmentRole)) {
    return establishmentRole;
  }
  return organizationRole ?? establishmentRole ?? "MEMBER";
}

export const getWorkspaceContext = cache(async function getWorkspaceContext(
  userId: string,
): Promise<WorkspaceContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, phone, status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  const { data: organizationMemberships, error: organizationError } =
    await supabase
      .from("organization_memberships")
      .select("role, status, organization_id, organizations(id, name, status)")
      .eq("user_id", userId)
      .eq("status", "ACTIVE");

  if (organizationError || !organizationMemberships?.length) {
    return null;
  }

  const organizationMembership = pickPreferredMembership(organizationMemberships);
  if (!organizationMembership) {
    return null;
  }

  const organization = readRelatedEntity(
    organizationMembership.organizations as
      | (NamedEntity & { status?: string })
      | Array<NamedEntity & { status?: string }>
      | null,
  );

  if (!organization?.id || organization.status === "INACTIVE") {
    return null;
  }

  const { data: establishmentMemberships, error: establishmentError } =
    await supabase
      .from("establishment_memberships")
      .select(
        "role, status, establishment_id, establishments(id, name, organization_id, status)",
      )
      .eq("user_id", userId)
      .eq("status", "ACTIVE");

  if (establishmentError || !establishmentMemberships?.length) {
    return null;
  }

  const establishmentCandidates = establishmentMemberships.filter((row) => {
    const establishment = readRelatedEntity(
      row.establishments as
        | (NamedEntity & { organization_id?: string; status?: string })
        | Array<NamedEntity & { organization_id?: string; status?: string }>
        | null,
    );
    return (
      establishment?.status !== "INACTIVE" &&
      establishment?.organization_id === organizationMembership.organization_id
    );
  });

  const establishmentMembership = pickPreferredMembership(establishmentCandidates);

  if (!establishmentMembership) {
    return null;
  }

  const establishment = readRelatedEntity(
    establishmentMembership.establishments as
      | (NamedEntity & { status?: string })
      | Array<NamedEntity & { status?: string }>
      | null,
  );

  if (!organization.name || !establishment?.id || !establishment.name) {
    return null;
  }

  if (establishment.status === "INACTIVE") {
    return null;
  }

  const organizationRole = organizationMembership.role;
  const establishmentRole = establishmentMembership.role;
  const role = resolveManagementRole(organizationRole, establishmentRole);
  const userSpace = resolveUserSpace(organizationRole, establishmentRole);
  const homePath = resolveHomePathForRoles(organizationRole, establishmentRole);

  const stockPermissions = resolveStockPermissions(organizationRole, establishmentRole);
  const orderPermissions = resolveOrderPermissions(organizationRole, establishmentRole);

  const cashierKitchenRoles = new Set(["CASHIER", "CASHIER_KITCHEN", "KITCHEN_MANAGER"]);
  const canManageOrders =
    orderPermissions.canManageOrders ||
    cashierKitchenRoles.has(organizationRole) ||
    cashierKitchenRoles.has(establishmentRole);

  const operateCash = canOperateCashRegister(organizationRole, establishmentRole);

  return {
    userId,
    ownerName: profile.full_name ?? "Utilisateur",
    email: user?.email ?? "",
    organizationId: organizationMembership.organization_id,
    organizationName: organization.name,
    establishmentId: establishmentMembership.establishment_id,
    establishmentName: establishment.name,
    organizationRole,
    establishmentRole,
    role,
    userSpace,
    homePath,
    isActive: profile.status === "ACTIVE",
    canManageProducts: MANAGEMENT_ROLES.has(role),
    canManageUsers: MANAGEMENT_ROLES.has(organizationRole) || organizationRole === "OWNER",
    ...stockPermissions,
    canManageOrders,
    canReadOrders: orderPermissions.canReadOrders || canManageOrders,
    canOperateCashRegister: operateCash,
  };
});

export async function requireAuthenticatedWorkspace(): Promise<WorkspaceContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status === "INACTIVE") {
    redirect("/acces-suspendu");
  }

  if (await profileRequiresPasswordChange(user.id)) {
    redirect("/premiere-connexion");
  }

  const context = await getWorkspaceContext(user.id);

  if (!context) {
    redirect("/onboarding");
  }

  if (!context.isActive) {
    redirect("/acces-suspendu");
  }

  return context;
}

function isAdminWorkspace(context: WorkspaceContext): boolean {
  return (
    context.userSpace === "admin" ||
    ADMIN_ROLES.has(context.organizationRole) ||
    ADMIN_ROLES.has(context.establishmentRole)
  );
}

/** Redirection d'accès : l'admin revient à son tableau, les autres voient le mur. */
function redirectDenied(context: WorkspaceContext): never {
  if (isAdminWorkspace(context)) {
    redirect(context.homePath || "/application/tableau-de-bord");
  }
  redirect("/application/acces-refuse");
}

export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  return requireAuthenticatedWorkspace();
}

export async function requireAdminContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (!isAdminWorkspace(context)) {
    redirectDenied(context);
  }

  return context;
}

export async function requireSpacePathAccess(pathname: string): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (!isPathAllowedForSpace(pathname, context.userSpace)) {
    redirectDenied(context);
  }

  return context;
}

export async function requireProductManagementContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (!context.canManageProducts) {
    redirectDenied(context);
  }

  return context;
}

export async function requireStockReadContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (!context.canReadStock) {
    redirectDenied(context);
  }

  return context;
}

export async function requireStockManagementContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (!context.canManageStock) {
    redirectDenied(context);
  }

  return context;
}

export async function requireOrderReadContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (!context.canReadOrders) {
    redirectDenied(context);
  }

  return context;
}

export async function requireOrderManagementContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (!context.canManageOrders) {
    redirectDenied(context);
  }

  return context;
}

/** Ouverture / fermeture / utilisation opérationnelle de la caisse (pas Admin). */
export async function requireCashRegisterOperatorContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (!context.canOperateCashRegister) {
    redirectDenied(context);
  }

  return context;
}

export async function requireKitchenContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (context.userSpace !== "cashier_kitchen") {
    redirectDenied(context);
  }

  const canAccessKitchen =
    membershipRoleIsCashierKitchen(context.organizationRole) ||
    membershipRoleIsCashierKitchen(context.establishmentRole);

  if (!canAccessKitchen) {
    redirectDenied(context);
  }

  if (!context.organizationId || !context.establishmentId) {
    redirectDenied(context);
  }

  return context;
}

export async function requireBarManagerContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (context.userSpace !== "bar_manager") {
    redirectDenied(context);
  }

  if (!context.canManageBarStock) {
    redirectDenied(context);
  }

  if (!context.organizationId || !context.establishmentId) {
    redirectDenied(context);
  }

  return context;
}

export { membershipRoleIsCashierKitchen, isAdminWorkspace };
