-- FasoBar Desktop Phase 3B — idempotent outbox ingest (orders / payments / cash sessions)
-- Apply manually. Do not modify older migrations.

-- ---------------------------------------------------------------------------
-- client_mutation_id on cloud aggregates (nullable for legacy rows)
-- ---------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_mutation_id text;

ALTER TABLE public.cash_register_sessions
  ADD COLUMN IF NOT EXISTS client_mutation_id text;

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS client_mutation_id text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_client_mutation_id_uidx
  ON public.orders (client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cash_register_sessions_client_mutation_id_uidx
  ON public.cash_register_sessions (client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS receipts_client_mutation_id_uidx
  ON public.receipts (client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

COMMENT ON COLUMN public.orders.client_mutation_id IS
  'Idempotency key from desktop SERVEUR_CAISSE outbox (ORDER_CREATED).';
COMMENT ON COLUMN public.cash_register_sessions.client_mutation_id IS
  'Idempotency key from desktop outbox (CASH_SESSION_OPENED).';
COMMENT ON COLUMN public.receipts.client_mutation_id IS
  'Idempotency key from desktop outbox (PAYMENT_RECORDED receipt).';

-- ---------------------------------------------------------------------------
-- apply_desktop_outbox_event — SECURITY DEFINER, auth.uid(), idempotent
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_desktop_outbox_event(
  p_event_type text,
  p_client_mutation_id text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_establishment_id uuid;
  v_organization_id uuid;
  v_existing_id uuid;
  v_order_id uuid;
  v_session_id uuid;
  v_order_number integer;
  v_payment_id uuid;
  v_payment_number integer;
  v_receipt_id uuid;
  v_item jsonb;
  v_payment jsonb;
  v_department_id uuid;
  v_dept_code text;
  v_product_id uuid;
  v_paid_total integer;
  v_payment_status public.order_payment_status;
  v_cashier_name text;
  v_establishment public.establishments%ROWTYPE;
  v_open_mutation text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_client_mutation_id IS NULL OR btrim(p_client_mutation_id) = '' THEN
    RAISE EXCEPTION 'client_mutation_id obligatoire.';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload JSON invalide.';
  END IF;

  v_establishment_id := NULLIF(p_payload ->> 'establishment_id', '')::uuid;
  v_organization_id := NULLIF(p_payload ->> 'organization_id', '')::uuid;

  IF v_establishment_id IS NULL OR v_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id et establishment_id obligatoires.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = v_establishment_id
      AND e.organization_id = v_organization_id
  ) THEN
    RAISE EXCEPTION 'Établissement introuvable.';
  END IF;

  IF NOT public.user_is_cash_register_operator(v_user_id, v_establishment_id)
     AND NOT public.user_can_manage_orders(v_user_id, v_establishment_id) THEN
    RAISE EXCEPTION 'Permission insuffisante.';
  END IF;

  -- Impersonation guard: financial actor must be the authenticated user
  IF (p_payload ->> 'opened_by') IS NOT NULL
     AND (p_payload ->> 'opened_by')::uuid IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'opened_by ne correspond pas à la session.';
  END IF;

  IF (p_payload ->> 'closed_by') IS NOT NULL
     AND (p_payload ->> 'closed_by')::uuid IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'closed_by ne correspond pas à la session.';
  END IF;

  IF (p_payload ->> 'created_by') IS NOT NULL
     AND (p_payload ->> 'created_by')::uuid IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'created_by ne correspond pas à la session.';
  END IF;

  IF (p_payload ->> 'received_by') IS NOT NULL
     AND (p_payload ->> 'received_by')::uuid IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'received_by ne correspond pas à la session.';
  END IF;

  -------------------------------------------------------------------------
  -- CASH_SESSION_OPENED
  -------------------------------------------------------------------------
  IF p_event_type = 'CASH_SESSION_OPENED' THEN
    SELECT s.id INTO v_existing_id
    FROM public.cash_register_sessions s
    WHERE s.client_mutation_id = btrim(p_client_mutation_id);

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'cloud_id', v_existing_id);
    END IF;

    v_session_id := COALESCE(
      NULLIF(p_payload ->> 'session_id', '')::uuid,
      gen_random_uuid()
    );

    INSERT INTO public.cash_register_sessions (
      id,
      organization_id,
      establishment_id,
      opened_by,
      status,
      opening_cash_amount,
      expected_cash_amount,
      opening_note,
      opened_at,
      client_mutation_id
    )
    VALUES (
      v_session_id,
      v_organization_id,
      v_establishment_id,
      v_user_id,
      'OPEN'::public.cash_register_session_status,
      COALESCE((p_payload ->> 'opening_cash_amount')::integer, 0),
      COALESCE((p_payload ->> 'opening_cash_amount')::integer, 0),
      NULLIF(btrim(COALESCE(p_payload ->> 'opening_note', '')), ''),
      COALESCE((p_payload ->> 'opened_at')::timestamptz, now()),
      btrim(p_client_mutation_id)
    )
    ON CONFLICT (id) DO NOTHING;

    IF NOT FOUND THEN
      SELECT s.id INTO v_existing_id
      FROM public.cash_register_sessions s
      WHERE s.id = v_session_id OR s.client_mutation_id = btrim(p_client_mutation_id);
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'cloud_id', v_existing_id);
    END IF;

    RETURN jsonb_build_object('ok', true, 'duplicate', false, 'cloud_id', v_session_id);
  END IF;

  -------------------------------------------------------------------------
  -- CASH_SESSION_CLOSED
  -------------------------------------------------------------------------
  IF p_event_type = 'CASH_SESSION_CLOSED' THEN
    v_open_mutation := NULLIF(btrim(COALESCE(p_payload ->> 'open_client_mutation_id', '')), '');
    v_session_id := NULLIF(p_payload ->> 'session_id', '')::uuid;

    IF v_session_id IS NULL AND v_open_mutation IS NOT NULL THEN
      SELECT s.id INTO v_session_id
      FROM public.cash_register_sessions s
      WHERE s.client_mutation_id = v_open_mutation;
    END IF;

    IF v_session_id IS NULL THEN
      RAISE EXCEPTION 'session_id introuvable pour fermeture.';
    END IF;

    UPDATE public.cash_register_sessions
    SET
      status = 'CLOSED'::public.cash_register_session_status,
      closed_by = v_user_id,
      expected_cash_amount = COALESCE((p_payload ->> 'expected_cash_amount')::integer, expected_cash_amount),
      counted_cash_amount = COALESCE((p_payload ->> 'counted_cash_amount')::integer, 0),
      cash_difference = COALESCE((p_payload ->> 'cash_difference')::integer, 0),
      closing_note = NULLIF(btrim(COALESCE(p_payload ->> 'closing_note', '')), ''),
      closed_at = COALESCE((p_payload ->> 'closed_at')::timestamptz, now()),
      updated_at = now()
    WHERE id = v_session_id
      AND opened_by = v_user_id
      AND establishment_id = v_establishment_id;

    IF NOT FOUND THEN
      -- Already closed or missing: treat as idempotent success if session exists closed
      IF EXISTS (
        SELECT 1 FROM public.cash_register_sessions s
        WHERE s.id = v_session_id AND s.status = 'CLOSED'::public.cash_register_session_status
      ) THEN
        RETURN jsonb_build_object('ok', true, 'duplicate', true, 'cloud_id', v_session_id);
      END IF;
      RAISE EXCEPTION 'Session de caisse introuvable ou non autorisée.';
    END IF;

    RETURN jsonb_build_object('ok', true, 'duplicate', false, 'cloud_id', v_session_id);
  END IF;

  -------------------------------------------------------------------------
  -- ORDER_CREATED
  -------------------------------------------------------------------------
  IF p_event_type = 'ORDER_CREATED' THEN
    SELECT o.id INTO v_existing_id
    FROM public.orders o
    WHERE o.client_mutation_id = btrim(p_client_mutation_id);

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'cloud_id', v_existing_id);
    END IF;

    v_order_id := COALESCE(
      NULLIF(p_payload ->> 'order_id', '')::uuid,
      gen_random_uuid()
    );

    IF EXISTS (SELECT 1 FROM public.orders o WHERE o.id = v_order_id) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'cloud_id', v_order_id);
    END IF;

    v_order_number := public.next_order_number(v_establishment_id);

    INSERT INTO public.orders (
      id,
      organization_id,
      establishment_id,
      order_number,
      table_reference,
      customer_reference,
      order_type,
      status,
      payment_status,
      subtotal,
      discount_amount,
      total_amount,
      notes,
      created_by,
      updated_by,
      created_at,
      updated_at,
      client_mutation_id
    )
    VALUES (
      v_order_id,
      v_organization_id,
      v_establishment_id,
      v_order_number,
      NULLIF(btrim(COALESCE(p_payload ->> 'table_reference', '')), ''),
      NULLIF(btrim(COALESCE(p_payload ->> 'customer_reference', '')), ''),
      COALESCE((p_payload ->> 'order_type')::public.order_type, 'ON_SITE'::public.order_type),
      COALESCE((p_payload ->> 'status')::public.order_status, 'OPEN'::public.order_status),
      COALESCE((p_payload ->> 'payment_status')::public.order_payment_status, 'UNPAID'::public.order_payment_status),
      COALESCE((p_payload ->> 'subtotal')::integer, 0),
      COALESCE((p_payload ->> 'discount_amount')::integer, 0),
      COALESCE((p_payload ->> 'total_amount')::integer, 0),
      NULLIF(btrim(COALESCE(p_payload ->> 'notes', '')), ''),
      v_user_id,
      v_user_id,
      COALESCE((p_payload ->> 'created_at')::timestamptz, now()),
      COALESCE((p_payload ->> 'updated_at')::timestamptz, now()),
      btrim(p_client_mutation_id)
    );

    FOR v_item IN
      SELECT value FROM jsonb_array_elements(COALESCE(p_payload -> 'items', '[]'::jsonb))
    LOOP
      v_product_id := (v_item ->> 'product_id')::uuid;
      v_dept_code := upper(COALESCE(v_item ->> 'department_code', 'BAR'));

      SELECT d.id INTO v_department_id
      FROM public.departments d
      WHERE d.establishment_id = v_establishment_id
        AND d.code::text = v_dept_code
      LIMIT 1;

      IF v_department_id IS NULL THEN
        SELECT d.id INTO v_department_id
        FROM public.departments d
        WHERE d.establishment_id = v_establishment_id
        ORDER BY d.code
        LIMIT 1;
      END IF;

      IF v_department_id IS NULL THEN
        RAISE EXCEPTION 'Département introuvable pour l''établissement.';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = v_product_id
          AND p.establishment_id = v_establishment_id
      ) THEN
        RAISE EXCEPTION 'Produit cloud introuvable: %', v_product_id;
      END IF;

      INSERT INTO public.order_items (
        id,
        organization_id,
        establishment_id,
        order_id,
        product_id,
        department_id,
        product_name_snapshot,
        unit_price_snapshot,
        quantity,
        line_total,
        notes
      )
      VALUES (
        COALESCE(NULLIF(v_item ->> 'id', '')::uuid, gen_random_uuid()),
        v_organization_id,
        v_establishment_id,
        v_order_id,
        v_product_id,
        v_department_id,
        COALESCE(v_item ->> 'product_name_snapshot', 'Article'),
        COALESCE((v_item ->> 'unit_price_snapshot')::integer, 0),
        COALESCE((v_item ->> 'quantity')::numeric, 1),
        COALESCE((v_item ->> 'line_total')::integer, 0),
        NULLIF(btrim(COALESCE(v_item ->> 'notes', '')), '')
      )
      ON CONFLICT (order_id, product_id) DO UPDATE
      SET
        quantity = EXCLUDED.quantity,
        line_total = EXCLUDED.line_total,
        unit_price_snapshot = EXCLUDED.unit_price_snapshot,
        product_name_snapshot = EXCLUDED.product_name_snapshot,
        notes = EXCLUDED.notes,
        updated_at = now();
    END LOOP;

    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', false,
      'cloud_id', v_order_id,
      'order_number', v_order_number
    );
  END IF;

  -------------------------------------------------------------------------
  -- PAYMENT_RECORDED
  -------------------------------------------------------------------------
  IF p_event_type = 'PAYMENT_RECORDED' THEN
    -- Resolve order by id or prior mutation
    v_order_id := NULLIF(p_payload ->> 'order_id', '')::uuid;

    IF v_order_id IS NULL AND (p_payload ->> 'order_client_mutation_id') IS NOT NULL THEN
      SELECT o.id INTO v_order_id
      FROM public.orders o
      WHERE o.client_mutation_id = btrim(p_payload ->> 'order_client_mutation_id');
    END IF;

    IF v_order_id IS NULL THEN
      RAISE EXCEPTION 'order_id introuvable pour paiement.';
    END IF;

    -- Idempotency: first payment key == client_mutation_id
    SELECT p.id INTO v_payment_id
    FROM public.payments p
    WHERE p.establishment_id = v_establishment_id
      AND p.idempotency_key = btrim(p_client_mutation_id);

    IF v_payment_id IS NOT NULL THEN
      SELECT r.id INTO v_receipt_id
      FROM public.receipts r
      WHERE r.order_id = v_order_id
      LIMIT 1;
      RETURN jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'cloud_id', v_order_id,
        'payment_id', v_payment_id,
        'receipt_id', v_receipt_id
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = v_order_id AND o.establishment_id = v_establishment_id
    ) THEN
      RAISE EXCEPTION 'Commande cloud introuvable (synchronisez ORDER_CREATED d''abord).';
    END IF;

    v_session_id := NULLIF(p_payload ->> 'cash_session_id', '')::uuid;

    FOR v_payment IN
      SELECT value FROM jsonb_array_elements(COALESCE(p_payload -> 'payments', '[]'::jsonb))
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.establishment_id = v_establishment_id
          AND p.idempotency_key = NULLIF(btrim(COALESCE(v_payment ->> 'idempotency_key', '')), '')
      ) THEN
        CONTINUE;
      END IF;

      v_payment_number := public.next_payment_number(v_establishment_id);
      v_payment_id := COALESCE(
        NULLIF(v_payment ->> 'payment_id', '')::uuid,
        gen_random_uuid()
      );

      INSERT INTO public.payments (
        id,
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
        provider,
        notes,
        idempotency_key,
        received_by,
        received_at
      )
      VALUES (
        v_payment_id,
        v_organization_id,
        v_establishment_id,
        v_order_id,
        CASE
          WHEN (v_payment ->> 'method') = 'CASH' THEN v_session_id
          ELSE NULL
        END,
        v_payment_number,
        (v_payment ->> 'method')::public.payment_method,
        'CONFIRMED'::public.payment_status,
        COALESCE((v_payment ->> 'amount_applied')::integer, 0),
        NULLIF(v_payment ->> 'amount_received', '')::integer,
        COALESCE((v_payment ->> 'change_given')::integer, 0),
        COALESCE(v_payment ->> 'provider', v_payment ->> 'method'),
        NULLIF(btrim(COALESCE(v_payment ->> 'notes', '')), ''),
        COALESCE(
          NULLIF(btrim(COALESCE(v_payment ->> 'idempotency_key', '')), ''),
          btrim(p_client_mutation_id)
        ),
        v_user_id,
        COALESCE((v_payment ->> 'received_at')::timestamptz, now())
      );
    END LOOP;

    v_paid_total := public.order_confirmed_paid_total(v_order_id);

    SELECT
      CASE
        WHEN v_paid_total >= o.total_amount THEN 'PAID'::public.order_payment_status
        WHEN v_paid_total > 0 THEN 'PARTIALLY_PAID'::public.order_payment_status
        ELSE 'UNPAID'::public.order_payment_status
      END
    INTO v_payment_status
    FROM public.orders o
    WHERE o.id = v_order_id;

    UPDATE public.orders
    SET
      payment_status = v_payment_status,
      status = CASE
        WHEN v_payment_status = 'PAID'::public.order_payment_status
          THEN 'READY_TO_PAY'::public.order_status
        ELSE status
      END,
      updated_by = v_user_id,
      updated_at = now()
    WHERE id = v_order_id;

    IF COALESCE((p_payload ->> 'fully_paid')::boolean, false)
       OR v_payment_status = 'PAID'::public.order_payment_status THEN
      SELECT r.id INTO v_receipt_id
      FROM public.receipts r
      WHERE r.order_id = v_order_id;

      IF v_receipt_id IS NULL AND p_payload -> 'receipt' IS NOT NULL THEN
        SELECT * INTO v_establishment
        FROM public.establishments e
        WHERE e.id = v_establishment_id;

        SELECT p.full_name INTO v_cashier_name
        FROM public.profiles p
        WHERE p.id = v_user_id;

        v_receipt_id := COALESCE(
          NULLIF(p_payload #>> '{receipt,receipt_id}', '')::uuid,
          gen_random_uuid()
        );

        INSERT INTO public.receipts (
          id,
          organization_id,
          establishment_id,
          order_id,
          receipt_number,
          issued_by,
          issued_at,
          subtotal_snapshot,
          discount_snapshot,
          total_snapshot,
          paid_snapshot,
          change_snapshot,
          establishment_name_snapshot,
          establishment_address_snapshot,
          establishment_phone_snapshot,
          establishment_currency_snapshot,
          cashier_name_snapshot,
          client_mutation_id
        )
        VALUES (
          v_receipt_id,
          v_organization_id,
          v_establishment_id,
          v_order_id,
          public.next_receipt_number(v_establishment_id),
          v_user_id,
          COALESCE((p_payload #>> '{receipt,issued_at}')::timestamptz, now()),
          COALESCE((p_payload #>> '{receipt,subtotal}')::integer, 0),
          COALESCE((p_payload #>> '{receipt,discount}')::integer, 0),
          COALESCE((p_payload #>> '{receipt,total}')::integer, 0),
          COALESCE((p_payload #>> '{receipt,paid}')::integer, 0),
          COALESCE((p_payload #>> '{receipt,change}')::integer, 0),
          COALESCE(
            NULLIF(btrim(COALESCE(p_payload #>> '{receipt,establishment_name}', '')), ''),
            v_establishment.name
          ),
          NULL,
          NULL,
          COALESCE(NULLIF(btrim(COALESCE(p_payload #>> '{receipt,currency}', '')), ''), 'XOF'),
          COALESCE(
            NULLIF(btrim(COALESCE(p_payload #>> '{receipt,cashier_name}', '')), ''),
            v_cashier_name
          ),
          btrim(p_client_mutation_id) || ':receipt'
        )
        ON CONFLICT (order_id) DO NOTHING;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', false,
      'cloud_id', v_order_id,
      'payment_id', v_payment_id,
      'receipt_id', v_receipt_id,
      'payment_status', v_payment_status
    );
  END IF;

  RAISE EXCEPTION 'Type d''événement non supporté: %', p_event_type;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_desktop_outbox_event(text, text, jsonb)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.apply_desktop_outbox_event(text, text, jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.apply_desktop_outbox_event(text, text, jsonb) IS
  'Ingest idempotent des événements sync_outbox Desktop (SERVEUR_CAISSE). auth.uid() requis. Pas de service_role.';
