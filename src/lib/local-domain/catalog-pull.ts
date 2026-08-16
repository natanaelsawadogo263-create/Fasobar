import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { appendDesktopLog } from "@/lib/desktop/logger";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import { getLocalDatabase } from "@/lib/local-db/database";
import { withTransaction } from "@/lib/local-db/transaction";
import { LocalProductRepository } from "@/lib/local-domain/products-repository";
import { createClient } from "@/lib/supabase/server";
import { markCatalogPulled, markCloudAvailability } from "@/lib/sync/status";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Pull establishment catalogue from Supabase into SQLite (desktop-server only).
 * Safe no-op on web. Failures mark cloud unavailable but do not throw to UI.
 */
export async function pullCatalogFromCloud(
  workspace: WorkspaceContext,
): Promise<{ ok: boolean; productCount: number; error?: string }> {
  if (!isDesktopServerRuntime()) {
    return { ok: false, productCount: 0, error: "not_desktop" };
  }

  const db = getLocalDatabase({ skipBackup: true });
  const bound = db
    .prepare(
      "SELECT organization_id AS organizationId, establishment_id AS establishmentId FROM local_installation WHERE id = 1",
    )
    .get() as { organizationId?: string | null; establishmentId?: string | null } | undefined;
  if (
    bound?.organizationId &&
    bound?.establishmentId &&
    (bound.organizationId !== workspace.organizationId ||
      bound.establishmentId !== workspace.establishmentId)
  ) {
    return {
      ok: false,
      productCount: 0,
      error:
        "Cette machine est déjà liée à un autre établissement. Les données ne peuvent pas être mélangées.",
    };
  }

  const repo = new LocalProductRepository(db);

  try {
    const supabase = await createClient();

    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("id, name, active, updated_at, departments(code)")
      .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId);

    if (catError) {
      throw new Error(catError.message);
    }

    const { data: products, error: prodError } = await supabase
      .from("products")
      .select(
        "id, name, selling_price, unit, active, updated_at, category_id, image_url, image_original_url, image_optimized_url, departments(code, name), categories(name)",
      )
      .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId);

    if (prodError) {
      // Legacy schema without image_* columns
      if (
        prodError.message.includes("image_original_url") ||
        prodError.message.includes("image_optimized_url")
      ) {
        const legacy = await supabase
          .from("products")
          .select(
            "id, name, selling_price, unit, active, updated_at, category_id, image_url, departments(code, name), categories(name)",
          )
          .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId);
        if (legacy.error) throw new Error(legacy.error.message);
        return persistCatalog(
          db,
          repo,
          workspace,
          categories ?? [],
          (legacy.data as Array<Record<string, unknown>>) ?? [],
        );
      }
      throw new Error(prodError.message);
    }

    let packagings: Array<Record<string, unknown>> = [];
    const { data: packs, error: packError } = await supabase
      .from("product_packagings")
      .select(
        "id, product_id, packaging_unit, units_per_pack, active, updated_at",
      )
      .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId);

    if (!packError && packs) {
      packagings = packs as Array<Record<string, unknown>>;
    }

    return persistCatalog(
      db,
      repo,
      workspace,
      categories ?? [],
      (products as Array<Record<string, unknown>>) ?? [],
      packagings,
    );
  } catch (error) {
    const message = String(error);
    markCloudAvailability(db, false, message);
    appendDesktopLog("catalog", "warn", "Catalog pull failed", {
      error: message,
    });
    return { ok: false, productCount: repo.countProducts(workspace.establishmentId), error: message };
  }
}

function persistCatalog(
  db: ReturnType<typeof getLocalDatabase>,
  repo: LocalProductRepository,
  workspace: WorkspaceContext,
  categories: Array<Record<string, unknown>>,
  products: Array<Record<string, unknown>>,
  packagings: Array<Record<string, unknown>> = [],
): { ok: boolean; productCount: number } {
  const now = new Date().toISOString();
  let maxUpdated = now;

  withTransaction(db, () => {
    for (const row of categories) {
      const department = readSingle(
        row.departments as { code: string } | { code: string }[] | null,
      );
      if (!department) continue;
      const updatedAt = String(row.updated_at ?? now);
      if (updatedAt > maxUpdated) maxUpdated = updatedAt;
      repo.upsertCategory({
        id: String(row.id),
        organizationId: workspace.organizationId,
        establishmentId: workspace.establishmentId,
        departmentCode: department.code,
        name: String(row.name),
        active: row.active !== false && Number(row.active) !== 0,
        updatedAt,
      });
    }

    for (const row of products) {
      const department = readSingle(
        row.departments as
          | { code: string; name: string }
          | { code: string; name: string }[]
          | null,
      );
      const category = readSingle(
        row.categories as { name: string } | { name: string }[] | null,
      );
      if (!department || !category) continue;

      const updatedAt = String(row.updated_at ?? now);
      if (updatedAt > maxUpdated) maxUpdated = updatedAt;

      const optimized = (row.image_optimized_url as string | null | undefined) ?? null;
      const original = (row.image_original_url as string | null | undefined) ?? null;
      const legacy = (row.image_url as string | null | undefined) ?? null;

      repo.upsertProduct({
        id: String(row.id),
        organizationId: workspace.organizationId,
        establishmentId: workspace.establishmentId,
        categoryId: (row.category_id as string | null) ?? null,
        departmentCode: department.code,
        departmentName: department.name,
        categoryName: category.name,
        name: String(row.name),
        sellingPrice: Number(row.selling_price),
        unit: String(row.unit),
        active: row.active !== false && Number(row.active) !== 0,
        imageUrl: optimized ?? original ?? legacy,
        updatedAt,
      });
    }

    for (const row of packagings) {
      const updatedAt = String(row.updated_at ?? now);
      repo.upsertPackaging({
        id: String(row.id),
        productId: String(row.product_id),
        organizationId: workspace.organizationId,
        establishmentId: workspace.establishmentId,
        packagingUnit: String(row.packaging_unit),
        unitsPerPack: Number(row.units_per_pack),
        active: row.active !== false && Number(row.active) !== 0,
        updatedAt,
      });
    }

    markCatalogPulled(db, maxUpdated, maxUpdated);
  });

  // Bind installation tenant ids (nullable → set on first successful pull)
  db.prepare(
    `UPDATE local_installation
     SET organization_id = ?,
         establishment_id = ?
     WHERE id = 1
       AND (organization_id IS NULL OR organization_id = ?)
       AND (establishment_id IS NULL OR establishment_id = ?)`,
  ).run(
    workspace.organizationId,
    workspace.establishmentId,
    workspace.organizationId,
    workspace.establishmentId,
  );

  const productCount = repo.countProducts(workspace.establishmentId);
  appendDesktopLog("catalog", "info", "Catalog pulled", { productCount });
  markCloudAvailability(db, true);
  return { ok: true, productCount };
}
