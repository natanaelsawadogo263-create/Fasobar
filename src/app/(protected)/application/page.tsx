import { redirect } from "next/navigation";

import { requireWorkspaceContext } from "@/lib/auth/workspace-context";

export default async function ApplicationIndexPage() {
  const workspace = await requireWorkspaceContext();
  redirect(workspace.homePath);
}
