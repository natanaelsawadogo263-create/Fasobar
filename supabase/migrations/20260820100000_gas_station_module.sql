-- FasoBar: Gas Station / Station-service module
-- Tables: fuel_types, fuel_tanks, fuel_pumps, pump_sessions, pump_session_payments,
--         fuel_deliveries, fuel_losses, fuel_tank_gauges, station_credits, station_credit_payments

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE public.pump_session_status AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE public.fuel_tank_movement_type AS ENUM (
  'DELIVERY',
  'SALE',
  'LOSS',
  'ADJUSTMENT',
  'GAUGE_CORRECTION'
);
CREATE TYPE public.station_credit_status AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'CANCELLED');

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'PUMP_SESSION_OPENED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'PUMP_SESSION_CLOSED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'FUEL_DELIVERY_RECORDED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'FUEL_LOSS_RECORDED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'FUEL_GAUGE_RECORDED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'STATION_CREDIT_CREATED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'STATION_CREDIT_PAYMENT';

-- ---------------------------------------------------------------------------
-- fuel_types — carburants gérés par l'établissement
-- ---------------------------------------------------------------------------

CREATE TABLE public.fuel_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  name text NOT NULL,
  selling_price integer NOT NULL,
  minimum_stock numeric(14, 3) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fuel_types_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT fuel_types_selling_price_positive CHECK (selling_price > 0),
  CONSTRAINT fuel_types_minimum_stock_non_negative CHECK (minimum_stock >= 0)
);

CREATE INDEX fuel_types_establishment_id_idx ON public.fuel_types (establishment_id);
CREATE UNIQUE INDEX fuel_types_unique_name
  ON public.fuel_types (establishment_id, lower(btrim(name)))
  WHERE active;

-- ---------------------------------------------------------------------------
-- fuel_type_prices — historique des prix carburant
-- ---------------------------------------------------------------------------

CREATE TABLE public.fuel_type_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_type_id uuid NOT NULL REFERENCES public.fuel_types (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  price integer NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fuel_type_prices_price_positive CHECK (price > 0)
);

CREATE INDEX fuel_type_prices_fuel_type_id_idx ON public.fuel_type_prices (fuel_type_id);
CREATE INDEX fuel_type_prices_establishment_id_idx ON public.fuel_type_prices (establishment_id);

-- ---------------------------------------------------------------------------
-- fuel_tanks — cuves de stockage
-- ---------------------------------------------------------------------------

CREATE TABLE public.fuel_tanks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  fuel_type_id uuid NOT NULL REFERENCES public.fuel_types (id) ON DELETE RESTRICT,
  name text NOT NULL,
  capacity numeric(14, 3) NOT NULL,
  current_volume numeric(14, 3) NOT NULL DEFAULT 0,
  minimum_volume numeric(14, 3) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fuel_tanks_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT fuel_tanks_capacity_positive CHECK (capacity > 0),
  CONSTRAINT fuel_tanks_current_volume_non_negative CHECK (current_volume >= 0),
  CONSTRAINT fuel_tanks_minimum_volume_non_negative CHECK (minimum_volume >= 0),
  CONSTRAINT fuel_tanks_volume_within_capacity CHECK (current_volume <= capacity)
);

CREATE INDEX fuel_tanks_establishment_id_idx ON public.fuel_tanks (establishment_id);
CREATE INDEX fuel_tanks_fuel_type_id_idx ON public.fuel_tanks (fuel_type_id);

-- ---------------------------------------------------------------------------
-- fuel_tank_movements — traçabilité de chaque mouvement cuve
-- ---------------------------------------------------------------------------

CREATE TABLE public.fuel_tank_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  fuel_tank_id uuid NOT NULL REFERENCES public.fuel_tanks (id) ON DELETE RESTRICT,
  type public.fuel_tank_movement_type NOT NULL,
  quantity numeric(14, 3) NOT NULL,
  volume_before numeric(14, 3) NOT NULL,
  volume_after numeric(14, 3) NOT NULL,
  reference_id uuid,
  reason text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fuel_tank_movements_fuel_tank_id_idx ON public.fuel_tank_movements (fuel_tank_id);
CREATE INDEX fuel_tank_movements_establishment_id_idx ON public.fuel_tank_movements (establishment_id);
CREATE INDEX fuel_tank_movements_type_idx ON public.fuel_tank_movements (type);
CREATE INDEX fuel_tank_movements_created_at_idx ON public.fuel_tank_movements (created_at);

-- ---------------------------------------------------------------------------
-- fuel_pumps — pompes/distributeurs
-- ---------------------------------------------------------------------------

CREATE TABLE public.fuel_pumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  fuel_type_id uuid NOT NULL REFERENCES public.fuel_types (id) ON DELETE RESTRICT,
  fuel_tank_id uuid NOT NULL REFERENCES public.fuel_tanks (id) ON DELETE RESTRICT,
  name text NOT NULL,
  current_index numeric(14, 3) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fuel_pumps_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT fuel_pumps_current_index_non_negative CHECK (current_index >= 0)
);

CREATE INDEX fuel_pumps_establishment_id_idx ON public.fuel_pumps (establishment_id);
CREATE INDEX fuel_pumps_fuel_type_id_idx ON public.fuel_pumps (fuel_type_id);
CREATE INDEX fuel_pumps_fuel_tank_id_idx ON public.fuel_pumps (fuel_tank_id);

-- ---------------------------------------------------------------------------
-- pump_sessions — cœur métier : session de travail pompiste
-- ---------------------------------------------------------------------------

CREATE TABLE public.pump_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  fuel_pump_id uuid NOT NULL REFERENCES public.fuel_pumps (id) ON DELETE RESTRICT,
  fuel_type_id uuid NOT NULL REFERENCES public.fuel_types (id) ON DELETE RESTRICT,
  fuel_tank_id uuid NOT NULL REFERENCES public.fuel_tanks (id) ON DELETE RESTRICT,
  opened_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  closed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  status public.pump_session_status NOT NULL DEFAULT 'OPEN',
  price_per_liter integer NOT NULL,
  index_start numeric(14, 3) NOT NULL,
  index_end numeric(14, 3),
  liters_sold numeric(14, 3),
  expected_amount integer,
  total_collected integer DEFAULT 0,
  credit_amount integer DEFAULT 0,
  cash_difference integer,
  index_gap_from_previous numeric(14, 3),
  index_gap_reason text,
  opening_note text,
  closing_note text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pump_sessions_price_positive CHECK (price_per_liter > 0),
  CONSTRAINT pump_sessions_index_start_non_negative CHECK (index_start >= 0),
  CONSTRAINT pump_sessions_index_end_valid CHECK (
    index_end IS NULL OR index_end >= index_start
  ),
  CONSTRAINT pump_sessions_liters_non_negative CHECK (
    liters_sold IS NULL OR liters_sold >= 0
  )
);

CREATE UNIQUE INDEX pump_sessions_one_open_per_pump
  ON public.pump_sessions (establishment_id, fuel_pump_id)
  WHERE status = 'OPEN';

CREATE UNIQUE INDEX pump_sessions_one_open_per_user
  ON public.pump_sessions (establishment_id, opened_by)
  WHERE status = 'OPEN';

CREATE INDEX pump_sessions_establishment_id_idx ON public.pump_sessions (establishment_id);
CREATE INDEX pump_sessions_fuel_pump_id_idx ON public.pump_sessions (fuel_pump_id);
CREATE INDEX pump_sessions_opened_by_idx ON public.pump_sessions (opened_by);
CREATE INDEX pump_sessions_status_idx ON public.pump_sessions (status);
CREATE INDEX pump_sessions_opened_at_idx ON public.pump_sessions (opened_at);

-- ---------------------------------------------------------------------------
-- pump_session_payments — encaissements déclarés à la clôture
-- ---------------------------------------------------------------------------

CREATE TABLE public.pump_session_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pump_session_id uuid NOT NULL REFERENCES public.pump_sessions (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  method public.payment_method NOT NULL,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pump_session_payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX pump_session_payments_session_id_idx ON public.pump_session_payments (pump_session_id);

-- ---------------------------------------------------------------------------
-- fuel_deliveries — réceptions carburant
-- ---------------------------------------------------------------------------

CREATE TABLE public.fuel_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  fuel_type_id uuid NOT NULL REFERENCES public.fuel_types (id) ON DELETE RESTRICT,
  fuel_tank_id uuid NOT NULL REFERENCES public.fuel_tanks (id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES public.suppliers (id) ON DELETE SET NULL,
  quantity numeric(14, 3) NOT NULL,
  purchase_price_per_liter integer,
  total_cost integer,
  volume_before numeric(14, 3),
  volume_after numeric(14, 3),
  received_on date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fuel_deliveries_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX fuel_deliveries_establishment_id_idx ON public.fuel_deliveries (establishment_id);
CREATE INDEX fuel_deliveries_fuel_tank_id_idx ON public.fuel_deliveries (fuel_tank_id);
CREATE INDEX fuel_deliveries_received_on_idx ON public.fuel_deliveries (received_on);

-- ---------------------------------------------------------------------------
-- fuel_losses — pertes / déversements / fuites
-- ---------------------------------------------------------------------------

CREATE TABLE public.fuel_losses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  fuel_type_id uuid NOT NULL REFERENCES public.fuel_types (id) ON DELETE RESTRICT,
  fuel_tank_id uuid NOT NULL REFERENCES public.fuel_tanks (id) ON DELETE RESTRICT,
  quantity numeric(14, 3) NOT NULL,
  reason text NOT NULL,
  loss_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fuel_losses_quantity_positive CHECK (quantity > 0),
  CONSTRAINT fuel_losses_reason_not_blank CHECK (btrim(reason) <> '')
);

CREATE INDEX fuel_losses_establishment_id_idx ON public.fuel_losses (establishment_id);
CREATE INDEX fuel_losses_fuel_tank_id_idx ON public.fuel_losses (fuel_tank_id);

-- ---------------------------------------------------------------------------
-- fuel_tank_gauges — contrôles de stock réel (jaugeage)
-- ---------------------------------------------------------------------------

CREATE TABLE public.fuel_tank_gauges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  fuel_tank_id uuid NOT NULL REFERENCES public.fuel_tanks (id) ON DELETE RESTRICT,
  theoretical_volume numeric(14, 3) NOT NULL,
  actual_volume numeric(14, 3) NOT NULL,
  difference numeric(14, 3) NOT NULL,
  notes text,
  gauged_on date NOT NULL DEFAULT CURRENT_DATE,
  gauged_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fuel_tank_gauges_actual_non_negative CHECK (actual_volume >= 0)
);

CREATE INDEX fuel_tank_gauges_fuel_tank_id_idx ON public.fuel_tank_gauges (fuel_tank_id);
CREATE INDEX fuel_tank_gauges_gauged_on_idx ON public.fuel_tank_gauges (gauged_on);

-- ---------------------------------------------------------------------------
-- station_credits — crédits carburant (vente à crédit)
-- ---------------------------------------------------------------------------

CREATE TABLE public.station_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  pump_session_id uuid REFERENCES public.pump_sessions (id) ON DELETE SET NULL,
  fuel_type_id uuid REFERENCES public.fuel_types (id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  liters numeric(14, 3),
  amount integer NOT NULL,
  amount_paid integer NOT NULL DEFAULT 0,
  status public.station_credit_status NOT NULL DEFAULT 'OPEN',
  credit_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT station_credits_customer_name_not_blank CHECK (btrim(customer_name) <> ''),
  CONSTRAINT station_credits_amount_positive CHECK (amount > 0),
  CONSTRAINT station_credits_amount_paid_non_negative CHECK (amount_paid >= 0),
  CONSTRAINT station_credits_amount_paid_within_total CHECK (amount_paid <= amount)
);

CREATE INDEX station_credits_establishment_id_idx ON public.station_credits (establishment_id);
CREATE INDEX station_credits_status_idx ON public.station_credits (status);
CREATE INDEX station_credits_credit_date_idx ON public.station_credits (credit_date);

-- ---------------------------------------------------------------------------
-- station_credit_payments — encaissements de crédits antérieurs
-- ---------------------------------------------------------------------------

CREATE TABLE public.station_credit_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_credit_id uuid NOT NULL REFERENCES public.station_credits (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  amount integer NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'CASH',
  received_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  received_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT station_credit_payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX station_credit_payments_credit_id_idx ON public.station_credit_payments (station_credit_id);

-- ---------------------------------------------------------------------------
-- RLS — toutes les tables station-service
-- ---------------------------------------------------------------------------

ALTER TABLE public.fuel_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_types FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_type_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_type_prices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_tanks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_tank_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_tank_movements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_pumps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_pumps FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pump_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pump_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pump_session_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pump_session_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_losses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_tank_gauges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_tank_gauges FORCE ROW LEVEL SECURITY;
ALTER TABLE public.station_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_credits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.station_credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_credit_payments FORCE ROW LEVEL SECURITY;

-- Helper: user belongs to establishment (reuses existing pattern)
-- SELECT policies — any authenticated member of the establishment
CREATE POLICY fuel_types_select ON public.fuel_types FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY fuel_type_prices_select ON public.fuel_type_prices FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY fuel_tanks_select ON public.fuel_tanks FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY fuel_tank_movements_select ON public.fuel_tank_movements FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY fuel_pumps_select ON public.fuel_pumps FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY pump_sessions_select ON public.pump_sessions FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY pump_session_payments_select ON public.pump_session_payments FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY fuel_deliveries_select ON public.fuel_deliveries FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY fuel_losses_select ON public.fuel_losses FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY fuel_tank_gauges_select ON public.fuel_tank_gauges FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY station_credits_select ON public.station_credits FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY station_credit_payments_select ON public.station_credit_payments FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));

-- INSERT/UPDATE — admin only for config tables
CREATE POLICY fuel_types_insert ON public.fuel_types FOR INSERT TO authenticated
  WITH CHECK (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id));
CREATE POLICY fuel_types_update ON public.fuel_types FOR UPDATE TO authenticated
  USING (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id))
  WITH CHECK (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id));

CREATE POLICY fuel_type_prices_insert ON public.fuel_type_prices FOR INSERT TO authenticated
  WITH CHECK (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id));

CREATE POLICY fuel_tanks_insert ON public.fuel_tanks FOR INSERT TO authenticated
  WITH CHECK (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id));
CREATE POLICY fuel_tanks_update ON public.fuel_tanks FOR UPDATE TO authenticated
  USING (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id))
  WITH CHECK (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id));

CREATE POLICY fuel_pumps_insert ON public.fuel_pumps FOR INSERT TO authenticated
  WITH CHECK (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id));
CREATE POLICY fuel_pumps_update ON public.fuel_pumps FOR UPDATE TO authenticated
  USING (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id))
  WITH CHECK (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id));

-- Pump sessions — any member can insert (pompiste opens session)
CREATE POLICY pump_sessions_insert ON public.pump_sessions FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY pump_sessions_update ON public.pump_sessions FOR UPDATE TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));

CREATE POLICY pump_session_payments_insert ON public.pump_session_payments FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));

-- Deliveries, losses, gauges — admin only
CREATE POLICY fuel_deliveries_insert ON public.fuel_deliveries FOR INSERT TO authenticated
  WITH CHECK (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id));
CREATE POLICY fuel_losses_insert ON public.fuel_losses FOR INSERT TO authenticated
  WITH CHECK (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id));
CREATE POLICY fuel_tank_gauges_insert ON public.fuel_tank_gauges FOR INSERT TO authenticated
  WITH CHECK (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id));

-- Tank movements — immutable (insert-only via RPCs)
CREATE POLICY fuel_tank_movements_insert ON public.fuel_tank_movements FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));

-- Credits — any member can create (pompiste declares credit)
CREATE POLICY station_credits_insert ON public.station_credits FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY station_credits_update ON public.station_credits FOR UPDATE TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
CREATE POLICY station_credit_payments_insert ON public.station_credit_payments FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.fuel_types FROM anon;
REVOKE ALL ON TABLE public.fuel_type_prices FROM anon;
REVOKE ALL ON TABLE public.fuel_tanks FROM anon;
REVOKE ALL ON TABLE public.fuel_tank_movements FROM anon;
REVOKE ALL ON TABLE public.fuel_pumps FROM anon;
REVOKE ALL ON TABLE public.pump_sessions FROM anon;
REVOKE ALL ON TABLE public.pump_session_payments FROM anon;
REVOKE ALL ON TABLE public.fuel_deliveries FROM anon;
REVOKE ALL ON TABLE public.fuel_losses FROM anon;
REVOKE ALL ON TABLE public.fuel_tank_gauges FROM anon;
REVOKE ALL ON TABLE public.station_credits FROM anon;
REVOKE ALL ON TABLE public.station_credit_payments FROM anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.fuel_types TO authenticated;
GRANT SELECT, INSERT ON TABLE public.fuel_type_prices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.fuel_tanks TO authenticated;
GRANT SELECT, INSERT ON TABLE public.fuel_tank_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.fuel_pumps TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pump_sessions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.pump_session_payments TO authenticated;
GRANT SELECT, INSERT ON TABLE public.fuel_deliveries TO authenticated;
GRANT SELECT, INSERT ON TABLE public.fuel_losses TO authenticated;
GRANT SELECT, INSERT ON TABLE public.fuel_tank_gauges TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.station_credits TO authenticated;
GRANT SELECT, INSERT ON TABLE public.station_credit_payments TO authenticated;

REVOKE ALL ON TYPE public.pump_session_status FROM anon;
REVOKE ALL ON TYPE public.fuel_tank_movement_type FROM anon;
REVOKE ALL ON TYPE public.station_credit_status FROM anon;
GRANT USAGE ON TYPE public.pump_session_status TO authenticated;
GRANT USAGE ON TYPE public.fuel_tank_movement_type TO authenticated;
GRANT USAGE ON TYPE public.station_credit_status TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: open_pump_session
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.open_pump_session(
  p_fuel_pump_id uuid,
  p_index_start numeric,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_pump record;
  v_last_session record;
  v_price integer;
  v_index_gap numeric;
  v_session_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT p.*, ft.selling_price
  INTO v_pump
  FROM public.fuel_pumps p
  JOIN public.fuel_types ft ON ft.id = p.fuel_type_id
  WHERE p.id = p_fuel_pump_id AND p.active
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pompe introuvable ou inactive';
  END IF;

  IF NOT public.user_belongs_to_establishment(v_user_id, v_pump.establishment_id) THEN
    RAISE EXCEPTION 'Accès interdit';
  END IF;

  -- Check no open session on this pump
  IF EXISTS (
    SELECT 1 FROM public.pump_sessions
    WHERE fuel_pump_id = p_fuel_pump_id AND status = 'OPEN'
  ) THEN
    RAISE EXCEPTION 'Une session est déjà ouverte sur cette pompe';
  END IF;

  -- Check user has no open session
  IF EXISTS (
    SELECT 1 FROM public.pump_sessions
    WHERE opened_by = v_user_id
      AND establishment_id = v_pump.establishment_id
      AND status = 'OPEN'
  ) THEN
    RAISE EXCEPTION 'Vous avez déjà une session ouverte';
  END IF;

  v_price := v_pump.selling_price;

  -- Detect index gap from previous session on this pump
  SELECT index_end INTO v_last_session
  FROM public.pump_sessions
  WHERE fuel_pump_id = p_fuel_pump_id AND status = 'CLOSED'
  ORDER BY closed_at DESC NULLS LAST
  LIMIT 1;

  IF v_last_session.index_end IS NOT NULL THEN
    v_index_gap := p_index_start - v_last_session.index_end;
  ELSE
    v_index_gap := NULL;
  END IF;

  INSERT INTO public.pump_sessions (
    organization_id, establishment_id,
    fuel_pump_id, fuel_type_id, fuel_tank_id,
    opened_by, status,
    price_per_liter, index_start,
    index_gap_from_previous, opening_note
  ) VALUES (
    v_pump.organization_id, v_pump.establishment_id,
    v_pump.id, v_pump.fuel_type_id, v_pump.fuel_tank_id,
    v_user_id, 'OPEN',
    v_price, p_index_start,
    v_index_gap, p_note
  )
  RETURNING id INTO v_session_id;

  -- Update pump current index
  UPDATE public.fuel_pumps SET current_index = p_index_start, updated_at = now()
  WHERE id = p_fuel_pump_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'price_per_liter', v_price,
    'index_gap', v_index_gap
  );
END;
$$;

REVOKE ALL ON FUNCTION public.open_pump_session(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_pump_session(uuid, numeric, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: close_pump_session
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.close_pump_session(
  p_session_id uuid,
  p_index_end numeric,
  p_payments jsonb DEFAULT '[]'::jsonb,
  p_credit_amount integer DEFAULT 0,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_session record;
  v_liters numeric;
  v_expected integer;
  v_total_collected integer := 0;
  v_difference integer;
  v_payment record;
  v_volume_before numeric;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT * INTO v_session
  FROM public.pump_sessions
  WHERE id = p_session_id AND status = 'OPEN'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session introuvable ou déjà clôturée';
  END IF;

  IF NOT public.user_belongs_to_establishment(v_user_id, v_session.establishment_id) THEN
    RAISE EXCEPTION 'Accès interdit';
  END IF;

  IF p_index_end < v_session.index_start THEN
    RAISE EXCEPTION 'L''index de fin ne peut pas être inférieur à l''index de début';
  END IF;

  v_liters := p_index_end - v_session.index_start;
  v_expected := ROUND(v_liters * v_session.price_per_liter)::integer;

  -- Insert payments
  FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS x(method text, amount integer)
  LOOP
    IF v_payment.amount > 0 THEN
      INSERT INTO public.pump_session_payments (
        pump_session_id, organization_id, establishment_id, method, amount
      ) VALUES (
        p_session_id, v_session.organization_id, v_session.establishment_id,
        v_payment.method::public.payment_method, v_payment.amount
      );
      v_total_collected := v_total_collected + v_payment.amount;
    END IF;
  END LOOP;

  v_difference := v_total_collected + COALESCE(p_credit_amount, 0) - v_expected;

  -- Close session
  UPDATE public.pump_sessions SET
    status = 'CLOSED',
    closed_by = v_user_id,
    index_end = p_index_end,
    liters_sold = v_liters,
    expected_amount = v_expected,
    total_collected = v_total_collected,
    credit_amount = COALESCE(p_credit_amount, 0),
    cash_difference = v_difference,
    closing_note = p_note,
    closed_at = now(),
    updated_at = now()
  WHERE id = p_session_id;

  -- Update pump index
  UPDATE public.fuel_pumps SET current_index = p_index_end, updated_at = now()
  WHERE id = v_session.fuel_pump_id;

  -- Deduct from tank
  IF v_liters > 0 THEN
    SELECT current_volume INTO v_volume_before
    FROM public.fuel_tanks WHERE id = v_session.fuel_tank_id FOR UPDATE;

    UPDATE public.fuel_tanks SET
      current_volume = GREATEST(current_volume - v_liters, 0),
      updated_at = now()
    WHERE id = v_session.fuel_tank_id;

    INSERT INTO public.fuel_tank_movements (
      organization_id, establishment_id, fuel_tank_id,
      type, quantity, volume_before, volume_after,
      reference_id, created_by
    ) VALUES (
      v_session.organization_id, v_session.establishment_id, v_session.fuel_tank_id,
      'SALE', v_liters, v_volume_before, GREATEST(v_volume_before - v_liters, 0),
      p_session_id, v_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'liters_sold', v_liters,
    'expected_amount', v_expected,
    'total_collected', v_total_collected,
    'credit_amount', COALESCE(p_credit_amount, 0),
    'cash_difference', v_difference
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_pump_session(uuid, numeric, jsonb, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_pump_session(uuid, numeric, jsonb, integer, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: record_fuel_delivery
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_fuel_delivery(
  p_fuel_tank_id uuid,
  p_quantity numeric,
  p_supplier_id uuid DEFAULT NULL,
  p_purchase_price integer DEFAULT NULL,
  p_total_cost integer DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_tank record;
  v_volume_before numeric;
  v_delivery_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT * INTO v_tank
  FROM public.fuel_tanks WHERE id = p_fuel_tank_id AND active
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuve introuvable ou inactive';
  END IF;

  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_tank.organization_id) THEN
    RAISE EXCEPTION 'Seul un administrateur peut enregistrer une livraison';
  END IF;

  v_volume_before := v_tank.current_volume;

  UPDATE public.fuel_tanks SET
    current_volume = current_volume + p_quantity,
    updated_at = now()
  WHERE id = p_fuel_tank_id;

  INSERT INTO public.fuel_tank_movements (
    organization_id, establishment_id, fuel_tank_id,
    type, quantity, volume_before, volume_after,
    created_by
  ) VALUES (
    v_tank.organization_id, v_tank.establishment_id, p_fuel_tank_id,
    'DELIVERY', p_quantity, v_volume_before, v_volume_before + p_quantity,
    v_user_id
  );

  INSERT INTO public.fuel_deliveries (
    organization_id, establishment_id,
    fuel_type_id, fuel_tank_id, supplier_id,
    quantity, purchase_price_per_liter, total_cost,
    volume_before, volume_after,
    notes, created_by
  ) VALUES (
    v_tank.organization_id, v_tank.establishment_id,
    v_tank.fuel_type_id, p_fuel_tank_id, p_supplier_id,
    p_quantity, p_purchase_price, p_total_cost,
    v_volume_before, v_volume_before + p_quantity,
    p_notes, v_user_id
  )
  RETURNING id INTO v_delivery_id;

  RETURN v_delivery_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_fuel_delivery(uuid, numeric, uuid, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_fuel_delivery(uuid, numeric, uuid, integer, integer, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: record_fuel_loss
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_fuel_loss(
  p_fuel_tank_id uuid,
  p_quantity numeric,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_tank record;
  v_volume_before numeric;
  v_loss_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT * INTO v_tank
  FROM public.fuel_tanks WHERE id = p_fuel_tank_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuve introuvable';
  END IF;

  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_tank.organization_id) THEN
    RAISE EXCEPTION 'Seul un administrateur peut déclarer une perte';
  END IF;

  v_volume_before := v_tank.current_volume;

  UPDATE public.fuel_tanks SET
    current_volume = GREATEST(current_volume - p_quantity, 0),
    updated_at = now()
  WHERE id = p_fuel_tank_id;

  INSERT INTO public.fuel_tank_movements (
    organization_id, establishment_id, fuel_tank_id,
    type, quantity, volume_before, volume_after,
    reason, created_by
  ) VALUES (
    v_tank.organization_id, v_tank.establishment_id, p_fuel_tank_id,
    'LOSS', p_quantity, v_volume_before, GREATEST(v_volume_before - p_quantity, 0),
    p_reason, v_user_id
  );

  INSERT INTO public.fuel_losses (
    organization_id, establishment_id,
    fuel_type_id, fuel_tank_id,
    quantity, reason, created_by
  ) VALUES (
    v_tank.organization_id, v_tank.establishment_id,
    v_tank.fuel_type_id, p_fuel_tank_id,
    p_quantity, p_reason, v_user_id
  )
  RETURNING id INTO v_loss_id;

  RETURN v_loss_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_fuel_loss(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_fuel_loss(uuid, numeric, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: record_fuel_tank_gauge
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_fuel_tank_gauge(
  p_fuel_tank_id uuid,
  p_actual_volume numeric,
  p_apply_correction boolean DEFAULT false,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_tank record;
  v_theoretical numeric;
  v_difference numeric;
  v_gauge_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT * INTO v_tank
  FROM public.fuel_tanks WHERE id = p_fuel_tank_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuve introuvable';
  END IF;

  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_tank.organization_id) THEN
    RAISE EXCEPTION 'Seul un administrateur peut effectuer un jaugeage';
  END IF;

  v_theoretical := v_tank.current_volume;
  v_difference := p_actual_volume - v_theoretical;

  INSERT INTO public.fuel_tank_gauges (
    organization_id, establishment_id, fuel_tank_id,
    theoretical_volume, actual_volume, difference,
    notes, gauged_by
  ) VALUES (
    v_tank.organization_id, v_tank.establishment_id, p_fuel_tank_id,
    v_theoretical, p_actual_volume, v_difference,
    p_notes, v_user_id
  )
  RETURNING id INTO v_gauge_id;

  IF p_apply_correction AND v_difference <> 0 THEN
    UPDATE public.fuel_tanks SET
      current_volume = p_actual_volume,
      updated_at = now()
    WHERE id = p_fuel_tank_id;

    INSERT INTO public.fuel_tank_movements (
      organization_id, establishment_id, fuel_tank_id,
      type, quantity, volume_before, volume_after,
      reason, created_by
    ) VALUES (
      v_tank.organization_id, v_tank.establishment_id, p_fuel_tank_id,
      'GAUGE_CORRECTION', ABS(v_difference), v_theoretical, p_actual_volume,
      'Correction après jaugeage', v_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'gauge_id', v_gauge_id,
    'theoretical', v_theoretical,
    'actual', p_actual_volume,
    'difference', v_difference,
    'corrected', p_apply_correction AND v_difference <> 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_fuel_tank_gauge(uuid, numeric, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_fuel_tank_gauge(uuid, numeric, boolean, text) TO authenticated;
