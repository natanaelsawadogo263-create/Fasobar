import "server-only";

export const MIGRATION_006_SQL = `-- SQLite schema v6 — sale unit snapshots on ticket lines

ALTER TABLE local_order_items ADD COLUMN unit_level_id TEXT;
ALTER TABLE local_order_items ADD COLUMN sale_unit_name TEXT;
ALTER TABLE local_order_items ADD COLUMN sale_unit_factor REAL NOT NULL DEFAULT 1;
ALTER TABLE local_order_items ADD COLUMN stock_quantity REAL NOT NULL DEFAULT 0;
ALTER TABLE local_orders ADD COLUMN stock_posted_at TEXT;
`;
