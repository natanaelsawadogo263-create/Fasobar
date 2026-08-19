import { requireGasStationAdminContext } from "@/lib/auth/workspace-context";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";
import { getEstablishmentSettings } from "@/lib/settings/queries";
import { AdminSettingsWorkspace } from "@/components/admin/admin-settings-workspace";

export default async function StationParametresPage() {
  await requireCloudOnlineForDesktop("/application/station/parametres");
  const workspace = await requireGasStationAdminContext();

  const { settings, migrationMissing } = await getEstablishmentSettings(workspace);

  return (
    <AdminSettingsWorkspace
      settings={settings}
      migrationMissing={migrationMissing}
      organizationName={workspace.organizationName}
      establishmentName={workspace.establishmentName}
      ownerEmail={workspace.email}
      activityCode={workspace.activityCode}
    />
  );
}
