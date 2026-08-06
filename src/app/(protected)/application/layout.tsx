import { ApplicationShell } from "@/components/layout/application-shell";
import { getNavigationForSpace } from "@/lib/navigation/space-navigation";
import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getBarSessionContext } from "@/lib/bar/session-queries";
import { listOpenOrders } from "@/lib/orders/queries";
import { getActiveCashSession } from "@/lib/payments/queries";
import { listStockItems } from "@/lib/stock/queries";

export default async function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const workspace = await requireWorkspaceContext();

  let shellExtras = {
    cashierName: workspace.ownerName,
    hasSession: false,
    sessionOpenedAt: undefined as string | undefined,
    openSessionHolderName: null as string | null,
    openOrdersCount: 0,
    readyToPayCount: 0,
    notificationCount: 0,
  };

  if (workspace.userSpace === "cashier_kitchen") {
    const [session, openOrders] = await Promise.all([
      getActiveCashSession(workspace),
      listOpenOrders(workspace),
    ]);

    shellExtras = {
      cashierName: workspace.ownerName,
      hasSession: session !== null,
      sessionOpenedAt: session?.openedAt,
      openSessionHolderName: null,
      openOrdersCount: openOrders.length,
      readyToPayCount: openOrders.filter((order) => order.status === "READY_TO_PAY")
        .length,
      notificationCount: 0,
    };
  }

  if (workspace.userSpace === "admin") {
    const alerts = await listStockItems(workspace, {
      tab: "alerts",
      status: "all",
    });
    shellExtras = {
      ...shellExtras,
      cashierName: workspace.ownerName,
      notificationCount: alerts.length,
    };

    return (
      <ApplicationShell
        space={workspace.userSpace}
        establishmentId={workspace.establishmentId}
        establishmentName={workspace.establishmentName}
        organizationName={workspace.organizationName}
        navItems={getNavigationForSpace("admin")}
        {...shellExtras}
      >
        {children}
      </ApplicationShell>
    );
  }

  if (workspace.userSpace === "bar_manager") {
    const { ownSession, openSession } = await getBarSessionContext(workspace);

    shellExtras = {
      ...shellExtras,
      cashierName: workspace.ownerName,
      hasSession: ownSession !== null,
      sessionOpenedAt: ownSession?.openedAt ?? openSession?.openedAt,
      openSessionHolderName:
        openSession && !openSession.isOwnSession
          ? openSession.openedByName
          : null,
    };

    return (
      <ApplicationShell
        space={workspace.userSpace}
        establishmentId={workspace.establishmentId}
        establishmentName={workspace.establishmentName}
        organizationName={workspace.organizationName}
        navItems={getNavigationForSpace("bar_manager")}
        {...shellExtras}
      >
        {children}
      </ApplicationShell>
    );
  }

  return (
    <ApplicationShell
      space={workspace.userSpace}
      establishmentId={workspace.establishmentId}
      establishmentName={workspace.establishmentName}
      organizationName={workspace.organizationName}
      navItems={getNavigationForSpace("cashier_kitchen")}
      {...shellExtras}
    >
      {children}
    </ApplicationShell>
  );
}
