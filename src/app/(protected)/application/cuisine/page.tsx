import { CuisineSuspense } from "@/app/(protected)/application/cuisine/cuisine-content";
import { requireKitchenContext } from "@/lib/auth/workspace-context";

export default async function CuisinePage() {
  const workspace = await requireKitchenContext();
  return <CuisineSuspense workspace={workspace} />;
}
