import { ApplicationShell } from "@/components/layout/application-shell";
import { getNavigationForSpace } from "@/lib/navigation/space-navigation";
import { requireWorkspaceContext } from "@/lib/auth/workspace-context";

export default async function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const workspace = await requireWorkspaceContext();

  return (
    <ApplicationShell
      space={workspace.userSpace}
      establishmentId={workspace.establishmentId}
      establishmentName={workspace.establishmentName}
      organizationName={workspace.organizationName}
      organizationId={workspace.organizationId}
      userId={workspace.userId}
      navItems={getNavigationForSpace(workspace.userSpace)}
      cashierName={workspace.ownerName}
      canRenewSubscription={workspace.organizationRole === "OWNER"}
    >
      {children}
    </ApplicationShell>
  );
}
