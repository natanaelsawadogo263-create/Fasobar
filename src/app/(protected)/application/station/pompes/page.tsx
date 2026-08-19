import { FuelPumpsWorkspace } from "@/components/station/fuel-pumps-workspace";
import { requireGasStationAdminContext } from "@/lib/auth/workspace-context";
import {
  listFuelPumps,
  listFuelTanksForSelect,
  listFuelTypesForSelect,
} from "@/lib/station/queries";

export default async function FuelPumpsPage() {
  const workspace = await requireGasStationAdminContext();
  const [pumps, fuelTypeOptions, fuelTankOptions] = await Promise.all([
    listFuelPumps(workspace),
    listFuelTypesForSelect(workspace),
    listFuelTanksForSelect(workspace),
  ]);

  return (
    <FuelPumpsWorkspace
      data={pumps}
      fuelTypeOptions={fuelTypeOptions}
      fuelTankOptions={fuelTankOptions}
    />
  );
}
