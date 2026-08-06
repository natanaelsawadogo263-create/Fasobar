import "server-only";

import type { ProductFiltersInput } from "@/lib/products/schemas";
import type {
  CategoryOption,
  DepartmentOption,
  ProductListItem,
} from "@/lib/products/types";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { createClient } from "@/lib/supabase/server";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  selling_price: number;
  unit: string;
  minimum_stock: number;
  active: boolean;
  image_url?: string | null;
  image_original_url?: string | null;
  image_optimized_url?: string | null;
  category_id: string;
  departments: { code: string; name: string } | { code: string; name: string }[] | null;
  categories: { name: string } | { name: string }[] | null;
};

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapProduct(row: ProductRow): ProductListItem | null {
  const department = readSingle(row.departments);
  const category = readSingle(row.categories);

  if (!department || !category) {
    return null;
  }

  const optimized = row.image_optimized_url ?? null;
  const original = row.image_original_url ?? null;
  const legacy = row.image_url ?? null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sellingPrice: row.selling_price,
    unit: row.unit,
    minimumStock: row.minimum_stock,
    active: row.active,
    imageOptimizedUrl: optimized,
    imageOriginalUrl: original,
    imageUrl: optimized ?? original ?? legacy,
    departmentCode: department.code,
    departmentName: department.name,
    categoryId: row.category_id,
    categoryName: category.name,
  };
}

export async function listDepartments(
  workspace: WorkspaceContext,
): Promise<DepartmentOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("departments")
    .select("id, code, name")
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("code");

  if (error || !data) {
    return [];
  }

  return data;
}

export async function listCategories(
  workspace: WorkspaceContext,
): Promise<CategoryOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, departments(code)")
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("name");

  if (error || !data) {
    return [];
  }

  return data.flatMap((row) => {
    const department = readSingle(
      row.departments as { code: string } | { code: string }[] | null,
    );

    if (!department) {
      return [];
    }

    return [
      {
        id: row.id,
        name: row.name,
        departmentCode: department.code,
      },
    ];
  });
}

export async function listProducts(
  workspace: WorkspaceContext,
  filters: ProductFiltersInput,
): Promise<ProductListItem[]> {
  const supabase = await createClient();

  async function runSelect(mode: "full" | "legacy" | "none") {
    const columns =
      mode === "full"
        ? "id, name, slug, description, selling_price, unit, minimum_stock, active, image_url, image_original_url, image_optimized_url, category_id, department_id, departments(code, name), categories(name)"
        : mode === "legacy"
          ? "id, name, slug, description, selling_price, unit, minimum_stock, active, image_url, category_id, department_id, departments(code, name), categories(name)"
          : "id, name, slug, description, selling_price, unit, minimum_stock, active, category_id, department_id, departments(code, name), categories(name)";

    let query = supabase
      .from("products")
      .select(columns)
      .eq("establishment_id", workspace.establishmentId)
      .order("name");

    if (filters.tab === "bar" || filters.tab === "kitchen") {
      const departmentCode = filters.tab === "bar" ? "BAR" : "KITCHEN";
      const departmentId = await getDepartmentIdByCode(workspace, departmentCode);

      if (!departmentId) {
        return { data: [] as unknown[], error: null };
      }

      query = query.eq("department_id", departmentId);
    }

    if (filters.tab === "unavailable") {
      query = query.eq("active", false);
    }

    if (filters.categoryId) {
      query = query.eq("category_id", filters.categoryId);
    }

    if (filters.search) {
      query = query.ilike("name", `%${filters.search}%`);
    }

    return query;
  }

  let { data, error } = await runSelect("full");

  if (
    error?.message?.includes("image_original_url") ||
    error?.message?.includes("image_optimized_url")
  ) {
    const fallback = await runSelect("legacy");
    data = fallback.data;
    error = fallback.error;
  }

  if (error?.message?.includes("image_url")) {
    const fallback = await runSelect("none");
    data = (fallback.data ?? []).map((row) => ({
      ...(row as object),
      image_url: null,
      image_original_url: null,
      image_optimized_url: null,
    }));
    error = fallback.error;
  }

  if (error || !data) {
    return [];
  }

  return data
    .map((row) => mapProduct(row as ProductRow))
    .filter((product): product is ProductListItem => product !== null);
}

export async function getProductById(
  workspace: WorkspaceContext,
  productId: string,
): Promise<ProductListItem | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, description, selling_price, unit, minimum_stock, active, image_url, image_original_url, image_optimized_url, category_id, departments(code, name), categories(name)",
    )
    .eq("id", productId)
    .eq("establishment_id", workspace.establishmentId)
    .maybeSingle();

  if (error?.message?.includes("image_original_url") || error?.message?.includes("image_optimized_url")) {
    const legacy = await supabase
      .from("products")
      .select(
        "id, name, slug, description, selling_price, unit, minimum_stock, active, image_url, category_id, departments(code, name), categories(name)",
      )
      .eq("id", productId)
      .eq("establishment_id", workspace.establishmentId)
      .maybeSingle();

    if (legacy.error || !legacy.data) {
      return null;
    }

    return mapProduct(legacy.data as ProductRow);
  }

  if (error || !data) {
    return null;
  }

  return mapProduct(data as ProductRow);
}

export async function getDepartmentIdByCode(
  workspace: WorkspaceContext,
  departmentCode: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("departments")
    .select("id")
    .eq("establishment_id", workspace.establishmentId)
    .eq("code", departmentCode)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.id;
}

export async function validateCategoryForDepartment(
  workspace: WorkspaceContext,
  categoryId: string,
  departmentId: string,
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("department_id", departmentId)
    .eq("active", true)
    .maybeSingle();

  return !error && Boolean(data);
}
