import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import {
  FUEL_LINE_DEFS,
  type FuelLineId,
} from "@/lib/station/sheet-engine";
import type { PumpForSelect } from "@/lib/station/pump-session-types";
import { listFuelTanks, listFuelTypes } from "@/lib/station/queries";

export const FUEL_LINE_IDS = FUEL_LINE_DEFS.map((line) => line.id) as [
  FuelLineId,
  ...FuelLineId[],
];

export function isFuelLineId(value: string): value is FuelLineId {
  return FUEL_LINE_DEFS.some((line) => line.id === value);
}

export function fuelLineLabel(lineId: FuelLineId): string {
  return FUEL_LINE_DEFS.find((line) => line.id === lineId)?.label ?? lineId;
}

function classifyFuelTypeKind(name: string): "SUPER" | "GAZ_OIL" | null {
  const upper = name.toUpperCase();
  if (
    upper.includes("SUPER") ||
    upper.includes(" SS") ||
    upper.startsWith("SS") ||
    upper.includes("SP95") ||
    upper.includes("SP98")
  ) {
    return "SUPER";
  }
  if (
    upper.includes("GO") ||
    upper.includes("GAZOIL") ||
    upper.includes("GASOIL") ||
    upper.includes("DIESEL")
  ) {
    return "GAZ_OIL";
  }
  return null;
}

export async function listFuelLinesForSessionOpen(
  workspace: WorkspaceContext,
): Promise<PumpForSelect[]> {
  const [fuelTypes, fuelTanks] = await Promise.all([
    listFuelTypes(workspace),
    listFuelTanks(workspace),
  ]);

  const activeTypes = fuelTypes.filter((type) => type.active);
  const activeTanks = fuelTanks.filter((tank) => tank.active);

  const superType = activeTypes.find((type) => classifyFuelTypeKind(type.name) === "SUPER");
  const gazType = activeTypes.find((type) => classifyFuelTypeKind(type.name) === "GAZ_OIL");

  const superTank = superType
    ? activeTanks.find((tank) => tank.fuel_type_id === superType.id)
    : null;
  const gazTank = gazType ? activeTanks.find((tank) => tank.fuel_type_id === gazType.id) : null;

  const options: PumpForSelect[] = [];

  for (const line of FUEL_LINE_DEFS) {
    if (line.kind === "SUPER") {
      if (!superType || !superTank) continue;
      options.push({
        id: line.id,
        fuelLineId: line.id,
        name: line.label,
        fuelTypeName: superType.name,
        fuelTankName: superTank.name,
        pricePerLiter: superType.selling_price,
        fuelTypeId: superType.id,
        fuelTankId: superTank.id,
      });
      continue;
    }

    if (!gazType || !gazTank) continue;
    options.push({
      id: line.id,
      fuelLineId: line.id,
      name: line.label,
      fuelTypeName: gazType.name,
      fuelTankName: gazTank.name,
      pricePerLiter: gazType.selling_price,
      fuelTypeId: gazType.id,
      fuelTankId: gazTank.id,
    });
  }

  return options;
}

export type FuelLineCatalogStatus = {
  hasSuperFuelType: boolean;
  hasGazoilFuelType: boolean;
  hasSuperTank: boolean;
  hasGazoilTank: boolean;
};

export async function getFuelLineCatalogStatus(
  workspace: WorkspaceContext,
): Promise<FuelLineCatalogStatus> {
  const [fuelTypes, fuelTanks] = await Promise.all([
    listFuelTypes(workspace),
    listFuelTanks(workspace),
  ]);

  const activeTypes = fuelTypes.filter((type) => type.active);
  const activeTanks = fuelTanks.filter((tank) => tank.active);

  const superType = activeTypes.find((type) => classifyFuelTypeKind(type.name) === "SUPER");
  const gazType = activeTypes.find((type) => classifyFuelTypeKind(type.name) === "GAZ_OIL");

  return {
    hasSuperFuelType: Boolean(superType),
    hasGazoilFuelType: Boolean(gazType),
    hasSuperTank: Boolean(superType && activeTanks.some((t) => t.fuel_type_id === superType.id)),
    hasGazoilTank: Boolean(gazType && activeTanks.some((t) => t.fuel_type_id === gazType.id)),
  };
}
