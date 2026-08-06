"use client";

import { BarDashboardWorkspace } from "@/components/bar/bar-dashboard-workspace";
import { BarShell } from "@/components/bar/bar-shell";
import type { BarDashboardData } from "@/lib/bar/queries";
import { BAR_MANAGER_NAV } from "@/lib/navigation/space-navigation";

const MOCK: BarDashboardData = {
  toPrepare: 3,
  inPreparation: 2,
  ready: 4,
  lowStock: 3,
  recentOrders: [
    {
      id: "1",
      orderNumber: 1261,
      tableReference: "Table 07",
      customerReference: null,
      orderType: "ON_SITE",
      barStatus: "TO_PREPARE",
      barStatusUpdatedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
      items: [
        { id: "a", productName: "Brakina", quantity: 2, notes: null },
        { id: "b", productName: "Coca", quantity: 1, notes: null },
      ],
    },
    {
      id: "2",
      orderNumber: 1260,
      tableReference: "Table 03",
      customerReference: null,
      orderType: "ON_SITE",
      barStatus: "IN_PREPARATION",
      barStatusUpdatedAt: new Date(Date.now() - 8 * 60_000).toISOString(),
      createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
      items: [
        { id: "c", productName: "Mojito", quantity: 1, notes: null },
        { id: "d", productName: "Eau minérale", quantity: 1, notes: null },
      ],
    },
    {
      id: "3",
      orderNumber: 1258,
      tableReference: "Table 12",
      customerReference: null,
      orderType: "TAKEAWAY",
      barStatus: "READY",
      barStatusUpdatedAt: new Date(Date.now() - 15 * 60_000).toISOString(),
      createdAt: new Date(Date.now() - 15 * 60_000).toISOString(),
      items: [{ id: "e", productName: "Castel", quantity: 3, notes: null }],
    },
  ],
  stockAlerts: [
    {
      id: "s1",
      name: "Eau minérale",
      currentQuantity: 8,
      minimumQuantity: 10,
      unit: "BOTTLE",
      status: "low",
    },
    {
      id: "s2",
      name: "Coca-Cola",
      currentQuantity: 5,
      minimumQuantity: 12,
      unit: "BOTTLE",
      status: "low",
    },
    {
      id: "s3",
      name: "Castel",
      currentQuantity: 0,
      minimumQuantity: 10,
      unit: "BOTTLE",
      status: "out",
    },
  ],
};

export default function BarDashboardPreviewPage() {
  return (
    <div className="h-dvh w-full overflow-hidden">
      <BarShell establishmentName="Maquis" navItems={BAR_MANAGER_NAV}>
        <BarDashboardWorkspace data={MOCK} />
      </BarShell>
    </div>
  );
}
