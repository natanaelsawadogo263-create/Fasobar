import { describe, expect, it } from "vitest";

import {
  deliveryPeriodSearch,
  formatDeliveryPeriodLabel,
  resolveDeliveryPeriod,
} from "@/lib/delivery/period";

// Dimanche 25 octobre 2026, 15 h 30 à Ouagadougou (UTC), quel que soit le fuseau de la machine.
const NOW = new Date(Date.UTC(2026, 9, 25, 15, 30));

describe("période d'analyse des livraisons", () => {
  it("par défaut : aujourd'hui, de minuit à minuit", () => {
    const period = resolveDeliveryPeriod({}, NOW);
    expect(period.preset).toBe("jour");
    expect(period.from).toBe("2026-10-25");
    expect(period.to).toBe("2026-10-25");
    expect(period.start).toEqual(new Date(Date.UTC(2026, 9, 25)));
    expect(period.end).toEqual(new Date(Date.UTC(2026, 9, 26)));
  });

  it("la semaine commence le lundi", () => {
    const period = resolveDeliveryPeriod({ periode: "semaine" }, NOW);
    expect(period.from).toBe("2026-10-19");
    expect(period.to).toBe("2026-10-25");
  });

  it("le mois commence le 1er", () => {
    const period = resolveDeliveryPeriod({ periode: "mois" }, NOW);
    expect(period.from).toBe("2026-10-01");
    expect(period.end).toEqual(new Date(Date.UTC(2026, 9, 26)));
  });

  it("plage libre : dernier jour inclus, dates inversées remises dans l'ordre", () => {
    const period = resolveDeliveryPeriod(
      { periode: "personnalise", du: "2026-10-10", au: "2026-09-01" },
      NOW,
    );
    expect(period.preset).toBe("personnalise");
    expect(period.from).toBe("2026-09-01");
    expect(period.to).toBe("2026-10-10");
    expect(period.end).toEqual(new Date(Date.UTC(2026, 9, 11)));
  });

  it("dates invalides → aujourd'hui", () => {
    expect(resolveDeliveryPeriod({ periode: "personnalise", du: "2026-02-31" }, NOW).preset).toBe("jour");
    expect(resolveDeliveryPeriod({ periode: "nimporte" }, NOW).preset).toBe("jour");
  });

  it("URL et libellé", () => {
    expect(deliveryPeriodSearch({ preset: "mois", from: "", to: "" })).toBe("periode=mois");
    expect(
      deliveryPeriodSearch({ preset: "personnalise", from: "2026-10-01", to: "2026-10-10" }),
    ).toBe("periode=personnalise&du=2026-10-01&au=2026-10-10");
    expect(formatDeliveryPeriodLabel({ from: "2026-10-25", to: "2026-10-25" })).toContain("25");
  });
});
