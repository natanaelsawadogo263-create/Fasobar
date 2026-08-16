type TenantIds = {
  organizationId: string;
  establishmentId: string;
};

export const TENANT_ORGANIZATION_COOKIE = "fb_organization";
export const TENANT_ESTABLISHMENT_COOKIE = "fb_establishment";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const TENANT_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 400,
  secure: process.env.NODE_ENV === "production",
};

export function isTenantUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function assertWorkspaceTenant(workspace: TenantIds): void {
  if (
    !isTenantUuid(workspace.organizationId) ||
    !isTenantUuid(workspace.establishmentId)
  ) {
    throw new Error("Espace établissement invalide.");
  }
}

type OrgMembership = {
  organization_id: string;
  role: string;
};

type EstMembership = {
  establishment_id: string;
  role: string;
  organization_id: string;
};

export function pickTenantScope(input: {
  organizationMemberships: OrgMembership[];
  establishmentMemberships: EstMembership[];
  preferredOrganizationId?: string | null;
  preferredEstablishmentId?: string | null;
  pickPreferred: <T extends { role: string }>(rows: T[]) => T | null;
}): {
  organizationId: string;
  establishmentId: string;
} | null {
  const orgs = input.organizationMemberships.filter((row) =>
    isTenantUuid(row.organization_id),
  );
  if (orgs.length === 0) return null;

  const preferredOrg = isTenantUuid(input.preferredOrganizationId)
    ? orgs.find((row) => row.organization_id === input.preferredOrganizationId)
    : null;
  const organization = preferredOrg ?? input.pickPreferred(orgs);
  if (!organization) return null;

  const establishments = input.establishmentMemberships.filter(
    (row) =>
      isTenantUuid(row.establishment_id) &&
      row.organization_id === organization.organization_id,
  );
  if (establishments.length === 0) return null;

  const preferredEst = isTenantUuid(input.preferredEstablishmentId)
    ? establishments.find(
        (row) => row.establishment_id === input.preferredEstablishmentId,
      )
    : null;
  const establishment = preferredEst ?? input.pickPreferred(establishments);
  if (!establishment) return null;

  return {
    organizationId: organization.organization_id,
    establishmentId: establishment.establishment_id,
  };
}

export function sameTenant(
  workspace: TenantIds,
  row: { organization_id?: string | null; establishment_id?: string | null },
): boolean {
  return (
    row.organization_id === workspace.organizationId &&
    row.establishment_id === workspace.establishmentId
  );
}

/** Filtre obligatoire : org + établissement. */
export function applyTenantFilter<
  T extends {
    eq: (column: string, value: string) => T;
  },
>(query: T, workspace: TenantIds): T {
  return query
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId);
}
