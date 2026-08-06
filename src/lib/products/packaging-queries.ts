import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type { ProductPackaging } from "@/lib/products/types";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PackagingRow = {
  id: string;
  product_id: string;
  name: string;
  packaging_unit: string;
  base_unit: string;
  conversion_factor: number;
  active: boolean;
};

function mapPackaging(row: PackagingRow): ProductPackaging {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    packagingUnit: row.packaging_unit,
    baseUnit: row.base_unit,
    conversionFactor: Number(row.conversion_factor),
    active: row.active,
  };
}

function isMissingTableError(error: { message?: string; code?: string }): boolean {
  const msg = error.message ?? "";
  const code = error.code ?? "";
  return (
    code === "42P01" ||
    msg.includes("relation") ||
    msg.includes("product_packagings") ||
    msg.includes("does not exist")
  );
}

async function getPackagingReadClient(workspace: WorkspaceContext) {
  if (workspace.canManageStock && isAdminClientConfigured()) {
    return createAdminClient();
  }
  if (workspace.canManageProducts && isAdminClientConfigured()) {
    return createAdminClient();
  }
  return createClient();
}

export async function listProductPackagings(
  workspace: WorkspaceContext,
  productId: string,
): Promise<ProductPackaging[]> {
  const supabase = await getPackagingReadClient(workspace);

  const { data, error } = await supabase
    .from("product_packagings")
    .select("id, product_id, name, packaging_unit, base_unit, conversion_factor, active")
    .eq("product_id", productId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("name");

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    return [];
  }

  return (data ?? []).map((row) => mapPackaging(row as PackagingRow));
}

export async function listPackagingsForProducts(
  workspace: WorkspaceContext,
  productIds: string[],
): Promise<Record<string, ProductPackaging[]>> {
  if (productIds.length === 0) {
    return {};
  }

  const supabase = await getPackagingReadClient(workspace);

  const { data, error } = await supabase
    .from("product_packagings")
    .select("id, product_id, name, packaging_unit, base_unit, conversion_factor, active")
    .in("product_id", productIds)
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("name");

  if (error) {
    if (isMissingTableError(error)) {
      return {};
    }
    return {};
  }

  const result: Record<string, ProductPackaging[]> = {};

  for (const row of (data ?? []) as PackagingRow[]) {
    const packaging = mapPackaging(row);
    if (!result[packaging.productId]) {
      result[packaging.productId] = [];
    }
    result[packaging.productId]!.push(packaging);
  }

  return result;
}

export async function getPackagingForValidation(
  workspace: WorkspaceContext,
  packagingId: string,
  productId: string,
): Promise<ProductPackaging | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_packagings")
    .select("id, product_id, name, packaging_unit, base_unit, conversion_factor, active")
    .eq("id", packagingId)
    .eq("product_id", productId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapPackaging(data as PackagingRow);
}
