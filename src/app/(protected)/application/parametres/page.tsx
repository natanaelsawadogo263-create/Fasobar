import { requireAdminContext } from "@/lib/auth/workspace-context";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";
import { getEstablishmentSettings } from "@/lib/settings/queries";
import { AdminSettingsWorkspace } from "@/components/admin/admin-settings-workspace";

export default async function ParametresPage() {
  await requireCloudOnlineForDesktop("/application/parametres");
  const workspace = await requireAdminContext();
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
