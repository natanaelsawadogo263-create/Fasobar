-- FasoBar: cash register sessions, payments and thermal receipts

CREATE TYPE public.cash_register_session_status AS ENUM (
  'OPEN',
  'CLOSED',
  'CANCELLED'
);

CREATE TYPE public.payment_method AS ENUM (
  'CASH',
  'ORANGE_MONEY',
  'MOOV_MONEY',
  'TELECEL_MONEY',
  'CARD',
  'OTHER'
);

CREATE TYPE public.payment_status AS ENUM (
  'CONFIRMED',
  'VOIDED',
  'REFUNDED'
);

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'CASH_SESSION_OPENED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'CASH_SESSION_CLOSED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'PAYMENT_RECORDED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'PAYMENT_VOIDED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'RECEIPT_ISSUED';

-- ---------------------------------------------------------------------------
-- Sequences
-- ---------------------------------------------------------------------------

CREATE TABLE public.establishment_payment_sequences (
  establishment_id uuid PRIMARY KEY REFERENCES public.establishments (id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0,
  CONSTRAINT establishment_payment_sequences_last_number_non_negative CHECK (last_number >= 0)
);

CREATE TABLE public.establishment_receipt_sequences (
  establishment_id uuid PRIMARY KEY REFERENCES public.establishments (id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0,
  CONSTRAINT establishment_receipt_sequences_last_number_non_negative CHECK (last_number >= 0)
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.cash_register_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  closed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  status public.cash_register_session_status NOT NULL DEFAULT 'OPEN'::public.cash_register_session_status,
  opening_cash_amount integer NOT NULL DEFAULT 0,
  expected_cash_amount integer NOT NULL DEFAULT 0,
  counted_cash_amount integer,
  cash_difference integer,
  opening_note text,
  closing_note text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cash_register_sessions_opening_cash_non_negative CHECK (opening_cash_amount >= 0),
  CONSTRAINT cash_register_sessions_expected_cash_non_negative CHECK (expected_cash_amount >= 0),
  CONSTRAINT cash_register_sessions_counted_cash_non_negative CHECK (counted_cash_amount IS NULL OR counted_cash_amount >= 0)
);

CREATE UNIQUE INDEX cash_register_sessions_one_open_per_user
  ON public.cash_register_sessions (establishment_id, opened_by)
  WHERE status = 'OPEN'::public.cash_register_session_status;

CREATE INDEX cash_register_sessions_organization_id_idx ON public.cash_register_sessions (organization_id);
CREATE INDEX cash_register_sessions_establishment_id_idx ON public.cash_register_sessions (establishment_id);
CREATE INDEX cash_register_sessions_status_idx ON public.cash_register_sessions (status);
CREATE INDEX cash_register_sessions_opened_by_idx ON public.cash_register_sessions (opened_by);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  cash_register_session_id uuid REFERENCES public.cash_register_sessions (id) ON DELETE RESTRICT,
  payment_number integer NOT NULL,
  method public.payment_method NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'CONFIRMED'::public.payment_status,
  amount_applied integer NOT NULL,
  amount_received integer,
  change_given integer NOT NULL DEFAULT 0,
  transaction_reference text,
  provider text,
  notes text,
  idempotency_key text,
  received_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  received_at timestamptz NOT NULL DEFAULT now(),
  voided_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_payment_number_positive CHECK (payment_number > 0),
  CONSTRAINT payments_amount_applied_positive CHECK (amount_applied > 0),
  CONSTRAINT payments_amount_received_non_negative CHECK (amount_received IS NULL OR amount_received >= 0),
  CONSTRAINT payments_change_given_non_negative CHECK (change_given >= 0),
  CONSTRAINT payments_unique_number_per_establishment UNIQUE (establishment_id, payment_number),
  CONSTRAINT payments_unique_idempotency UNIQUE (establishment_id, idempotency_key)
);

CREATE INDEX payments_organization_id_idx ON public.payments (organization_id);
CREATE INDEX payments_establishment_id_idx ON public.payments (establishment_id);
CREATE INDEX payments_order_id_idx ON public.payments (order_id);
CREATE INDEX payments_session_id_idx ON public.payments (cash_register_session_id);
CREATE INDEX payments_status_idx ON public.payments (status);
CREATE INDEX payments_received_at_idx ON public.payments (received_at);

CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  receipt_number integer NOT NULL,
  issued_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  issued_at timestamptz NOT NULL DEFAULT now(),
  subtotal_snapshot integer NOT NULL,
  discount_snapshot integer NOT NULL DEFAULT 0,
  total_snapshot integer NOT NULL,
  paid_snapshot integer NOT NULL,
  change_snapshot integer NOT NULL DEFAULT 0,
  establishment_name_snapshot text NOT NULL,
  establishment_address_snapshot text,
  establishment_phone_snapshot text,
  establishment_currency_snapshot text NOT NULL DEFAULT 'XOF',
  cashier_name_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receipts_receipt_number_positive CHECK (receipt_number > 0),
  CONSTRAINT receipts_subtotal_non_negative CHECK (subtotal_snapshot >= 0),
  CONSTRAINT receipts_discount_non_negative CHECK (discount_snapshot >= 0),
  CONSTRAINT receipts_total_non_negative CHECK (total_snapshot >= 0),
  CONSTRAINT receipts_paid_non_negative CHECK (paid_snapshot >= 0),
  CONSTRAINT receipts_change_non_negative CHECK (change_snapshot >= 0),
  CONSTRAINT receipts_unique_number_per_establishment UNIQUE (establishment_id, receipt_number),
  CONSTRAINT receipts_unique_order UNIQUE (order_id)
);

CREATE INDEX receipts_organization_id_idx ON public.receipts (organization_id);
CREATE INDEX receipts_establishment_id_idx ON public.receipts (establishment_id);
CREATE INDEX receipts_order_id_idx ON public.receipts (order_id);

CREATE TRIGGER cash_register_sessions_set_updated_at
  BEFORE UPDATE ON public.cash_register_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_manage_cash_session(
  p_user_id uuid,
  p_session_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cash_register_sessions s
    WHERE s.id = p_session_id
      AND (
        public.user_can_manage_products(p_user_id, s.establishment_id)
        OR (
          s.opened_by = p_user_id
          AND public.user_can_manage_orders(p_user_id, s.establishment_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_read_cash_session(
  p_user_id uuid,
  p_session_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cash_register_sessions s
    WHERE s.id = p_session_id
      AND (
        public.user_can_manage_products(p_user_id, s.establishment_id)
        OR (
          s.opened_by = p_user_id
          AND public.user_can_manage_orders(p_user_id, s.establishment_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_read_payment(
  p_user_id uuid,
  p_payment_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.id = p_payment_id
      AND public.user_can_manage_orders(p_user_id, p.establishment_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_read_receipt(
  p_user_id uuid,
  p_receipt_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.receipts r
    WHERE r.id = p_receipt_id
      AND public.user_can_manage_orders(p_user_id, r.establishment_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_void_payment(p_user_id uuid, p_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.user_can_manage_products(p_user_id, p_establishment_id);
$$;

CREATE OR REPLACE FUNCTION public.write_payment_audit_log(
  p_organization_id uuid,
  p_establishment_id uuid,
  p_entity_id uuid,
  p_action public.audit_action,
  p_actor_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    organization_id,
    establishment_id,
    entity_type,
    entity_id,
    action,
    actor_id,
    metadata
  )
  VALUES (
    p_organization_id,
    p_establishment_id,
    'payment',
    p_entity_id,
    p_action,
    p_actor_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.next_payment_number(p_establishment_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_number integer;
BEGIN
  INSERT INTO public.establishment_payment_sequences (establishment_id, last_number)
  VALUES (p_establishment_id, 1)
  ON CONFLICT (establishment_id) DO UPDATE
  SET last_number = public.establishment_payment_sequences.last_number + 1
  RETURNING last_number INTO v_number;

  RETURN v_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_receipt_number(p_establishment_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_number integer;
BEGIN
  INSERT INTO public.establishment_receipt_sequences (establishment_id, last_number)
  VALUES (p_establishment_id, 1)
  ON CONFLICT (establishment_id) DO UPDATE
  SET last_number = public.establishment_receipt_sequences.last_number + 1
  RETURNING last_number INTO v_number;

  RETURN v_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_cash_session(
  p_user_id uuid,
  p_establishment_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id
  FROM public.cash_register_sessions s
  WHERE s.establishment_id = p_establishment_id
    AND s.opened_by = p_user_id
    AND s.status = 'OPEN'::public.cash_register_session_status
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.order_confirmed_paid_total(p_order_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(p.amount_applied), 0)::integer
  FROM public.payments p
  WHERE p.order_id = p_order_id
    AND p.status = 'CONFIRMED'::public.payment_status;
$$;

CREATE OR REPLACE FUNCTION public.session_cash_collected(p_session_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(p.amount_applied), 0)::integer
  FROM public.payments p
  WHERE p.cash_register_session_id = p_session_id
    AND p.method = 'CASH'::public.payment_method
    AND p.status = 'CONFIRMED'::public.payment_status;
$$;

-- ---------------------------------------------------------------------------
-- RPC: open cash register session
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.open_cash_register_session(
  p_opening_cash_amount integer,
  p_opening_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_establishment_id uuid;
  v_organization_id uuid;
  v_session_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_opening_cash_amount IS NULL OR p_opening_cash_amount < 0 THEN
    RAISE EXCEPTION 'Le fond de caisse initial doit être positif ou nul.';
  END IF;

  SELECT em.establishment_id, e.organization_id
  INTO v_establishment_id, v_organization_id
  FROM public.establishment_memberships em
  INNER JOIN public.establishments e ON e.id = em.establishment_id
  WHERE em.user_id = v_user_id
    AND em.status = 'ACTIVE'::public.entity_status
  LIMIT 1;

  IF v_establishment_id IS NULL THEN
    SELECT e.id, e.organization_id
    INTO v_establishment_id, v_organization_id
    FROM public.organization_memberships om
    INNER JOIN public.establishments e ON e.organization_id = om.organization_id
    WHERE om.user_id = v_user_id
      AND om.status = 'ACTIVE'::public.entity_status
    LIMIT 1;
  END IF;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Établissement actif introuvable.';
  END IF;

  IF NOT public.user_can_manage_orders(v_user_id, v_establishment_id) THEN
    RAISE EXCEPTION 'Permission insuffisante pour ouvrir une caisse.';
  END IF;

  IF public.get_active_cash_session(v_user_id, v_establishment_id) IS NOT NULL THEN
    RAISE EXCEPTION 'Une session de caisse est déjà ouverte pour cet utilisateur.';
  END IF;

  INSERT INTO public.cash_register_sessions (
    organization_id,
    establishment_id,
    opened_by,
    status,
    opening_cash_amount,
    expected_cash_amount,
    opening_note
  )
  VALUES (
    v_organization_id,
    v_establishment_id,
    v_user_id,
    'OPEN'::public.cash_register_session_status,
    p_opening_cash_amount,
    p_opening_cash_amount,
    NULLIF(btrim(p_opening_note), '')
  )
  RETURNING id INTO v_session_id;

  PERFORM public.write_payment_audit_log(
    v_organization_id,
    v_establishment_id,
    v_session_id,
    'CASH_SESSION_OPENED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'opening_cash_amount', p_opening_cash_amount,
      'opening_note', NULLIF(btrim(p_opening_note), '')
    )
  );

  RETURN v_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: record order payment (single, atomic)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_order_payment(
  p_order_id uuid,
  p_method public.payment_method,
  p_amount_applied integer,
  p_amount_received integer DEFAULT NULL,
  p_transaction_reference text DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_order public.orders%ROWTYPE;
  v_paid_total integer;
  v_remaining integer;
  v_payment_id uuid;
  v_payment_number integer;
  v_session_id uuid;
  v_change integer;
  v_receipt_id uuid;
  v_cashier_name text;
  v_establishment public.establishments%ROWTYPE;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_amount_applied IS NULL OR p_amount_applied <= 0 THEN
    RAISE EXCEPTION 'Le montant appliqué doit être strictement positif.';
  END IF;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT p.id
    INTO v_payment_id
    FROM public.payments p
    WHERE p.establishment_id = (
      SELECT o.establishment_id FROM public.orders o WHERE o.id = p_order_id
    )
      AND p.idempotency_key = btrim(p_idempotency_key);

    IF v_payment_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'duplicate', true
      );
    END IF;
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  IF NOT public.user_can_manage_orders(v_user_id, v_order.establishment_id) THEN
    RAISE EXCEPTION 'Permission insuffisante pour encaisser cette commande.';
  END IF;

  IF v_order.status = 'CANCELLED'::public.order_status THEN
    RAISE EXCEPTION 'Impossible d''encaisser une commande annulée.';
  END IF;

  IF v_order.payment_status = 'PAID'::public.order_payment_status THEN
    RAISE EXCEPTION 'Cette commande est déjà totalement payée.';
  END IF;

  v_paid_total := public.order_confirmed_paid_total(p_order_id);
  v_remaining := v_order.total_amount - v_paid_total;

  IF p_amount_applied > v_remaining THEN
    RAISE EXCEPTION 'Le montant appliqué dépasse le solde restant.';
  END IF;

  v_session_id := NULL;

  IF p_method = 'CASH'::public.payment_method THEN
    v_session_id := public.get_active_cash_session(v_user_id, v_order.establishment_id);

    IF v_session_id IS NULL THEN
      RAISE EXCEPTION 'Aucune session de caisse ouverte pour les paiements en espèces.';
    END IF;

    v_change := GREATEST(COALESCE(p_amount_received, p_amount_applied) - p_amount_applied, 0);
  ELSE
    v_change := 0;
  END IF;

  v_payment_number := public.next_payment_number(v_order.establishment_id);

  INSERT INTO public.payments (
    organization_id,
    establishment_id,
    order_id,
    cash_register_session_id,
    payment_number,
    method,
    status,
    amount_applied,
    amount_received,
    change_given,
    transaction_reference,
    provider,
    notes,
    idempotency_key,
    received_by
  )
  VALUES (
    v_order.organization_id,
    v_order.establishment_id,
    p_order_id,
    v_session_id,
    v_payment_number,
    p_method,
    'CONFIRMED'::public.payment_status,
    p_amount_applied,
    p_amount_received,
    v_change,
    NULLIF(btrim(p_transaction_reference), ''),
    NULLIF(btrim(p_provider), ''),
    NULLIF(btrim(p_notes), ''),
    NULLIF(btrim(p_idempotency_key), ''),
    v_user_id
  )
  RETURNING id INTO v_payment_id;

  v_paid_total := v_paid_total + p_amount_applied;

  IF v_paid_total >= v_order.total_amount THEN
    UPDATE public.orders
    SET
      payment_status = 'PAID'::public.order_payment_status,
      status = 'READY_TO_PAY'::public.order_status,
      updated_by = v_user_id,
      updated_at = now()
    WHERE id = p_order_id;

    SELECT *
    INTO v_establishment
    FROM public.establishments e
    WHERE e.id = v_order.establishment_id;

    SELECT full_name
    INTO v_cashier_name
    FROM public.profiles
    WHERE id = v_user_id;

    INSERT INTO public.receipts (
      organization_id,
      establishment_id,
      order_id,
      receipt_number,
      issued_by,
      subtotal_snapshot,
      discount_snapshot,
      total_snapshot,
      paid_snapshot,
      change_snapshot,
      establishment_name_snapshot,
      establishment_address_snapshot,
      establishment_phone_snapshot,
      establishment_currency_snapshot,
      cashier_name_snapshot
    )
    VALUES (
      v_order.organization_id,
      v_order.establishment_id,
      p_order_id,
      public.next_receipt_number(v_order.establishment_id),
      v_user_id,
      v_order.subtotal,
      v_order.discount_amount,
      v_order.total_amount,
      v_paid_total,
      (
        SELECT COALESCE(SUM(p.change_given), 0)
        FROM public.payments p
        WHERE p.order_id = p_order_id
          AND p.status = 'CONFIRMED'::public.payment_status
      ),
      v_establishment.name,
      v_establishment.address,
      COALESCE(v_establishment.phone, (SELECT phone FROM public.organizations WHERE id = v_order.organization_id)),
      COALESCE(v_establishment.currency, 'XOF'),
      v_cashier_name
    )
    ON CONFLICT (order_id) DO NOTHING
    RETURNING id INTO v_receipt_id;

    IF v_receipt_id IS NOT NULL THEN
      PERFORM public.write_payment_audit_log(
        v_order.organization_id,
        v_order.establishment_id,
        v_receipt_id,
        'RECEIPT_ISSUED'::public.audit_action,
        v_user_id,
        jsonb_build_object('order_id', p_order_id)
      );
    END IF;
  ELSE
    UPDATE public.orders
    SET
      payment_status = 'PARTIALLY_PAID'::public.order_payment_status,
      updated_by = v_user_id,
      updated_at = now()
    WHERE id = p_order_id;
  END IF;

  IF v_session_id IS NOT NULL THEN
    UPDATE public.cash_register_sessions
    SET
      expected_cash_amount = opening_cash_amount + public.session_cash_collected(v_session_id),
      updated_at = now()
    WHERE id = v_session_id;
  END IF;

  PERFORM public.write_payment_audit_log(
    v_order.organization_id,
    v_order.establishment_id,
    v_payment_id,
    'PAYMENT_RECORDED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'order_id', p_order_id,
      'method', p_method,
      'amount_applied', p_amount_applied,
      'remaining_after', v_order.total_amount - v_paid_total
    )
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'receipt_id', v_receipt_id,
    'paid_total', v_paid_total,
    'remaining', GREATEST(v_order.total_amount - v_paid_total, 0),
    'change_given', v_change,
    'order_payment_status', CASE
      WHEN v_paid_total >= v_order.total_amount THEN 'PAID'
      ELSE 'PARTIALLY_PAID'
    END,
    'fully_paid', v_paid_total >= v_order.total_amount
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: record multiple payments (mixed, atomic)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_order_payments(
  p_order_id uuid,
  p_payments jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_result jsonb;
  v_last_result jsonb := '{}'::jsonb;
  v_key text;
  v_index integer := 0;
BEGIN
  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'Au moins un paiement est requis.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payments)
  LOOP
    v_index := v_index + 1;
    v_key := CASE
      WHEN p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
        btrim(p_idempotency_key) || '-' || v_index::text
      ELSE NULL
    END;

    v_result := public.record_order_payment(
      p_order_id,
      (v_item ->> 'method')::public.payment_method,
      (v_item ->> 'amount_applied')::integer,
      NULLIF(v_item ->> 'amount_received', '')::integer,
      v_item ->> 'transaction_reference',
      v_item ->> 'provider',
      v_item ->> 'notes',
      v_key
    );

    v_last_result := v_result;
  END LOOP;

  RETURN v_last_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: close cash register session
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.close_cash_register_session(
  p_session_id uuid,
  p_counted_cash_amount integer,
  p_closing_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_session public.cash_register_sessions%ROWTYPE;
  v_expected integer;
  v_difference integer;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_counted_cash_amount IS NULL OR p_counted_cash_amount < 0 THEN
    RAISE EXCEPTION 'Le montant compté doit être positif ou nul.';
  END IF;

  SELECT *
  INTO v_session
  FROM public.cash_register_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session de caisse introuvable.';
  END IF;

  IF NOT public.user_can_manage_cash_session(v_user_id, p_session_id) THEN
    RAISE EXCEPTION 'Permission insuffisante pour fermer cette caisse.';
  END IF;

  IF v_session.status <> 'OPEN'::public.cash_register_session_status THEN
    RAISE EXCEPTION 'Cette session de caisse est déjà fermée.';
  END IF;

  v_expected := v_session.opening_cash_amount + public.session_cash_collected(p_session_id);
  v_difference := p_counted_cash_amount - v_expected;

  UPDATE public.cash_register_sessions
  SET
    status = 'CLOSED'::public.cash_register_session_status,
    closed_by = v_user_id,
    expected_cash_amount = v_expected,
    counted_cash_amount = p_counted_cash_amount,
    cash_difference = v_difference,
    closing_note = NULLIF(btrim(p_closing_note), ''),
    closed_at = now(),
    updated_at = now()
  WHERE id = p_session_id;

  PERFORM public.write_payment_audit_log(
    v_session.organization_id,
    v_session.establishment_id,
    p_session_id,
    'CASH_SESSION_CLOSED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'expected_cash_amount', v_expected,
      'counted_cash_amount', p_counted_cash_amount,
      'cash_difference', v_difference
    )
  );

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'expected_cash_amount', v_expected,
    'counted_cash_amount', p_counted_cash_amount,
    'cash_difference', v_difference
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: void payment (managers only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.void_payment(
  p_payment_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_payment public.payments%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_paid_total integer;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Le motif d''annulation est obligatoire.';
  END IF;

  SELECT *
  INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paiement introuvable.';
  END IF;

  IF NOT public.user_can_void_payment(v_user_id, v_payment.establishment_id) THEN
    RAISE EXCEPTION 'Permission insuffisante pour annuler ce paiement.';
  END IF;

  IF v_payment.status <> 'CONFIRMED'::public.payment_status THEN
    RAISE EXCEPTION 'Seuls les paiements confirmés peuvent être annulés.';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = v_payment.order_id
  FOR UPDATE;

  UPDATE public.payments
  SET
    status = 'VOIDED'::public.payment_status,
    voided_by = v_user_id,
    voided_at = now(),
    void_reason = btrim(p_reason)
  WHERE id = p_payment_id;

  v_paid_total := public.order_confirmed_paid_total(v_payment.order_id);

  UPDATE public.orders
  SET
    payment_status = CASE
      WHEN v_paid_total <= 0 THEN 'UNPAID'::public.order_payment_status
      WHEN v_paid_total >= v_order.total_amount THEN 'PAID'::public.order_payment_status
      ELSE 'PARTIALLY_PAID'::public.order_payment_status
    END,
    updated_by = v_user_id,
    updated_at = now()
  WHERE id = v_payment.order_id;

  IF v_payment.cash_register_session_id IS NOT NULL THEN
    UPDATE public.cash_register_sessions
    SET
      expected_cash_amount = opening_cash_amount + public.session_cash_collected(v_payment.cash_register_session_id),
      updated_at = now()
    WHERE id = v_payment.cash_register_session_id
      AND status = 'OPEN'::public.cash_register_session_status;
  END IF;

  PERFORM public.write_payment_audit_log(
    v_payment.organization_id,
    v_payment.establishment_id,
    p_payment_id,
    'PAYMENT_VOIDED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'order_id', v_payment.order_id,
      'reason', btrim(p_reason),
      'amount_applied', v_payment.amount_applied
    )
  );

  RETURN p_payment_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.establishment_payment_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishment_receipt_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.establishment_payment_sequences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.establishment_receipt_sequences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cash_register_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY establishment_payment_sequences_no_access
  ON public.establishment_payment_sequences FOR ALL TO authenticated USING (false);

CREATE POLICY establishment_receipt_sequences_no_access
  ON public.establishment_receipt_sequences FOR ALL TO authenticated USING (false);

CREATE POLICY cash_register_sessions_select
  ON public.cash_register_sessions FOR SELECT TO authenticated
  USING (public.user_can_read_cash_session((SELECT auth.uid()), id));

CREATE POLICY cash_register_sessions_immutable
  ON public.cash_register_sessions FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY payments_select
  ON public.payments FOR SELECT TO authenticated
  USING (public.user_can_read_payment((SELECT auth.uid()), id));

CREATE POLICY payments_immutable
  ON public.payments FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY receipts_select
  ON public.receipts FOR SELECT TO authenticated
  USING (public.user_can_read_receipt((SELECT auth.uid()), id));

CREATE POLICY receipts_immutable
  ON public.receipts FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.establishment_payment_sequences FROM anon;
REVOKE ALL ON TABLE public.establishment_receipt_sequences FROM anon;
REVOKE ALL ON TABLE public.cash_register_sessions FROM anon;
REVOKE ALL ON TABLE public.payments FROM anon;
REVOKE ALL ON TABLE public.receipts FROM anon;

REVOKE ALL ON TYPE public.cash_register_session_status FROM anon;
REVOKE ALL ON TYPE public.payment_method FROM anon;
REVOKE ALL ON TYPE public.payment_status FROM anon;

GRANT SELECT ON TABLE public.cash_register_sessions TO authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;
GRANT SELECT ON TABLE public.receipts TO authenticated;

GRANT USAGE ON TYPE public.cash_register_session_status TO authenticated;
GRANT USAGE ON TYPE public.payment_method TO authenticated;
GRANT USAGE ON TYPE public.payment_status TO authenticated;

REVOKE ALL ON FUNCTION public.user_can_manage_cash_session(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_read_cash_session(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_read_payment(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_read_receipt(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_void_payment(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.write_payment_audit_log(uuid, uuid, uuid, public.audit_action, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_payment_number(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_receipt_number(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_active_cash_session(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.order_confirmed_paid_total(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.session_cash_collected(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_cash_register_session(integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_order_payment(uuid, public.payment_method, integer, integer, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_order_payments(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_cash_register_session(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_payment(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.user_can_manage_cash_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_read_cash_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_read_payment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_read_receipt(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_void_payment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_cash_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_cash_register_session(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_payment(uuid, public.payment_method, integer, integer, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_payments(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_cash_register_session(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_payment(uuid, text) TO authenticated;
