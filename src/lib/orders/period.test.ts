import { describe, expect, it } from "vitest";

import {
  resolveOrderPeriodRange,
  shiftOrderPeriodAnchor,
  toLocalIsoDate,
} from "@/lib/orders/period";

// Les périodes suivent l'heure de Ouagadougou (UTC), quel que soit le fuseau de
// l'appareil : ces tests passent aussi sur une machine réglée en UTC+2 ou UTC−5.
describe("périodes jour / semaine / mois", () => {
  it("le jour est celui de Ouagadougou, même tard le soir", () => {
    // 31 octobre, 23 h 30 à Ouagadougou (déjà le 1er novembre à Paris).
    expect(toLocalIsoDate(new Date(Date.UTC(2026, 9, 31, 23, 30)))).toBe("2026-10-31");
  });

  it("semaine du lundi au dimanche", () => {
    expect(resolveOrderPeriodRange("week", "2026-10-27")).toEqual({
      from: "2026-10-26",
      to: "2026-11-01",
    });
    // Un dimanche appartient à la semaine qui a commencé le lundi précédent.
    expect(resolveOrderPeriodRange("week", "2026-11-01")).toEqual({
      from: "2026-10-26",
      to: "2026-11-01",
    });
  });

  it("mois du 1er au dernier jour, sans déborder sur le mois voisin", () => {
    expect(resolveOrderPeriodRange("month", "2026-10-27")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(resolveOrderPeriodRange("month", "2026-02-10")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("navigation précédent / suivant", () => {
    expect(shiftOrderPeriodAnchor("day", "2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftOrderPeriodAnchor("week", "2026-10-27", 1)).toBe("2026-11-03");
    // Du 31 janvier, le mois suivant est février (pas mars).
    expect(resolveOrderPeriodRange("month", shiftOrderPeriodAnchor("month", "2026-01-31", 1))).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });
});
