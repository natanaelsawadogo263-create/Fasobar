import { describe, expect, it } from "vitest";

import {
  KITCHEN_COLUMNS,
  KITCHEN_NEXT_ACTION,
  KITCHEN_STATUS_LABELS,
} from "@/lib/kitchen/constants";
import { kitchenStatusSchema, updateKitchenStatusSchema } from "@/lib/kitchen/schemas";

describe("kitchen schemas", () => {
  it("accepte les statuts cuisine valides", () => {
    for (const status of KITCHEN_COLUMNS) {
      expect(kitchenStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("valide la mise à jour de statut", () => {
    const result = updateKitchenStatusSchema.safeParse({
      orderId: "00000000-0000-4000-8000-000000000099",
      status: "IN_PREPARATION",
    });

    expect(result.success).toBe(true);
  });

  it("définit les transitions attendues", () => {
    expect(KITCHEN_NEXT_ACTION.TO_PREPARE.nextStatus).toBe("IN_PREPARATION");
    expect(KITCHEN_NEXT_ACTION.IN_PREPARATION.nextStatus).toBe("READY");
    expect(KITCHEN_NEXT_ACTION.READY.nextStatus).toBe("SERVED");
    expect(KITCHEN_STATUS_LABELS.SERVED).toBe("Servie");
  });
});
