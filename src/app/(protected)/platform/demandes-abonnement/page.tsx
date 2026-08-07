import { PlatformRequestsWorkspace } from "@/components/platform/platform-requests-workspace";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { listPlatformSubscriptionRequests } from "@/lib/platform/requests-queries";

export default async function PlatformDemandesAbonnementPage() {
  await requirePlatformAdmin();
  const { requests, error } = await listPlatformSubscriptionRequests();

  return <PlatformRequestsWorkspace requests={requests} error={error} />;
}
