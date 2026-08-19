import { FuelTypesWorkspace } from "@/components/station/fuel-types-workspace";
import { requireGasStationAdminContext } from "@/lib/auth/workspace-context";
import { listFuelTypes } from "@/lib/station/queries";

export default async function FuelTypesPage() {
  const workspace = await requireGasStationAdminContext();
  const fuelTypes = await listFuelTypes(workspace);

  return <FuelTypesWorkspace data={fuelTypes} />;
}
