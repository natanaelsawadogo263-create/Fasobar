import "server-only";

export const MIGRATION_005_SQL = `-- SQLite schema v5 — prepared_quantity for bar/kitchen delta tickets

ALTER TABLE local_order_items ADD COLUMN prepared_quantity REAL NOT NULL DEFAULT 0;
`;
