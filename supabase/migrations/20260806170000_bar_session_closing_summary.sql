-- FasoBar: bilan complet de clôture session Responsable Bar
-- Snapshot JSON + compteurs étendus. Fichier uniquement — à appliquer manuellement.

ALTER TABLE public.bar_sessions
  ADD COLUMN IF NOT EXISTS closing_summary jsonb,
  ADD COLUMN IF NOT EXISTS closing_orders_received_count integer,
  ADD COLUMN IF NOT EXISTS closing_orders_served_count integer,
  ADD COLUMN IF NOT EXISTS closing_orders_validated_count integer,
  ADD COLUMN IF NOT EXISTS closing_drinks_out_qty numeric(14, 3),
  ADD COLUMN IF NOT EXISTS closing_stock_corrections_count integer;

-- ---------------------------------------------------------------------------
-- Preview / calcul du bilan (sans fermer)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_bar_session_closing_summary(
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_session public.bar_sessions%ROWTYPE;
  v_bar_department_id uuid;
  v_opened_at timestamptz;
  v_orders_received integer := 0;
  v_orders_served integer := 0;
  v_orders_validated integer := 0;
  v_orders_pending integer := 0;
  v_drinks_out_qty numeric(14, 3) := 0;
  v_entries_count integer := 0;
  v_entries_cost integer := 0;
  v_losses_count integer := 0;
  v_losses_qty numeric(14, 3) := 0;
  v_corrections_count integer := 0;
  v_low_stock integer := 0;
  v_drinks_by_product jsonb := '[]'::jsonb;
  v_entries_by_product jsonb := '[]'::jsonb;
  v_losses_by_product jsonb := '[]'::jsonb;
  v_corrections_by_product jsonb := '[]'::jsonb;
  v_theoretical_stock jsonb := '[]'::jsonb;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT *
  INTO v_session
  FROM public.bar_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session bar introuvable.';
  END IF;

  IF NOT public.user_can_read_bar_session(v_user_id, p_session_id) THEN
    RAISE EXCEPTION 'Permission insuffisante pour consulter ce bilan.';
  END IF;

  -- Session déjà clôturée avec snapshot : renvoyer le snapshot
  IF v_session.status = 'CLOSED'::public.bar_session_status
     AND v_session.closing_summary IS NOT NULL THEN
    RETURN v_session.closing_summary;
  END IF;

  v_opened_at := v_session.opened_at;

  SELECT d.id
  INTO v_bar_department_id
  FROM public.departments d
  WHERE d.establishment_id = v_session.establishment_id
    AND d.code = 'BAR'::public.department_code
  LIMIT 1;

  -- Commandes reçues : tickets bar touchés pendant la session
  SELECT COUNT(*)::integer
  INTO v_orders_received
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status <> 'CANCELLED'::public.order_status
    AND o.bar_status IS NOT NULL
    AND COALESCE(o.bar_status_updated_at, o.created_at) >= v_opened_at
    AND COALESCE(o.bar_status_updated_at, o.created_at) <= COALESCE(v_session.closed_at, now());

  -- Commandes servies : marquées READY pendant la session (compteur session)
  v_orders_served := COALESCE(v_session.orders_ready_count, 0);

  -- Commandes validées : passées au moins en préparation / prêtes pendant la session
  SELECT COUNT(*)::integer
  INTO v_orders_validated
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status <> 'CANCELLED'::public.order_status
    AND o.bar_status IN (
      'IN_PREPARATION'::public.bar_prep_status,
      'READY'::public.bar_prep_status
    )
    AND COALESCE(o.bar_status_updated_at, o.created_at) >= v_opened_at
    AND COALESCE(o.bar_status_updated_at, o.created_at) <= COALESCE(v_session.closed_at, now());

  -- Encore en attente (non prêtes, non payées)
  SELECT COUNT(*)::integer
  INTO v_orders_pending
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status <> 'CANCELLED'::public.order_status
    AND o.payment_status <> 'PAID'::public.order_payment_status
    AND o.bar_status IN (
      'TO_PREPARE'::public.bar_prep_status,
      'IN_PREPARATION'::public.bar_prep_status
    );

  -- Boissons sorties par produit (commandes READY pendant la session)
  SELECT
    COALESCE(SUM(x.qty), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'product_name', x.product_name,
          'quantity', x.qty
        )
        ORDER BY x.product_name
      ),
      '[]'::jsonb
    )
  INTO v_drinks_out_qty, v_drinks_by_product
  FROM (
    SELECT
      oi.product_name_snapshot AS product_name,
      SUM(oi.quantity)::numeric AS qty
    FROM public.orders o
    INNER JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.establishment_id = v_session.establishment_id
      AND o.status <> 'CANCELLED'::public.order_status
      AND o.bar_status = 'READY'::public.bar_prep_status
      AND COALESCE(o.bar_status_updated_at, o.created_at) >= v_opened_at
      AND COALESCE(o.bar_status_updated_at, o.created_at) <= COALESCE(v_session.closed_at, now())
      AND oi.department_id = v_bar_department_id
    GROUP BY oi.product_name_snapshot
  ) x;

  -- Mouvements stock rattachés à la session
  SELECT
    COUNT(*) FILTER (
      WHERE sm.type IN (
        'PURCHASE'::public.stock_movement_type,
        'MANUAL_ENTRY'::public.stock_movement_type,
        'TRANSFER_IN'::public.stock_movement_type
      )
    )::integer,
    COALESCE(
      SUM(sm.total_cost) FILTER (
        WHERE sm.type IN (
          'PURCHASE'::public.stock_movement_type,
          'MANUAL_ENTRY'::public.stock_movement_type,
          'TRANSFER_IN'::public.stock_movement_type
        )
      ),
      0
    )::integer,
    COUNT(*) FILTER (
      WHERE sm.type IN (
        'LOSS'::public.stock_movement_type,
        'BREAKAGE'::public.stock_movement_type,
        'STAFF_CONSUMPTION'::public.stock_movement_type,
        'GIFT'::public.stock_movement_type
      )
    )::integer,
    COALESCE(
      SUM(ABS(sm.quantity)) FILTER (
        WHERE sm.type IN (
          'LOSS'::public.stock_movement_type,
          'BREAKAGE'::public.stock_movement_type,
          'STAFF_CONSUMPTION'::public.stock_movement_type,
          'GIFT'::public.stock_movement_type
        )
      ),
      0
    ),
    COUNT(*) FILTER (
      WHERE sm.type IN (
        'INVENTORY_ADJUSTMENT'::public.stock_movement_type,
        'TRANSFER_OUT'::public.stock_movement_type
      )
      OR sm.type::text ILIKE '%CORRECTION%'
    )::integer
  INTO
    v_entries_count,
    v_entries_cost,
    v_losses_count,
    v_losses_qty,
    v_corrections_count
  FROM public.stock_movements sm
  WHERE sm.bar_session_id = p_session_id;

  -- Détail entrées / pertes / corrections par produit
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_name', x.product_name,
        'quantity', x.qty,
        'unit', x.unit
      )
      ORDER BY x.product_name
    ),
    '[]'::jsonb
  )
  INTO v_entries_by_product
  FROM (
    SELECT
      si.name AS product_name,
      si.unit,
      SUM(sm.quantity)::numeric AS qty
    FROM public.stock_movements sm
    INNER JOIN public.stock_items si ON si.id = sm.stock_item_id
    WHERE sm.bar_session_id = p_session_id
      AND sm.type IN (
        'PURCHASE'::public.stock_movement_type,
        'MANUAL_ENTRY'::public.stock_movement_type,
        'TRANSFER_IN'::public.stock_movement_type
      )
    GROUP BY si.name, si.unit
  ) x;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_name', x.product_name,
        'quantity', x.qty,
        'unit', x.unit
      )
      ORDER BY x.product_name
    ),
    '[]'::jsonb
  )
  INTO v_losses_by_product
  FROM (
    SELECT
      si.name AS product_name,
      si.unit,
      SUM(ABS(sm.quantity))::numeric AS qty
    FROM public.stock_movements sm
    INNER JOIN public.stock_items si ON si.id = sm.stock_item_id
    WHERE sm.bar_session_id = p_session_id
      AND sm.type IN (
        'LOSS'::public.stock_movement_type,
        'BREAKAGE'::public.stock_movement_type,
        'STAFF_CONSUMPTION'::public.stock_movement_type,
        'GIFT'::public.stock_movement_type
      )
    GROUP BY si.name, si.unit
  ) x;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_name', x.product_name,
        'quantity', x.qty,
        'unit', x.unit,
        'type', x.movement_type
      )
      ORDER BY x.product_name
    ),
    '[]'::jsonb
  )
  INTO v_corrections_by_product
  FROM (
    SELECT
      si.name AS product_name,
      si.unit,
      sm.type::text AS movement_type,
      SUM(sm.quantity)::numeric AS qty
    FROM public.stock_movements sm
    INNER JOIN public.stock_items si ON si.id = sm.stock_item_id
    WHERE sm.bar_session_id = p_session_id
      AND sm.type IN (
        'INVENTORY_ADJUSTMENT'::public.stock_movement_type,
        'TRANSFER_OUT'::public.stock_movement_type
      )
    GROUP BY si.name, si.unit, sm.type
  ) x;

  -- Stock théorique final = stock actuel BAR (pas d'inventaire physique)
  SELECT COUNT(*)::integer
  INTO v_low_stock
  FROM public.stock_items si
  WHERE si.establishment_id = v_session.establishment_id
    AND si.department_id = v_bar_department_id
    AND si.active = true
    AND si.current_quantity <= si.minimum_quantity;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'stock_item_id', si.id,
        'product_name', si.name,
        'unit', si.unit,
        'quantity', si.current_quantity,
        'minimum_quantity', si.minimum_quantity,
        'is_low', si.current_quantity <= si.minimum_quantity
      )
      ORDER BY si.name
    ),
    '[]'::jsonb
  )
  INTO v_theoretical_stock
  FROM public.stock_items si
  WHERE si.establishment_id = v_session.establishment_id
    AND si.department_id = v_bar_department_id
    AND si.active = true;

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'opened_at', v_opened_at,
    'closed_at', COALESCE(v_session.closed_at, now()),
    'opened_by', v_session.opened_by,
    'orders_received_count', COALESCE(v_orders_received, 0),
    'orders_served_count', COALESCE(v_orders_served, 0),
    'orders_validated_count', COALESCE(v_orders_validated, 0),
    'orders_pending_count', COALESCE(v_orders_pending, 0),
    'drinks_out_qty', COALESCE(v_drinks_out_qty, 0),
    'drinks_by_product', COALESCE(v_drinks_by_product, '[]'::jsonb),
    'stock_entries_count', COALESCE(v_entries_count, 0),
    'stock_entries_cost', COALESCE(v_entries_cost, 0),
    'stock_entries_by_product', COALESCE(v_entries_by_product, '[]'::jsonb),
    'stock_losses_count', COALESCE(v_losses_count, 0),
    'stock_losses_qty', COALESCE(v_losses_qty, 0),
    'stock_losses_by_product', COALESCE(v_losses_by_product, '[]'::jsonb),
    'stock_corrections_count', COALESCE(v_corrections_count, 0),
    'stock_corrections_by_product', COALESCE(v_corrections_by_product, '[]'::jsonb),
    'low_stock_count', COALESCE(v_low_stock, 0),
    'theoretical_stock', COALESCE(v_theoretical_stock, '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Fermeture : calcule, verrouille, conserve le bilan
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.close_bar_session(
  p_session_id uuid,
  p_closing_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_session public.bar_sessions%ROWTYPE;
  v_summary jsonb;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT *
  INTO v_session
  FROM public.bar_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session bar introuvable.';
  END IF;

  IF v_session.opened_by <> v_user_id
     OR NOT public.user_is_bar_session_operator(v_user_id, v_session.establishment_id) THEN
    RAISE EXCEPTION 'Vous ne pouvez fermer que votre propre service bar.';
  END IF;

  IF v_session.status <> 'OPEN'::public.bar_session_status THEN
    RAISE EXCEPTION 'Ce service bar est déjà fermé.';
  END IF;

  v_summary := public.get_bar_session_closing_summary(p_session_id);

  UPDATE public.bar_sessions
  SET
    status = 'CLOSED'::public.bar_session_status,
    closed_by = v_user_id,
    closing_note = NULLIF(btrim(p_closing_note), ''),
    closing_summary = v_summary,
    closing_orders_pending_count = COALESCE((v_summary ->> 'orders_pending_count')::integer, 0),
    closing_orders_received_count = COALESCE((v_summary ->> 'orders_received_count')::integer, 0),
    closing_orders_served_count = COALESCE((v_summary ->> 'orders_served_count')::integer, 0),
    closing_orders_validated_count = COALESCE((v_summary ->> 'orders_validated_count')::integer, 0),
    closing_drinks_out_qty = COALESCE((v_summary ->> 'drinks_out_qty')::numeric, 0),
    closing_stock_entries_count = COALESCE((v_summary ->> 'stock_entries_count')::integer, 0),
    closing_stock_entries_cost = COALESCE((v_summary ->> 'stock_entries_cost')::integer, 0),
    closing_stock_losses_count = COALESCE((v_summary ->> 'stock_losses_count')::integer, 0),
    closing_stock_losses_qty = COALESCE((v_summary ->> 'stock_losses_qty')::numeric, 0),
    closing_stock_corrections_count = COALESCE((v_summary ->> 'stock_corrections_count')::integer, 0),
    closing_low_stock_count = COALESCE((v_summary ->> 'low_stock_count')::integer, 0),
    closed_at = now(),
    updated_at = now()
  WHERE id = p_session_id;

  -- Enrichir le snapshot avec closers / horodatage définitifs
  v_summary := v_summary || jsonb_build_object(
    'closed_at', now(),
    'closed_by', v_user_id,
    'closing_note', NULLIF(btrim(p_closing_note), '')
  );

  UPDATE public.bar_sessions
  SET closing_summary = v_summary
  WHERE id = p_session_id;

  PERFORM public.write_bar_session_audit_log(
    v_session.organization_id,
    v_session.establishment_id,
    p_session_id,
    'BAR_SESSION_CLOSED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'orders_received_count', v_summary -> 'orders_received_count',
      'orders_served_count', v_summary -> 'orders_served_count',
      'orders_validated_count', v_summary -> 'orders_validated_count',
      'drinks_out_qty', v_summary -> 'drinks_out_qty',
      'stock_entries_count', v_summary -> 'stock_entries_count',
      'stock_losses_count', v_summary -> 'stock_losses_count',
      'stock_corrections_count', v_summary -> 'stock_corrections_count'
    )
  );

  RETURN v_summary;
END;
$$;

REVOKE ALL ON FUNCTION public.get_bar_session_closing_summary(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_bar_session(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bar_session_closing_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_bar_session(uuid, text) TO authenticated;
