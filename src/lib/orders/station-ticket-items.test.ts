import { describe, expect, it } from "vitest";

import {
  isStationSupplement,
  stationLineQuantity,
  stationLineTotal,
} from "@/lib/orders/station-ticket-items";

describe("stationLineQuantity", () => {
  it("montre seulement le reliquat à préparer", () => {
    expect(
      stationLineQuantity({
        quantity: 3,
        preparedQuantity: 2,
        activePrep: true,
      }),
    ).toBe(1);
  });

  it("masque une ligne déjà servie pendant la prep", () => {
    expect(
      stationLineQuantity({
        quantity: 2,
        preparedQuantity: 2,
        activePrep: true,
      }),
    ).toBeNull();
  });

  it("montre le préparé une fois la vague prête", () => {
    expect(
      stationLineQuantity({
        quantity: 2,
        preparedQuantity: 2,
        activePrep: false,
      }),
    ).toBe(2);
  });
});

describe("isStationSupplement", () => {
  it("détecte un ajout sur commande déjà servie", () => {
    expect(
      isStationSupplement(
        [
          { preparedQuantity: 2 },
          { preparedQuantity: 0 },
        ],
        true,
      ),
    ).toBe(true);
  });
});

describe("stationLineTotal", () => {
  it("calcule le total de la quantité affichée", () => {
    expect(stationLineTotal(1000, 1)).toBe(1000);
  });
});
