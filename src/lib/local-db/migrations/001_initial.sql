-- FasoBar local schema v1 — SERVEUR_CAISSE only
-- SQLite, independent from Supabase migrations

CREATE TABLE IF NOT EXISTS local_schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  checksum TEXT
);

CREATE TABLE IF NOT EXISTS local_installation (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  installation_id TEXT NOT NULL UNIQUE,
  organization_id TEXT,
  establishment_id TEXT,
  machine_id TEXT,
  initialized_at TEXT NOT NULL,
  last_started_at TEXT NOT NULL,
  app_version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS local_users (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  credential_placeholder TEXT,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS local_categories (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  department_code TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS local_products (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  category_id TEXT,
  department_code TEXT NOT NULL,
  department_name TEXT NOT NULL,
  category_name TEXT NOT NULL,
  name TEXT NOT NULL,
  selling_price REAL NOT NULL,
  unit TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  image_path TEXT,
  updated_at TEXT NOT NULL,
  last_synced_at TEXT,
  FOREIGN KEY (category_id) REFERENCES local_categories(id)
);

CREATE TABLE IF NOT EXISTS local_product_packagings (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  packaging_unit TEXT NOT NULL,
  units_per_pack INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  last_synced_at TEXT,
  FOREIGN KEY (product_id) REFERENCES local_products(id)
);

CREATE TABLE IF NOT EXISTS local_orders (
  id TEXT PRIMARY KEY NOT NULL,
  cloud_id TEXT,
  client_mutation_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  local_order_number TEXT NOT NULL UNIQUE,
  cloud_order_number INTEGER,
  status TEXT NOT NULL,
  table_reference TEXT,
  customer_reference TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  created_by TEXT,
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS local_order_items (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  unit_price_snapshot REAL NOT NULL,
  quantity REAL NOT NULL,
  line_total REAL NOT NULL,
  department_code TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES local_orders(id)
);

CREATE TABLE IF NOT EXISTS local_cash_register_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  cloud_id TEXT,
  client_mutation_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  opened_by TEXT,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  opening_float REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  device_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS local_payments (
  id TEXT PRIMARY KEY NOT NULL,
  cloud_id TEXT,
  client_mutation_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  session_id TEXT,
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  created_at TEXT NOT NULL,
  device_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'PENDING',
  FOREIGN KEY (order_id) REFERENCES local_orders(id)
);

CREATE TABLE IF NOT EXISTS local_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  cloud_id TEXT,
  client_mutation_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  local_reference TEXT NOT NULL UNIQUE,
  cloud_reference TEXT,
  created_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'PENDING',
  FOREIGN KEY (order_id) REFERENCES local_orders(id)
);

CREATE TABLE IF NOT EXISTS local_stock_items (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS local_stock_movements (
  id TEXT PRIMARY KEY NOT NULL,
  cloud_id TEXT,
  client_mutation_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity_delta REAL NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  device_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS local_bar_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  cloud_id TEXT,
  client_mutation_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  status TEXT NOT NULL,
  device_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS local_expenses (
  id TEXT PRIMARY KEY NOT NULL,
  cloud_id TEXT,
  client_mutation_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  amount REAL NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  device_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS local_number_sequences (
  name TEXT PRIMARY KEY NOT NULL,
  prefix TEXT NOT NULL,
  next_value INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  client_mutation_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  next_retry_at TEXT,
  last_error TEXT,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_push_at TEXT,
  last_pull_at TEXT,
  last_success_at TEXT,
  last_error_at TEXT,
  last_error TEXT,
  cloud_available INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  pull_cursor TEXT,
  next_sync_at TEXT,
  catalog_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_local_products_establishment
  ON local_products(establishment_id, active);
CREATE INDEX IF NOT EXISTS idx_local_categories_establishment
  ON local_categories(establishment_id, active);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_status
  ON sync_outbox(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_local_orders_mutation
  ON local_orders(client_mutation_id);
