import { describe, expect, it } from "vitest";

import {
  isRetailAdminDirectSeller,
  isRetailShopOps,
  usesShopCatalog,
  usesTradeCatalog,
} from "@/lib/activity/ops-model";

describe("modèle ops magasin", () => {
  it("sépare restauration et commerces", () => {
    expect(isRetailShopOps("restaurant")).toBe(false);
    expect(isRetailShopOps("pharmacy")).toBe(true);
    expect(isRetailShopOps("wholesale")).toBe(true);
  });

  it("réserve le wizard conversions aux dépôts et pièces", () => {
    expect(usesTradeCatalog("hardware")).toBe(true);
    expect(usesTradeCatalog("construction")).toBe(true);
    expect(usesTradeCatalog("moto-parts")).toBe(true);
    expect(usesTradeCatalog("auto-parts")).toBe(true);
    expect(usesTradeCatalog("wholesale")).toBe(true);
    expect(usesTradeCatalog("pharmacy")).toBe(false);
    expect(usesTradeCatalog("supermarket")).toBe(false);
    expect(usesShopCatalog("clothing")).toBe(true);
    expect(usesShopCatalog("hardware")).toBe(false);
  });

  it("autorise l’admin magasin à vendre", () => {
    expect(
      isRetailAdminDirectSeller({ activityCode: "phones", userSpace: "admin" }),
    ).toBe(true);
    expect(
      isRetailAdminDirectSeller({
        activityCode: "restaurant",
        userSpace: "admin",
      }),
    ).toBe(false);
  });
});
