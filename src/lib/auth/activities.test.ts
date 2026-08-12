import { describe, expect, it } from "vitest";

import {
  isBusinessActivityId,
  isSelectableActivityId,
  mapActivityToEstablishmentType,
} from "@/lib/auth/activities";

describe("activités commerciales", () => {
  it("accepte un code du catalogue", () => {
    expect(isBusinessActivityId("pharmacy")).toBe(true);
    expect(isBusinessActivityId("hardware")).toBe(true);
    expect(isBusinessActivityId("restaurant")).toBe(true);
    expect(isBusinessActivityId("bar")).toBe(false);
  });

  it("n’ouvre que l’espace restauration pour l’instant", () => {
    expect(isSelectableActivityId("restaurant")).toBe(true);
    expect(isSelectableActivityId("pharmacy")).toBe(false);
    expect(isSelectableActivityId("hardware")).toBe(false);
  });

  it("mappe restaurant vers RESTAURANT et le reste vers COMMERCE", () => {
    expect(mapActivityToEstablishmentType("restaurant")).toBe("RESTAURANT");
    expect(mapActivityToEstablishmentType("pharmacy")).toBe("COMMERCE");
    expect(mapActivityToEstablishmentType("other")).toBe("COMMERCE");
  });
});
