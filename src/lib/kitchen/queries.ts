import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type { KitchenOrderTicket } from "@/lib/kitchen/constants";
import type { KitchenStatus } from "@/lib/kitchen/schemas";
import type { OrderType } from "@/lib/orders/schemas";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type KitchenOrderRow = {
  id: string;
  order_number: number;
  table_reference: string | null;
  customer_reference: string | null;
  order_type: OrderType;
  kitchen_status: KitchenStatus;
  kitchen_status_updated_at: string | null;
  created_at: string;
  order_items: Array<{
    id: string;
    product_name_snapshot: string;
    quantity: number;
    notes: string | null;
    departments: { code: string } | { code: string }[] | null;
  }>;
};

export async function listKitchenOrders(
  workspace: WorkspaceContext,
): Promise<KitchenOrderTicket[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      table_reference,
      customer_reference,
      order_type,
      kitchen_status,
      kitchen_status_updated_at,
      created_at,
      order_items (
        id,
        product_name_snapshot,
        quantity,
        notes,
        departments (code)
      )
    `,
    )
    .eq("establishment_id", workspace.establishmentId)
    .eq("organization_id", workspace.organizationId)
    .not("kitchen_status", "is", null)
    .neq("status", "CANCELLED")
    .neq("payment_status", "PAID")
    .order("kitchen_status_updated_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as KitchenOrderRow[]).flatMap((row) => {
    if (!row.kitchen_status) {
      return [];
    }

    const kitchenItems = (row.order_items ?? []).flatMap((item) => {
      const department = readSingle(item.departments);
      if (!department || department.code !== "KITCHEN") {
        return [];
      }

      return [
        {
          id: item.id,
          productName: item.product_name_snapshot,
          quantity: Number(item.quantity),
          notes: item.notes,
        },
      ];
    });

    if (kitchenItems.length === 0) {
      return [];
    }

    return [
      {
        id: row.id,
        orderNumber: row.order_number,
        tableReference: row.table_reference,
        customerReference: row.customer_reference,
        orderType: row.order_type,
        kitchenStatus: row.kitchen_status,
        kitchenStatusUpdatedAt: row.kitchen_status_updated_at,
        createdAt: row.created_at,
        items: kitchenItems,
      },
    ];
  });
}
