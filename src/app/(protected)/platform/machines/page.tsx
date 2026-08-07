import { PlatformMachinesWorkspace } from "@/components/platform/platform-machines-workspace";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { listPlatformMachines } from "@/lib/platform/machines-queries";

export default async function PlatformMachinesPage() {
  await requirePlatformAdmin();
  const { machines, error } = await listPlatformMachines();

  return <PlatformMachinesWorkspace machines={machines} error={error} />;
}
