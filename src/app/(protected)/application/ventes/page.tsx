import { requireAdminContext } from "@/lib/auth/workspace-context";
import { listOrderCashiers } from "@/lib/orders/queries";
import { getAdminSalesData } from "@/lib/sales/queries";
import { salesFiltersSchema } from "@/lib/sales/schemas";
import { AdminSalesWorkspace } from "@/components/admin/admin-sales-workspace";

type VentesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VentesPage({ searchParams }: VentesPageProps) {
  const workspace = await requireAdminContext();
  const raw = await searchParams;

  const parsed = salesFiltersSchema.safeParse({
    from: typeof raw.from === "string" ? raw.from : undefined,
    to: typeof raw.to === "string" ? raw.to : undefined,
    cashierId: typeof raw.cashierId === "string" ? raw.cashierId : undefined,
  });

  const filters = parsed.success ? parsed.data : {};

  const [data, cashiers] = await Promise.all([
    getAdminSalesData(workspace, filters),
    listOrderCashiers(workspace),
  ]);

  return (
    <AdminSalesWorkspace
      data={data}
      filters={filters}
      cashiers={cashiers}
      establishmentName={workspace.establishmentName}
      serviceScope={workspace.serviceScope}
    />
  );
}
