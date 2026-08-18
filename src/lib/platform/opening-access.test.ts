import { describe, expect, it } from "vitest";

import {
  isEstablishmentOpeningStatus,
  resolveOpeningRedirect,
} from "@/lib/platform/opening-access";

describe("establishment opening access", () => {
  it("bloque l’accès admin tant que la demande est en attente", () => {
    expect(resolveOpeningRedirect("PENDING")).toBe("/attente-validation");
  });

  it("redirige aussi les demandes refusées", () => {
    expect(resolveOpeningRedirect("REJECTED")).toBe(
      "/attente-validation?refused=1",
    );
  });

  it("laisse passer une organisation approuvée", () => {
    expect(resolveOpeningRedirect("APPROVED")).toBeNull();
    expect(resolveOpeningRedirect(null)).toBeNull();
  });

  it("valide les statuts connus", () => {
    expect(isEstablishmentOpeningStatus("PENDING")).toBe(true);
    expect(isEstablishmentOpeningStatus("UNKNOWN")).toBe(false);
  });
});
