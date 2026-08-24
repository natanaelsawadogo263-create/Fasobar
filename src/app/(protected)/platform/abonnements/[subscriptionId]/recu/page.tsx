import { notFound } from "next/navigation";

import { PlatformSubscriptionReceiptView } from "@/components/platform/platform-subscription-receipt";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { getPlatformSubscriptionReceipt } from "@/lib/platform/subscriptions-queries";

type PageProps = {
  params: Promise<{ subscriptionId: string }>;
};

export default async function PlatformSubscriptionReceiptPage({
  params,
}: PageProps) {
  await requirePlatformAdmin();
  const { subscriptionId } = await params;

  const receipt = await getPlatformSubscriptionReceipt(subscriptionId);

  if (!receipt) {
    notFound();
  }

  return <PlatformSubscriptionReceiptView receipt={receipt} />;
}
