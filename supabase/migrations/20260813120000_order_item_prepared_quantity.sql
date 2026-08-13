-- FasoBar : le bar / la cuisine ne reçoivent que les articles AJOUTÉS
-- après une première préparation (commande reprise en attente).
-- Appliquer manuellement. Ne pas modifier les migrations antérieures.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS prepared_quantity numeric(10, 3) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.order_items.prepared_quantity IS
  'Quantité déjà préparée (bar/cuisine). Le reliquat quantity - prepared_quantity est la nouvelle vague.';

-- Commandes déjà marquées prêtes : tout est considéré préparé.
UPDATE public.order_items oi
SET prepared_quantity = oi.quantity
FROM public.orders o, public.departments d
WHERE oi.order_id = o.id
  AND d.id = oi.department_id
  AND (
    (d.code = 'BAR'::public.department_code AND o.bar_status = 'READY'::public.bar_prep_status)
    OR (
      d.code = 'KITCHEN'::public.department_code
      AND o.kitchen_status IN (
        'READY'::public.kitchen_prep_status,
        'SERVED'::public.kitchen_prep_status
      )
    )
  )
  AND oi.prepared_quantity = 0;

CREATE OR REPLACE FUNCTION public.order_department_pending_signature(
  p_order_id uuid,
  p_department public.department_code
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    string_agg(
      oi.product_id::text || ':' || trim(to_char(oi.quantity - oi.prepared_quantity, 'FM999999990.999')),
      '|'
      ORDER BY oi.product_id
    ),
    ''
  )
  FROM public.order_items oi
  INNER JOIN public.departments d ON d.id = oi.department_id
  WHERE oi.order_id = p_order_id
    AND d.code = p_department
    AND oi.quantity > oi.prepared_quantity;
$$;

CREATE OR REPLACE FUNCTION public.mark_order_department_items_prepared(
  p_order_id uuid,
  p_department public.department_code
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.order_items oi
  SET
    prepared_quantity = oi.quantity,
    updated_at = now()
  FROM public.departments d
  WHERE oi.order_id = p_order_id
    AND oi.department_id = d.id
    AND d.code = p_department;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_order_prep_statuses_from_items(
  p_order_id uuid,
  p_target_status public.order_status,
  p_old_bar_sig text DEFAULT NULL,
  p_old_kitchen_sig text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_has_bar boolean := false;
  v_has_kitchen boolean := false;
  v_new_bar_pending text := '';
  v_new_kitchen_pending text := '';
  v_next_bar public.bar_prep_status;
  v_next_kitchen public.kitchen_prep_status;
  v_bar_pending_changed boolean := false;
  v_kitchen_pending_changed boolean := false;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  SELECT public.order_has_department_items(p_order_id, 'BAR'::public.department_code)
  INTO v_has_bar;

  SELECT public.order_has_department_items(p_order_id, 'KITCHEN'::public.department_code)
  INTO v_has_kitchen;

  v_new_bar_pending := public.order_department_pending_signature(
    p_order_id,
    'BAR'::public.department_code
  );
  v_new_kitchen_pending := public.order_department_pending_signature(
    p_order_id,
    'KITCHEN'::public.department_code
  );

  v_bar_pending_changed := COALESCE(p_old_bar_sig, '') IS DISTINCT FROM v_new_bar_pending;
  v_kitchen_pending_changed := COALESCE(p_old_kitchen_sig, '') IS DISTINCT FROM v_new_kitchen_pending;

  IF NOT v_has_bar OR p_target_status = 'DRAFT'::public.order_status THEN
    v_next_bar := NULL;
  ELSIF v_new_bar_pending <> '' AND (v_order.bar_status IS NULL OR v_bar_pending_changed) THEN
    v_next_bar := 'TO_PREPARE'::public.bar_prep_status;
  ELSIF v_new_bar_pending = '' THEN
    v_next_bar := CASE
      WHEN v_order.bar_status IS NULL THEN NULL
      ELSE 'READY'::public.bar_prep_status
    END;
  ELSE
    v_next_bar := v_order.bar_status;
  END IF;

  IF NOT v_has_kitchen OR p_target_status = 'DRAFT'::public.order_status THEN
    v_next_kitchen := NULL;
  ELSIF v_new_kitchen_pending <> '' AND (v_order.kitchen_status IS NULL OR v_kitchen_pending_changed) THEN
    v_next_kitchen := 'TO_PREPARE'::public.kitchen_prep_status;
  ELSIF v_new_kitchen_pending = '' THEN
    v_next_kitchen := CASE
      WHEN v_order.kitchen_status IS NULL THEN NULL
      WHEN v_order.kitchen_status = 'SERVED'::public.kitchen_prep_status THEN
        'SERVED'::public.kitchen_prep_status
      ELSE 'READY'::public.kitchen_prep_status
    END;
  ELSE
    v_next_kitchen := v_order.kitchen_status;
  END IF;

  UPDATE public.orders
  SET
    status = p_target_status,
    bar_status = v_next_bar,
    bar_status_updated_at = CASE
      WHEN v_next_bar IS NULL THEN NULL
      WHEN v_bar_pending_changed OR v_order.bar_status IS DISTINCT FROM v_next_bar THEN now()
      ELSE bar_status_updated_at
    END,
    kitchen_status = v_next_kitchen,
    kitchen_status_updated_at = CASE
      WHEN v_next_kitchen IS NULL THEN NULL
      WHEN v_kitchen_pending_changed OR v_order.kitchen_status IS DISTINCT FROM v_next_kitchen THEN now()
      ELSE kitchen_status_updated_at
    END,
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_order_items(
  p_order_id uuid,
  p_items jsonb,
  p_target_status public.order_status DEFAULT 'OPEN'::public.order_status
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_order public.orders%ROWTYPE;
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_quantity numeric(10, 3);
  v_line_total integer;
  v_old_bar_sig text := '';
  v_old_kitchen_sig text := '';
  v_prepared_map jsonb := '{}'::jsonb;
  v_prepared numeric(10, 3);
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'La liste des articles est invalide.';
  END IF;

  IF p_target_status NOT IN (
    'DRAFT'::public.order_status,
    'OPEN'::public.order_status,
    'READY_TO_PAY'::public.order_status
  ) THEN
    RAISE EXCEPTION 'Statut cible invalide.';
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
    RAISE EXCEPTION 'Permission insuffisante pour modifier cette commande.';
  END IF;

  IF v_order.payment_status = 'PAID'::public.order_payment_status THEN
    RAISE EXCEPTION 'Une commande payée ne peut plus être modifiée.';
  END IF;

  IF v_order.status = 'CANCELLED'::public.order_status THEN
    RAISE EXCEPTION 'Une commande annulée ne peut plus être modifiée.';
  END IF;

  v_old_bar_sig := public.order_department_pending_signature(
    p_order_id,
    'BAR'::public.department_code
  );
  v_old_kitchen_sig := public.order_department_pending_signature(
    p_order_id,
    'KITCHEN'::public.department_code
  );

  SELECT COALESCE(
    jsonb_object_agg(oi.product_id::text, to_jsonb(oi.prepared_quantity)),
    '{}'::jsonb
  )
  INTO v_prepared_map
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  DELETE FROM public.order_items
  WHERE order_id = p_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF NOT (v_item ? 'product_id') OR NOT (v_item ? 'quantity') THEN
      RAISE EXCEPTION 'Article de commande invalide.';
    END IF;

    v_quantity := round((v_item ->> 'quantity')::numeric, 3);

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'La quantité doit être strictement positive.';
    END IF;

    SELECT *
    INTO v_product
    FROM public.products p
    WHERE p.id = (v_item ->> 'product_id')::uuid
      AND p.establishment_id = v_order.establishment_id
      AND p.active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit introuvable ou inactif.';
    END IF;

    v_line_total := round(v_product.selling_price * v_quantity)::integer;
    v_prepared := LEAST(
      v_quantity,
      COALESCE((v_prepared_map ->> v_product.id::text)::numeric, 0)
    );

    INSERT INTO public.order_items (
      organization_id,
      establishment_id,
      order_id,
      product_id,
      department_id,
      product_name_snapshot,
      unit_price_snapshot,
      quantity,
      prepared_quantity,
      line_total,
      notes
    )
    VALUES (
      v_order.organization_id,
      v_order.establishment_id,
      p_order_id,
      v_product.id,
      v_product.department_id,
      v_product.name,
      v_product.selling_price,
      v_quantity,
      v_prepared,
      v_line_total,
      NULLIF(btrim(COALESCE(v_item ->> 'notes', '')), '')
    );
  END LOOP;

  PERFORM public.recalculate_order_totals(p_order_id);

  PERFORM public.apply_order_prep_statuses_from_items(
    p_order_id,
    p_target_status,
    v_old_bar_sig,
    v_old_kitchen_sig
  );

  UPDATE public.orders
  SET updated_by = v_user_id
  WHERE id = p_order_id;

  PERFORM public.write_order_audit_log(
    v_order.organization_id,
    v_order.establishment_id,
    p_order_id,
    'ORDER_UPDATED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'target_status', p_target_status,
      'item_count', jsonb_array_length(p_items),
      'bar_items_changed', COALESCE(v_old_bar_sig, '') IS DISTINCT FROM
        public.order_department_pending_signature(p_order_id, 'BAR'::public.department_code),
      'kitchen_items_changed', COALESCE(v_old_kitchen_sig, '') IS DISTINCT FROM
        public.order_department_pending_signature(p_order_id, 'KITCHEN'::public.department_code)
    )
  );

  RETURN p_order_id;
END;
$$;

COMMENT ON FUNCTION public.save_order_items(uuid, jsonb, public.order_status) IS
  'Remplace les articles en conservant prepared_quantity. Bar/cuisine ne voient que le reliquat (nouveaux ajouts).';

CREATE OR REPLACE FUNCTION public.desktop_replace_order_items_and_prep(
  p_order_id uuid,
  p_organization_id uuid,
  p_establishment_id uuid,
  p_items jsonb,
  p_target_status public.order_status,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_product_id uuid;
  v_dept_code text;
  v_department_id uuid;
  v_old_bar_sig text := '';
  v_old_kitchen_sig text := '';
  v_user_id uuid := auth.uid();
  v_prepared_map jsonb := '{}'::jsonb;
  v_quantity numeric(10, 3);
  v_prepared numeric(10, 3);
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.establishment_id = p_establishment_id
      AND o.payment_status <> 'PAID'::public.order_payment_status
      AND o.status <> 'CANCELLED'::public.order_status
  ) THEN
    RETURN;
  END IF;

  v_old_bar_sig := public.order_department_pending_signature(
    p_order_id,
    'BAR'::public.department_code
  );
  v_old_kitchen_sig := public.order_department_pending_signature(
    p_order_id,
    'KITCHEN'::public.department_code
  );

  SELECT COALESCE(
    jsonb_object_agg(oi.product_id::text, to_jsonb(oi.prepared_quantity)),
    '{}'::jsonb
  )
  INTO v_prepared_map
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  UPDATE public.orders
  SET
    table_reference = COALESCE(
      NULLIF(btrim(COALESCE(p_payload ->> 'table_reference', '')), ''),
      table_reference
    ),
    customer_reference = COALESCE(
      NULLIF(btrim(COALESCE(p_payload ->> 'customer_reference', '')), ''),
      customer_reference
    ),
    order_type = COALESCE(
      (p_payload ->> 'order_type')::public.order_type,
      order_type
    ),
    notes = COALESCE(
      NULLIF(btrim(COALESCE(p_payload ->> 'notes', '')), ''),
      notes
    ),
    subtotal = COALESCE((p_payload ->> 'subtotal')::integer, subtotal),
    discount_amount = COALESCE((p_payload ->> 'discount_amount')::integer, discount_amount),
    total_amount = COALESCE((p_payload ->> 'total_amount')::integer, total_amount),
    updated_by = COALESCE(v_user_id, updated_by),
    updated_at = now()
  WHERE id = p_order_id;

  DELETE FROM public.order_items WHERE order_id = p_order_id;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_dept_code := upper(COALESCE(v_item ->> 'department_code', 'BAR'));
    v_quantity := COALESCE((v_item ->> 'quantity')::numeric, 1);
    v_prepared := LEAST(
      v_quantity,
      COALESCE(
        (v_item ->> 'prepared_quantity')::numeric,
        (v_prepared_map ->> v_product_id::text)::numeric,
        0
      )
    );

    SELECT d.id INTO v_department_id
    FROM public.departments d
    WHERE d.establishment_id = p_establishment_id
      AND d.code::text = v_dept_code
    LIMIT 1;

    IF v_department_id IS NULL THEN
      SELECT d.id INTO v_department_id
      FROM public.departments d
      WHERE d.establishment_id = p_establishment_id
      ORDER BY d.code
      LIMIT 1;
    END IF;

    IF v_department_id IS NULL THEN
      RAISE EXCEPTION 'Département introuvable pour l''établissement.';
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
      prepared_quantity,
      line_total,
      notes
    )
    VALUES (
      COALESCE(NULLIF(v_item ->> 'id', '')::uuid, gen_random_uuid()),
      p_organization_id,
      p_establishment_id,
      p_order_id,
      v_product_id,
      v_department_id,
      COALESCE(v_item ->> 'product_name_snapshot', 'Article'),
      COALESCE((v_item ->> 'unit_price_snapshot')::integer, 0),
      v_quantity,
      v_prepared,
      COALESCE((v_item ->> 'line_total')::integer, 0),
      NULLIF(btrim(COALESCE(v_item ->> 'notes', '')), '')
    );
  END LOOP;

  PERFORM public.recalculate_order_totals(p_order_id);

  PERFORM public.apply_order_prep_statuses_from_items(
    p_order_id,
    p_target_status,
    v_old_bar_sig,
    v_old_kitchen_sig
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_order_bar_status(
  p_order_id uuid,
  p_status public.bar_prep_status
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_order public.orders%ROWTYPE;
  v_session_id uuid;
  v_previous public.bar_prep_status;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  IF NOT public.user_has_department_manager_role(
    v_user_id,
    v_order.establishment_id,
    'BAR'::public.department_code
  )
  AND NOT public.user_can_manage_products(v_user_id, v_order.establishment_id) THEN
    RAISE EXCEPTION 'Permission insuffisante pour gérer le bar.';
  END IF;

  IF public.user_is_bar_session_operator(v_user_id, v_order.establishment_id) THEN
    v_session_id := public.get_active_bar_session(v_user_id, v_order.establishment_id);
    IF v_session_id IS NULL THEN
      RAISE EXCEPTION 'Ouvrez votre service bar avant de préparer les commandes.';
    END IF;
  END IF;

  IF v_order.status = 'CANCELLED'::public.order_status THEN
    RAISE EXCEPTION 'Seules les commandes actives peuvent être préparées.';
  END IF;

  IF v_order.payment_status = 'PAID'::public.order_payment_status THEN
    RAISE EXCEPTION 'Seules les commandes non payées peuvent être préparées.';
  END IF;

  IF NOT public.order_has_department_items(p_order_id, 'BAR'::public.department_code) THEN
    RAISE EXCEPTION 'Cette commande ne contient aucun article bar.';
  END IF;

  IF v_order.bar_status IS NULL THEN
    RAISE EXCEPTION 'Cette commande n''a pas de préparation bar en cours.';
  END IF;

  v_previous := v_order.bar_status;

  UPDATE public.orders
  SET
    bar_status = p_status,
    bar_status_updated_at = now(),
    updated_by = v_user_id,
    updated_at = now()
  WHERE id = p_order_id;

  IF p_status = 'READY'::public.bar_prep_status THEN
    PERFORM public.mark_order_department_items_prepared(
      p_order_id,
      'BAR'::public.department_code
    );
  END IF;

  IF v_session_id IS NOT NULL
     AND p_status = 'READY'::public.bar_prep_status
     AND v_previous IS DISTINCT FROM 'READY'::public.bar_prep_status THEN
    UPDATE public.bar_sessions
    SET
      orders_ready_count = orders_ready_count + 1,
      updated_at = now()
    WHERE id = v_session_id
      AND status = 'OPEN'::public.bar_session_status;
  END IF;

  PERFORM public.write_order_audit_log(
    v_order.organization_id,
    v_order.establishment_id,
    p_order_id,
    'ORDER_UPDATED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'bar_status', p_status,
      'bar_session_id', v_session_id
    )
  );

  RETURN p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_order_kitchen_status(
  p_order_id uuid,
  p_status public.kitchen_prep_status
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_order public.orders%ROWTYPE;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  IF NOT (
    public.user_can_manage_orders(v_user_id, v_order.establishment_id)
    OR public.user_has_department_manager_role(
      v_user_id,
      v_order.establishment_id,
      'KITCHEN'::public.department_code
    )
  ) THEN
    RAISE EXCEPTION 'Permission insuffisante pour modifier le statut cuisine.';
  END IF;

  IF v_order.kitchen_status IS NULL THEN
    RAISE EXCEPTION 'Cette commande n''a pas de préparation cuisine.';
  END IF;

  UPDATE public.orders
  SET
    kitchen_status = p_status,
    kitchen_status_updated_at = now(),
    updated_by = v_user_id,
    updated_at = now()
  WHERE id = p_order_id;

  IF p_status IN (
    'READY'::public.kitchen_prep_status,
    'SERVED'::public.kitchen_prep_status
  ) THEN
    PERFORM public.mark_order_department_items_prepared(
      p_order_id,
      'KITCHEN'::public.department_code
    );
  END IF;

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.order_department_pending_signature(uuid, public.department_code) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_order_department_items_prepared(uuid, public.department_code) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_department_pending_signature(uuid, public.department_code) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_department_items_prepared(uuid, public.department_code) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_order_items(uuid, jsonb, public.order_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_order_prep_statuses_from_items(uuid, public.order_status, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_bar_status(uuid, public.bar_prep_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_kitchen_status(uuid, public.kitchen_prep_status) TO authenticated;
