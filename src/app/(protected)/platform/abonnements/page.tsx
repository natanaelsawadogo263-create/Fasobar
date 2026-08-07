import { PlatformSubscriptionsWorkspace } from "@/components/platform/platform-subscriptions-workspace";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { listPlatformSubscriptions } from "@/lib/platform/subscriptions-queries";

export default async function PlatformAbonnementsPage() {
  await requirePlatformAdmin();
  const { subscriptions, plans, error } = await listPlatformSubscriptions();

  return (
    <PlatformSubscriptionsWorkspace
      subscriptions={subscriptions}
      plans={plans}
      error={error}
    />
  );
}
