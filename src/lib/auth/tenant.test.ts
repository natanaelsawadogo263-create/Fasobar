import { describe, expect, it } from "vitest";

import {
  isTenantUuid,
  pickTenantScope,
  sameTenant,
} from "@/lib/auth/tenant";

function pickFirst<T>(rows: T[]): T | null {
  return rows[0] ?? null;
}

describe("isolation multi-tenant", () => {
  it("refuse un UUID invalide", () => {
    expect(isTenantUuid("abc")).toBe(false);
    expect(isTenantUuid("")).toBe(false);
  });

  it("ne mélange pas deux organisations", () => {
    const orgA = "11111111-1111-4111-8111-111111111111";
    const orgB = "22222222-2222-4222-8222-222222222222";
    const estA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const estB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const scope = pickTenantScope({
      organizationMemberships: [
        { organization_id: orgA, role: "OWNER" },
        { organization_id: orgB, role: "CASHIER" },
      ],
      establishmentMemberships: [
        { establishment_id: estA, organization_id: orgA, role: "OWNER" },
        { establishment_id: estB, organization_id: orgB, role: "CASHIER" },
      ],
      preferredOrganizationId: orgA,
      pickPreferred: pickFirst,
    });

    expect(scope).toEqual({ organizationId: orgA, establishmentId: estA });
    expect(sameTenant(scope!, { organization_id: orgB, establishment_id: estB })).toBe(
      false,
    );
  });

  it("ignore un établissement d’une autre organisation même s’il est préféré", () => {
    const orgA = "11111111-1111-4111-8111-111111111111";
    const orgB = "22222222-2222-4222-8222-222222222222";
    const estA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const estB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const scope = pickTenantScope({
      organizationMemberships: [{ organization_id: orgA, role: "OWNER" }],
      establishmentMemberships: [
        { establishment_id: estA, organization_id: orgA, role: "OWNER" },
        { establishment_id: estB, organization_id: orgB, role: "OWNER" },
      ],
      preferredEstablishmentId: estB,
      pickPreferred: pickFirst,
    });

    expect(scope?.establishmentId).toBe(estA);
  });
});
