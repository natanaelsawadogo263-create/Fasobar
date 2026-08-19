import { ApplicationShell } from "@/components/layout/application-shell";
import { getNavigationForSpace } from "@/lib/navigation/space-navigation";
import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getOwnOpenPumpSession } from "@/lib/station/pump-session-queries";

export default async function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const workspace = await requireWorkspaceContext();

  const pompisteSessionSummary =
    workspace.activityCode === "gas_station" &&
    workspace.userSpace === "cashier_kitchen"
      ? await getOwnOpenPumpSession(workspace).then((session) =>
          session
            ? {
                hasOwnSession: true as const,
                sessionOpenedAt: session.openedAt,
                fuelPumpName: session.fuelPumpName,
              }
            : { hasOwnSession: false as const },
        )
      : undefined;

  return (
    <ApplicationShell
      space={workspace.userSpace}
      establishmentId={workspace.establishmentId}
      establishmentName={workspace.establishmentName}
      organizationName={workspace.organizationName}
      organizationId={workspace.organizationId}
      userId={workspace.userId}
      navItems={getNavigationForSpace(
        workspace.userSpace,
        workspace.serviceScope,
        workspace.activityCode,
      )}
      cashierName={workspace.ownerName}
      canRenewSubscription={workspace.organizationRole === "OWNER"}
      activityCode={workspace.activityCode}
      pompisteSessionSummary={pompisteSessionSummary}
    >
      {children}
    </ApplicationShell>
  );
}
