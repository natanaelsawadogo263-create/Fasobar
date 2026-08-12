-- SQLite schema v3 — offline caisse (sessions, orders, payments, receipts)

-- Orders: align with cloud enums / session binding
ALTER TABLE local_orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'ON_SITE';
ALTER TABLE local_orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'UNPAID';
ALTER TABLE local_orders ADD COLUMN notes TEXT;
ALTER TABLE local_orders ADD COLUMN cash_session_id TEXT;
ALTER TABLE local_orders ADD COLUMN local_seq INTEGER;

-- Cash sessions: close / notes / reconciliation
ALTER TABLE local_cash_register_sessions ADD COLUMN opening_note TEXT;
ALTER TABLE local_cash_register_sessions ADD COLUMN closing_note TEXT;
ALTER TABLE local_cash_register_sessions ADD COLUMN expected_cash REAL;
ALTER TABLE local_cash_register_sessions ADD COLUMN counted_cash REAL;
ALTER TABLE local_cash_register_sessions ADD COLUMN cash_difference REAL;
ALTER TABLE local_cash_register_sessions ADD COLUMN closed_by TEXT;

-- Payments: full money fields + idempotency
ALTER TABLE local_payments ADD COLUMN amount_applied REAL;
ALTER TABLE local_payments ADD COLUMN amount_received REAL;
ALTER TABLE local_payments ADD COLUMN change_given REAL NOT NULL DEFAULT 0;
ALTER TABLE local_payments ADD COLUMN status TEXT NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE local_payments ADD COLUMN idempotency_key TEXT;
ALTER TABLE local_payments ADD COLUMN provider TEXT;
ALTER TABLE local_payments ADD COLUMN notes TEXT;

-- Receipts: printable snapshot JSON
ALTER TABLE local_receipts ADD COLUMN payload_json TEXT;
ALTER TABLE local_receipts ADD COLUMN change_given REAL NOT NULL DEFAULT 0;
ALTER TABLE local_receipts ADD COLUMN total_amount REAL;
ALTER TABLE local_receipts ADD COLUMN cashier_name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS local_payments_idempotency_uidx
  ON local_payments(establishment_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS local_cash_sessions_one_open_per_user
  ON local_cash_register_sessions(establishment_id, opened_by)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_local_orders_establishment_status
  ON local_orders(establishment_id, status, payment_status, created_at);

CREATE INDEX IF NOT EXISTS idx_local_orders_session
  ON local_orders(cash_session_id);

CREATE INDEX IF NOT EXISTS idx_local_payments_order
  ON local_payments(order_id, status);

INSERT OR IGNORE INTO local_number_sequences (name, prefix, next_value)
VALUES ('orders', 'LOCAL-CAISSE', 1);

INSERT OR IGNORE INTO local_number_sequences (name, prefix, next_value)
VALUES ('receipts', 'LOCAL-RECU', 1);
