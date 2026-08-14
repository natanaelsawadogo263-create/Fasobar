import "server-only";

import type { CashierCategory, CashierProduct } from "@/lib/orders/types";
import { resolveCashierStockQuantity } from "@/lib/orders/stock-availability";
import type { SqlDatabase } from "@/lib/local-db/types";

export type LocalProductUpsert = {
  id: string;
  organizationId: string;
  establishmentId: string;
  categoryId: string | null;
  departmentCode: string;
  departmentName: string;
  categoryName: string;
  name: string;
  sellingPrice: number;
  unit: string;
  active: boolean;
  imageUrl: string | null;
  updatedAt: string;
};

export type LocalCategoryUpsert = {
  id: string;
  organizationId: string;
  establishmentId: string;
  departmentCode: string;
  name: string;
  active: boolean;
  updatedAt: string;
};

export type LocalPackagingUpsert = {
  id: string;
  productId: string;
  organizationId: string;
  establishmentId: string;
  packagingUnit: string;
  unitsPerPack: number;
  active: boolean;
  updatedAt: string;
};

export class LocalProductRepository {
  constructor(private readonly db: SqlDatabase) {}

  upsertCategory(row: LocalCategoryUpsert): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO local_categories (
          id, organization_id, establishment_id, department_code, name, active, updated_at, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          organization_id = excluded.organization_id,
          establishment_id = excluded.establishment_id,
          department_code = excluded.department_code,
          name = excluded.name,
          active = excluded.active,
          updated_at = excluded.updated_at,
          last_synced_at = excluded.last_synced_at`,
      )
      .run(
        row.id,
        row.organizationId,
        row.establishmentId,
        row.departmentCode,
        row.name,
        row.active ? 1 : 0,
        row.updatedAt,
        now,
      );
  }

  upsertProduct(row: LocalProductUpsert): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO local_products (
          id, organization_id, establishment_id, category_id, department_code, department_name,
          category_name, name, selling_price, unit, active, image_url, image_path, updated_at, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          organization_id = excluded.organization_id,
          establishment_id = excluded.establishment_id,
          category_id = excluded.category_id,
          department_code = excluded.department_code,
          department_name = excluded.department_name,
          category_name = excluded.category_name,
          name = excluded.name,
          selling_price = excluded.selling_price,
          unit = excluded.unit,
          active = excluded.active,
          image_url = excluded.image_url,
          updated_at = excluded.updated_at,
          last_synced_at = excluded.last_synced_at`,
      )
      .run(
        row.id,
        row.organizationId,
        row.establishmentId,
        row.categoryId,
        row.departmentCode,
        row.departmentName,
        row.categoryName,
        row.name,
        row.sellingPrice,
        row.unit,
        row.active ? 1 : 0,
        row.imageUrl,
        row.updatedAt,
        now,
      );
  }

  upsertPackaging(row: LocalPackagingUpsert): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO local_product_packagings (
          id, product_id, organization_id, establishment_id, packaging_unit,
          units_per_pack, active, updated_at, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          product_id = excluded.product_id,
          packaging_unit = excluded.packaging_unit,
          units_per_pack = excluded.units_per_pack,
          active = excluded.active,
          updated_at = excluded.updated_at,
          last_synced_at = excluded.last_synced_at`,
      )
      .run(
        row.id,
        row.productId,
        row.organizationId,
        row.establishmentId,
        row.packagingUnit,
        row.unitsPerPack,
        row.active ? 1 : 0,
        row.updatedAt,
        now,
      );
  }

  listCashierProducts(establishmentId: string): CashierProduct[] {
    const rows = this.db
      .prepare(
        `SELECT p.id, p.name, p.selling_price, p.unit, p.image_url, p.department_code,
                p.department_name, p.category_id, p.category_name,
                MIN(s.quantity) AS stock_quantity
         FROM local_products p
         LEFT JOIN local_stock_items s
           ON s.product_id = p.id AND s.establishment_id = p.establishment_id
         WHERE p.establishment_id = ? AND p.active = 1
         GROUP BY p.id
         ORDER BY p.name COLLATE NOCASE`,
      )
      .all(establishmentId);

    const stockCount = this.db
      .prepare(
        "SELECT COUNT(*) AS c FROM local_stock_items WHERE establishment_id = ?",
      )
      .get(establishmentId);
    const hasStockCatalog = Number(stockCount?.c ?? 0) > 0;

    return rows.map((row) => {
      const rawStock = row.stock_quantity;
      const parsed =
        rawStock === null || rawStock === undefined ? null : Number(rawStock);
      const fromJoin =
        parsed !== null && Number.isFinite(parsed) ? parsed : null;
      const qtyByProductId = new Map<string, number>();
      if (fromJoin !== null) {
        qtyByProductId.set(String(row.id), fromJoin);
      }
      return {
        id: String(row.id),
        name: String(row.name),
        sellingPrice: Number(row.selling_price),
        unit: String(row.unit),
        imageUrl: (row.image_url as string | null) ?? null,
        departmentCode: String(row.department_code),
        departmentName: String(row.department_name),
        categoryId: String(row.category_id ?? ""),
        categoryName: String(row.category_name),
        stockQuantity: resolveCashierStockQuantity(
          {
            id: String(row.id),
            name: String(row.name),
            departmentCode: String(row.department_code),
          },
          qtyByProductId,
          new Map(),
          hasStockCatalog,
        ),
      };
    });
  }

  listCashierCategories(establishmentId: string): CashierCategory[] {
    const rows = this.db
      .prepare(
        `SELECT id, name, department_code
         FROM local_categories
         WHERE establishment_id = ? AND active = 1
         ORDER BY name COLLATE NOCASE`,
      )
      .all(establishmentId);

    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      departmentCode: String(row.department_code),
    }));
  }

  countProducts(establishmentId: string): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) AS c FROM local_products WHERE establishment_id = ?",
      )
      .get(establishmentId);
    return Number(row?.c ?? 0);
  }
}
