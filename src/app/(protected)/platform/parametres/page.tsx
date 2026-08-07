import { PlatformSettingsWorkspace } from "@/components/platform/platform-settings-workspace";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { getPlatformSettings } from "@/lib/platform/settings-queries";

export default async function PlatformParametresPage() {
  await requirePlatformAdmin();
  const { settings, plans, error } = await getPlatformSettings();

  return (
    <PlatformSettingsWorkspace settings={settings} plans={plans} error={error} />
  );
}
