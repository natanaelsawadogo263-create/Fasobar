import { describe, expect, it } from "vitest";

import {
  defaultDepartmentCode,
  hasBarService,
  hasKitchenService,
  isDepartmentAllowed,
  isInvitableSpaceAllowed,
  isPathAllowedForServiceScope,
  parseServiceScope,
} from "@/lib/settings/service-scope";

describe("service_scope établissement", () => {
  it("par défaut les deux espaces", () => {
    expect(parseServiceScope(null)).toBe("BOTH");
    expect(parseServiceScope("nope")).toBe("BOTH");
    expect(hasBarService("BOTH")).toBe(true);
    expect(hasKitchenService("BOTH")).toBe(true);
  });

  it("isole bar ou cuisine", () => {
    expect(hasKitchenService("BAR")).toBe(false);
    expect(hasBarService("KITCHEN")).toBe(false);
    expect(isDepartmentAllowed("BAR", "KITCHEN")).toBe(false);
    expect(isDepartmentAllowed("KITCHEN", "BAR")).toBe(false);
    expect(defaultDepartmentCode("KITCHEN")).toBe("KITCHEN");
  });

  it("n’invite pas le responsable bar sans espace boissons", () => {
    expect(isInvitableSpaceAllowed("bar_manager", "KITCHEN")).toBe(false);
    expect(isInvitableSpaceAllowed("bar_manager", "BAR")).toBe(true);
    expect(isInvitableSpaceAllowed("cashier_kitchen", "KITCHEN")).toBe(true);
  });

  it("bloque les routes métier hors périmètre", () => {
    expect(isPathAllowedForServiceScope("/application/sessions-bar", "KITCHEN")).toBe(
      false,
    );
    expect(isPathAllowedForServiceScope("/application/stock/boissons", "KITCHEN")).toBe(
      false,
    );
    expect(isPathAllowedForServiceScope("/application/stock/cuisine", "BAR")).toBe(false);
    expect(isPathAllowedForServiceScope("/application/bar/stock", "KITCHEN")).toBe(false);
    expect(isPathAllowedForServiceScope("/application/stock", "BAR")).toBe(true);
  });
});
