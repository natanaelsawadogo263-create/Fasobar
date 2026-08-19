import { describe, expect, it } from "vitest";

import {
  isProductUnitEnumError,
  persistProductUnit,
} from "@/lib/products/persist-unit";

describe("persistProductUnit", () => {
  it("garde les unités de base", () => {
    expect(persistProductUnit("PIECE")).toEqual({
      unit: "PIECE",
      stock_unit_label: "Pièce",
    });
    expect(persistProductUnit("KG")).toEqual({
      unit: "KG",
      stock_unit_label: "Kilogramme",
    });
  });

  it("conserve Sac si la base le connaît", () => {
    expect(persistProductUnit("SAC")).toEqual({
      unit: "SAC",
      stock_unit_label: "Sac",
    });
  });

  it("retombe sur Pièce + libellé Sac si l’enum n’existe pas", () => {
    expect(persistProductUnit("SAC", { fallback: true })).toEqual({
      unit: "PIECE",
      stock_unit_label: "Sac",
    });
    expect(persistProductUnit("SACHET", { fallback: true })).toEqual({
      unit: "PIECE",
      stock_unit_label: "Sachet",
    });
  });

  it("détecte une erreur d’enum Postgres", () => {
    expect(
      isProductUnitEnumError({
        message: 'invalid input value for enum product_unit: "SAC"',
        code: "22P02",
      }),
    ).toBe(true);
    expect(isProductUnitEnumError({ message: "duplicate key" })).toBe(false);
  });
});
