import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { cookies } from "next/headers";

import {
  ADMIN_ROLES,
  resolveHomePathForRoles,
  resolveUserSpace,
  canOperateCashRegister,
  type UserSpace,
} from "@/lib/auth/roles";
import {
  TENANT_COOKIE_OPTIONS,
  TENANT_ESTABLISHMENT_COOKIE,
  TENANT_ORGANIZATION_COOKIE,
  assertWorkspaceTenant,
  pickTenantScope,
} from "@/lib/auth/tenant";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";
import { MANAGEMENT_ROLES } from "@/lib/products/constants";
import { resolveOrderPermissions } from "@/lib/orders/constants";
import { resolveStockPermissions } from "@/lib/stock/constants";
import { membershipRoleIsCashierKitchen } from "@/lib/auth/roles";
import { isActivePlatformAdmin } from "@/lib/platform/auth";
import { getOpeningRedirectForOrganization } from "@/lib/platform/opening-gate";
import {
  getSaasRedirectForUser,
  requireOrganizationBusinessAccess,
} from "@/lib/platform/saas-gate";
import { createClient } from "@/lib/supabase/server";
import { isBusinessActivityId } from "@/lib/auth/activities";
import { isRetailShopOps } from "@/lib/activity/ops-model";
import { isRetailActivity } from "@/lib/activity/profile";
import {
  hasBarService,
  hasKitchenService,
  parseServiceScope,
  type ServiceScope,
} from "@/lib/settings/service-scope";

type NamedEntity = {
  id?: string;
  name: string;
};

type EstablishmentRow = NamedEntity & {
  organization_id?: string;
  status?: string;
  service_scope?: string;
  activity_code?: string | null;
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
  mustChangePassword?: boolean;
  serviceScope: ServiceScope;
  activityCode: string | null;
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

async function loadServiceScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  establishmentId: string,
  embeddedScope?: unknown,
): Promise<ServiceScope> {
  if (embeddedScope !== undefined) {
    return parseServiceScope(embeddedScope);
  }

  const { data, error } = await supabase
    .from("establishments")
    .select("service_scope")
    .eq("id", establishmentId)
    .maybeSingle();

  if (error || !data) {
    return "BOTH";
  }

  return parseServiceScope((data as { service_scope?: string }).service_scope);
}

export const getWorkspaceContext = cache(async function getWorkspaceContext(
  userId: string,
): Promise<WorkspaceContext | null> {
  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    const { probeSupabaseReachable } = await import(
      "@/lib/desktop/cloud-reachability"
    );
    const reachable = await probeSupabaseReachable();
    if (!reachable) {
      const { getLocalDatabase } = await import("@/lib/local-db/database");
      const { findLocalUserById } = await import(
        "@/lib/local-auth/users-repository"
      );
      const { buildWorkspaceContextFromLocalUser } = await import(
        "@/lib/local-auth/workspace-local"
      );
      const local = findLocalUserById(
        getLocalDatabase({ skipBackup: true }),
        userId,
      );
      if (!local || local.status !== "ACTIVE") {
        return null;
      }
      return buildWorkspaceContextFromLocalUser(local);
    }
  }

  const supabase = await createClient();

  const membershipSelectWithActivity =
    "role, status, establishment_id, establishments(id, name, organization_id, status, service_scope, activity_code)";
  const membershipSelectWithScope =
    "role, status, establishment_id, establishments(id, name, organization_id, status, service_scope)";
  const membershipSelectLegacy =
    "role, status, establishment_id, establishments(id, name, organization_id, status)";

  type EstablishmentMembershipRow = {
    role: string;
    status: string;
    establishment_id: string;
    establishments:
      | (NamedEntity & {
          organization_id?: string;
          status?: string;
          service_scope?: string | null;
          activity_code?: string | null;
        })
      | Array<
          NamedEntity & {
            organization_id?: string;
            status?: string;
            service_scope?: string | null;
            activity_code?: string | null;
          }
        >
      | null;
  };

  type EstablishmentMembershipQueryResult = {
    data: EstablishmentMembershipRow[] | null;
    error: { message: string } | null;
  };

  function withDefaultServiceScope(
    establishments:
      | (NamedEntity & { organization_id?: string; status?: string })
      | Array<NamedEntity & { organization_id?: string; status?: string }>
      | null,
  ): EstablishmentMembershipRow["establishments"] {
    if (!establishments) return null;
    if (Array.isArray(establishments)) {
      return establishments.map((item) => ({ ...item, service_scope: null }));
    }
    return { ...establishments, service_scope: null };
  }

  const [
    {
      data: { user },
    },
    profileResult,
    organizationResult,
    establishmentResultPrimary,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("full_name, phone, status, must_change_password")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("role, status, organization_id, organizations(id, name, status)")
      .eq("user_id", userId)
      .eq("status", "ACTIVE"),
    supabase
      .from("establishment_memberships")
      .select(membershipSelectWithActivity)
      .eq("user_id", userId)
      .eq("status", "ACTIVE"),
  ]);

  let establishmentResult: EstablishmentMembershipQueryResult = {
    data: (establishmentResultPrimary.data ?? null) as EstablishmentMembershipRow[] | null,
    error: establishmentResultPrimary.error
      ? { message: establishmentResultPrimary.error.message }
      : null,
  };

  if (
    establishmentResult.error &&
    /activity_code/i.test(establishmentResult.error.message)
  ) {
    const scopedResult = await supabase
      .from("establishment_memberships")
      .select(membershipSelectWithScope)
      .eq("user_id", userId)
      .eq("status", "ACTIVE");

    establishmentResult = {
      data: (scopedResult.data ?? null) as EstablishmentMembershipRow[] | null,
      error: scopedResult.error ? { message: scopedResult.error.message } : null,
    };
  }

  if (
    establishmentResult.error &&
    /service_scope/i.test(establishmentResult.error.message)
  ) {
    const legacyResult = await supabase
      .from("establishment_memberships")
      .select(membershipSelectLegacy)
      .eq("user_id", userId)
      .eq("status", "ACTIVE");

    establishmentResult = {
      data: (legacyResult.data ?? null)?.map((row) => ({
        role: row.role,
        status: row.status,
        establishment_id: row.establishment_id,
        establishments: withDefaultServiceScope(
          row.establishments as
            | (NamedEntity & { organization_id?: string; status?: string })
            | Array<NamedEntity & { organization_id?: string; status?: string }>
            | null,
        ),
      })) ?? null,
      error: legacyResult.error
        ? { message: legacyResult.error.message }
        : null,
    };
  }

  const profile = profileResult.data;
  if (profileResult.error || !profile) {
    return null;
  }

  const organizationMemberships = organizationResult.data;
  if (organizationResult.error || !organizationMemberships?.length) {
    return null;
  }

  const establishmentMemberships = establishmentResult.data;
  if (establishmentResult.error || !establishmentMemberships?.length) {
    return null;
  }

  let preferredOrganizationId: string | null = null;
  let preferredEstablishmentId: string | null = null;
  try {
    const cookieStore = await cookies();
    preferredOrganizationId =
      cookieStore.get(TENANT_ORGANIZATION_COOKIE)?.value ?? null;
    preferredEstablishmentId =
      cookieStore.get(TENANT_ESTABLISHMENT_COOKIE)?.value ?? null;
  } catch {
    // Server Components / tests without cookie store.
  }

  const establishmentsForScope = establishmentMemberships.flatMap((row) => {
    const establishment = readRelatedEntity(
      row.establishments as
        | (NamedEntity & { organization_id?: string; status?: string })
        | Array<NamedEntity & { organization_id?: string; status?: string }>
        | null,
    );
    if (!establishment?.organization_id || establishment.status === "INACTIVE") {
      return [];
    }
    return [
      {
        establishment_id: row.establishment_id,
        role: row.role,
        organization_id: establishment.organization_id,
      },
    ];
  });

  const tenantScope = pickTenantScope({
    organizationMemberships,
    establishmentMemberships: establishmentsForScope,
    preferredOrganizationId,
    preferredEstablishmentId,
    pickPreferred: pickPreferredMembership,
  });
  if (!tenantScope) {
    return null;
  }

  const organizationMembership = organizationMemberships.find(
    (row) => row.organization_id === tenantScope.organizationId,
  );
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

  const establishmentCandidates = establishmentMemberships.filter((row) => {
    const establishment = readRelatedEntity(
      row.establishments as
        | (NamedEntity & { organization_id?: string; status?: string })
        | Array<NamedEntity & { organization_id?: string; status?: string }>
        | null,
    );
    return (
      row.establishment_id === tenantScope.establishmentId &&
      establishment?.status !== "INACTIVE" &&
      establishment?.organization_id === tenantScope.organizationId
    );
  });

  const establishmentMembership = pickPreferredMembership(establishmentCandidates);

  if (!establishmentMembership) {
    return null;
  }

  const establishment = readRelatedEntity(
    establishmentMembership.establishments as
      | EstablishmentRow
      | EstablishmentRow[]
      | null,
  );

  if (!organization.name || !establishment?.id || !establishment.name) {
    return null;
  }

  if (establishment.status === "INACTIVE") {
    return null;
  }

  if (establishment.organization_id !== tenantScope.organizationId) {
    return null;
  }

  const organizationRole = organizationMembership.role;
  const establishmentRole = establishmentMembership.role;
  const role = resolveManagementRole(organizationRole, establishmentRole);
  const userSpace = resolveUserSpace(organizationRole, establishmentRole);

  const stockPermissions = resolveStockPermissions(organizationRole, establishmentRole);
  const orderPermissions = resolveOrderPermissions(organizationRole, establishmentRole);

  const cashierKitchenRoles = new Set(["CASHIER", "CASHIER_KITCHEN", "KITCHEN_MANAGER"]);
  const serviceScope = await loadServiceScope(
    supabase,
    establishment.id,
    establishment.service_scope,
  );
  const activityCode = isBusinessActivityId(establishment.activity_code)
    ? establishment.activity_code
    : null;
  const homePath = resolveHomePathForRoles(
    organizationRole,
    establishmentRole,
    activityCode,
  );
  const retail = isRetailShopOps(activityCode);
  const canManageOrders =
    orderPermissions.canManageOrders ||
    cashierKitchenRoles.has(organizationRole) ||
    cashierKitchenRoles.has(establishmentRole);

  const operateCash = canOperateCashRegister(
    organizationRole,
    establishmentRole,
    activityCode,
  );
  const canManageBarStock =
    stockPermissions.canManageBarStock && hasBarService(serviceScope);
  const canManageKitchenStock =
    stockPermissions.canManageKitchenStock &&
    hasKitchenService(serviceScope) &&
    !isRetailActivity(activityCode);
  const canManageStock = canManageBarStock || canManageKitchenStock;

  const context: WorkspaceContext = {
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
    mustChangePassword: Boolean(
      (profile as { must_change_password?: boolean }).must_change_password,
    ),
    canManageProducts:
      MANAGEMENT_ROLES.has(role) ||
      (retail && userSpace === "bar_manager"),
    canManageUsers: MANAGEMENT_ROLES.has(organizationRole) || organizationRole === "OWNER",
    canManageStock,
    canManageBarStock,
    canManageKitchenStock,
    canReadStock: stockPermissions.canReadStock,
    canManageOrders,
    canReadOrders: orderPermissions.canReadOrders || canManageOrders,
    canOperateCashRegister: operateCash,
    serviceScope,
    activityCode,
  };

  assertWorkspaceTenant(context);
  return context;
});

async function persistWorkspaceTenantCookies(
  organizationId: string,
  establishmentId: string,
): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(
      TENANT_ORGANIZATION_COOKIE,
      organizationId,
      TENANT_COOKIE_OPTIONS,
    );
    cookieStore.set(
      TENANT_ESTABLISHMENT_COOKIE,
      establishmentId,
      TENANT_COOKIE_OPTIONS,
    );
  } catch {
    // Cookie store unavailable (tests / static).
  }
}

export const requireAuthenticatedWorkspace = cache(
  async (): Promise<WorkspaceContext> => {
  const { getAuthenticatedUser } = await import("@/lib/auth/session");
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/connexion");
  }

  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    const { probeSupabaseReachable } = await import(
      "@/lib/desktop/cloud-reachability"
    );
    const reachable = await probeSupabaseReachable();
    if (!reachable) {
      const context = await getWorkspaceContext(user.id);
      if (!context || !context.isActive) {
        redirect("/acces-suspendu");
      }
      await persistWorkspaceTenantCookies(
        context.organizationId,
        context.establishmentId,
      );
      return context;
    }
  }

  const context = await getWorkspaceContext(user.id);

  if (!context) {
    redirect("/onboarding");
  }

  if (!context.isActive) {
    redirect("/acces-suspendu");
  }

  if (context.mustChangePassword) {
    redirect("/premiere-connexion");
  }

  await persistWorkspaceTenantCookies(
    context.organizationId,
    context.establishmentId,
  );
  return context;
});

/** Contexte workspace + assertion d'accès métier (mutations). */
export async function requireBusinessMutationContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();
  const denied = await requireOrganizationBusinessAccess(context.organizationId);
  if (denied) {
    const saasRedirect = await getSaasRedirectForUser(
      context.userId,
      context.organizationId,
      context.organizationRole === "OWNER",
    );
    redirect(saasRedirect ?? "/acces-saas-bloque");
  }
  return context;
}

const SAAS_OK_CACHE_MS = 45_000;
const saasOkUntil = new Map<string, number>();

async function assertBusinessMutationAccess(
  context: WorkspaceContext,
): Promise<void> {
  if (await isActivePlatformAdmin()) return;

  const cachedUntil = saasOkUntil.get(context.organizationId) ?? 0;
  if (cachedUntil > Date.now()) return;

  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    const { probeSupabaseReachable } = await import(
      "@/lib/desktop/cloud-reachability"
    );
    const reachable = await probeSupabaseReachable();
    if (!reachable) {
      const deniedOffline = await requireOrganizationBusinessAccess(
        context.organizationId,
      );
      if (deniedOffline) {
        const saasRedirect = await getSaasRedirectForUser(
          context.userId,
          context.organizationId,
          context.organizationRole === "OWNER",
        );
        redirect(saasRedirect ?? "/acces-saas-bloque");
      }
      saasOkUntil.set(context.organizationId, Date.now() + SAAS_OK_CACHE_MS);
      return;
    }
  }

  const denied = await requireOrganizationBusinessAccess(context.organizationId);
  if (denied) {
    saasOkUntil.delete(context.organizationId);
    const saasRedirect = await getSaasRedirectForUser(
      context.userId,
      context.organizationId,
      context.organizationRole === "OWNER",
    );
    redirect(saasRedirect ?? "/acces-saas-bloque");
  }
  saasOkUntil.set(context.organizationId, Date.now() + SAAS_OK_CACHE_MS);
}

async function withMutationAccess(
  context: WorkspaceContext,
): Promise<WorkspaceContext> {
  await assertBusinessMutationAccess(context);
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
  const context = await requireAuthenticatedWorkspace();
  if (!(await isActivePlatformAdmin())) {
    const openingRedirect = await getOpeningRedirectForOrganization(
      context.organizationId,
    );
    if (openingRedirect) {
      redirect(openingRedirect);
    }
  }
  return context;
}

export async function requireAdminContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (!isAdminWorkspace(context)) {
    redirectDenied(context);
  }

  return context;
}

/** Admin station-service : espace admin ou responsable station. */
export async function requireGasStationAdminContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (context.activityCode !== "gas_station") {
    if (isAdminWorkspace(context)) {
      redirect(context.homePath || "/application/tableau-de-bord");
    }
    redirect("/application/acces-refuse");
  }

  if (context.userSpace !== "admin" && context.userSpace !== "bar_manager") {
    redirectDenied(context);
  }

  return context;
}

export async function requireAdminMutationContext(): Promise<WorkspaceContext> {
  return withMutationAccess(await requireAdminContext());
}

export async function requireSpacePathAccess(pathname: string): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (
    !isPathAllowedForSpace(
      pathname,
      context.userSpace,
      context.serviceScope,
      context.activityCode,
    )
  ) {
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

export async function requireProductManagementMutationContext(): Promise<WorkspaceContext> {
  return withMutationAccess(await requireProductManagementContext());
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

export async function requireStockManagementMutationContext(): Promise<WorkspaceContext> {
  return withMutationAccess(await requireStockManagementContext());
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

export async function requireOrderManagementMutationContext(): Promise<WorkspaceContext> {
  return withMutationAccess(await requireOrderManagementContext());
}

export async function requireGasStationAdminMutationContext(): Promise<WorkspaceContext> {
  return withMutationAccess(await requireGasStationAdminContext());
}

/** Pompiste station-service (cashier_kitchen + gas_station). */
export async function requireGasStationOperatorContext(): Promise<WorkspaceContext> {
  const context = await requireCashRegisterOperatorContext();

  if (context.activityCode !== "gas_station") {
    redirectDenied(context);
  }

  return context;
}

export async function requireGasStationOperatorMutationContext(): Promise<WorkspaceContext> {
  return withMutationAccess(await requireGasStationOperatorContext());
}

/** Ouverture / fermeture / utilisation opérationnelle de la caisse (pas Admin). */
export async function requireCashRegisterOperatorContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (!context.canOperateCashRegister) {
    redirectDenied(context);
  }

  return context;
}

export async function requireCashRegisterOperatorMutationContext(): Promise<WorkspaceContext> {
  return withMutationAccess(await requireCashRegisterOperatorContext());
}

export async function requireKitchenContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (isRetailActivity(context.activityCode)) {
    redirectDenied(context);
  }

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

export async function requireKitchenMutationContext(): Promise<WorkspaceContext> {
  return withMutationAccess(await requireKitchenContext());
}

export async function requireBarManagerContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext();

  if (context.userSpace !== "bar_manager") {
    redirectDenied(context);
  }

  if (isRetailShopOps(context.activityCode)) {
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

export async function requireBarManagerMutationContext(): Promise<WorkspaceContext> {
  return withMutationAccess(await requireBarManagerContext());
}

/** Accès page Dépenses (Admin, Bar, Caisse–Cuisine). */
export async function requireExpenseContext(): Promise<WorkspaceContext> {
  return requireSpacePathAccess("/application/depenses");
}

export async function requireExpenseMutationContext(): Promise<WorkspaceContext> {
  return withMutationAccess(await requireExpenseContext());
}

export { membershipRoleIsCashierKitchen, isAdminWorkspace };
