import { describe, expect, it } from "vitest";

import {
  USER_ERROR_MESSAGE,
  looksTechnicalError,
  toUserFacingError,
} from "@/lib/errors/user-facing";

describe("toUserFacingError", () => {
  it("garde un message métier court", () => {
    expect(toUserFacingError("Ajoutez au moins un article à la commande.")).toBe(
      "Ajoutez au moins un article à la commande.",
    );
  });

  it("masque une erreur SQL", () => {
    expect(
      toUserFacingError(
        'column order_items.prepared_quantity does not exist',
      ),
    ).toBe(USER_ERROR_MESSAGE);
  });

  it("masque un code Postgres", () => {
    expect(toUserFacingError("ERROR:  42P01: relation foo does not exist")).toBe(
      USER_ERROR_MESSAGE,
    );
  });

  it("masque un JSON PostgREST", () => {
    expect(
      toUserFacingError('{"code":"PGRST204","message":"schema cache"}'),
    ).toBe(USER_ERROR_MESSAGE);
  });
});

describe("looksTechnicalError", () => {
  it("détecte un texte trop long", () => {
    expect(looksTechnicalError("x".repeat(200))).toBe(true);
  });
});
