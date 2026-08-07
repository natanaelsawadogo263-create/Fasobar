import { PlatformAdminsWorkspace } from "@/components/platform/platform-admins-workspace";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { listPlatformAdmins } from "@/lib/platform/admins-queries";

export default async function PlatformSuperAdminsPage() {
  const user = await requirePlatformAdmin();
  const { admins, error } = await listPlatformAdmins();

  return (
    <PlatformAdminsWorkspace
      admins={admins}
      error={error}
      currentUserId={user.id}
    />
  );
}
