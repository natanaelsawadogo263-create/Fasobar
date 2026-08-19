import { FuelTanksWorkspace } from "@/components/station/fuel-tanks-workspace";
import { requireGasStationAdminContext } from "@/lib/auth/workspace-context";
import { listFuelTanks, listFuelTypesForSelect } from "@/lib/station/queries";

export default async function FuelTanksPage() {
  const workspace = await requireGasStationAdminContext();
  const [tanks, fuelTypeOptions] = await Promise.all([
    listFuelTanks(workspace),
    listFuelTypesForSelect(workspace),
  ]);

  return <FuelTanksWorkspace data={tanks} fuelTypeOptions={fuelTypeOptions} />;
}
