-- FasoBar: autoriser CASHIER_KITCHEN / KITCHEN_MANAGER sur les commandes
-- et sécuriser l'émission de reçu (téléphone établissement).
-- Fichier uniquement — à appliquer manuellement (SQL Editor / db push).

-- Rôle espace Caisse–Cuisine (idempotent si déjà présent)
ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'CASHIER_KITCHEN';

-- ---------------------------------------------------------------------------
-- ACL commandes : alignée sur les rôles caissier de l'application
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_manage_orders(
  p_user_id uuid,
  p_establishment_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.user_can_manage_products(p_user_id, p_establishment_id)
    OR EXISTS (
      SELECT 1
      FROM public.establishment_memberships em
      WHERE em.user_id = p_user_id
        AND em.establishment_id = p_establishment_id
        AND em.status = 'ACTIVE'::public.entity_status
        AND em.role::text IN ('CASHIER', 'CASHIER_KITCHEN', 'KITCHEN_MANAGER')
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.user_id = p_user_id
        AND om.organization_id = public.establishment_organization_id(p_establishment_id)
        AND om.status = 'ACTIVE'::public.entity_status
        AND om.role::text IN ('CASHIER', 'CASHIER_KITCHEN', 'KITCHEN_MANAGER')
    );
$$;

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS phone text;

-- ---------------------------------------------------------------------------
-- Patch record_order_payment : téléphone / devise via SELECT explicite
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
  v_establishment_name text;
  v_establishment_address text;
  v_establishment_phone text;
  v_establishment_currency text;
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

    SELECT
      e.name,
      e.address,
      e.phone,
      COALESCE(NULLIF(btrim(e.currency), ''), 'XOF')
    INTO
      v_establishment_name,
      v_establishment_address,
      v_establishment_phone,
      v_establishment_currency
    FROM public.establishments e
    WHERE e.id = v_order.establishment_id;

    IF v_establishment_phone IS NULL OR btrim(v_establishment_phone) = '' THEN
      SELECT phone
      INTO v_establishment_phone
      FROM public.organizations
      WHERE id = v_order.organization_id;
    END IF;

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
      v_establishment_name,
      v_establishment_address,
      v_establishment_phone,
      COALESCE(v_establishment_currency, 'XOF'),
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
    ELSE
      SELECT id INTO v_receipt_id FROM public.receipts WHERE order_id = p_order_id;
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

REVOKE ALL ON FUNCTION public.user_can_manage_orders(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_manage_orders(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.record_order_payment(uuid, public.payment_method, integer, integer, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_order_payment(uuid, public.payment_method, integer, integer, text, text, text, text) TO authenticated;
