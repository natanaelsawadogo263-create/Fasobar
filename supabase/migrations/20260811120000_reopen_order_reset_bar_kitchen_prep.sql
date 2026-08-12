-- FasoBar: quand la caisse rouvre une commande (ex. READY_TO_PAY) et ajoute
-- des boissons / plats, renvoyer la commande en « à préparer » côté bar / cuisine.
-- Appliquer manuellement. Ne pas modifier les migrations antérieures.

-- Signature stable des lignes d'un département (détecte ajouts / quantités).
CREATE OR REPLACE FUNCTION public.order_department_item_signature(
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
      oi.product_id::text || ':' || trim(to_char(oi.quantity, 'FM999999990.999')),
      '|'
      ORDER BY oi.product_id
    ),
    ''
  )
  FROM public.order_items oi
  INNER JOIN public.departments d ON d.id = oi.department_id
  WHERE oi.order_id = p_order_id
    AND d.code = p_department;
$$;

-- Applique bar_status / kitchen_status après (re)écriture des articles.
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
  v_new_bar_sig text := '';
  v_new_kitchen_sig text := '';
  v_next_bar public.bar_prep_status;
  v_next_kitchen public.kitchen_prep_status;
  v_bar_changed boolean := false;
  v_kitchen_changed boolean := false;
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

  v_new_bar_sig := public.order_department_item_signature(
    p_order_id,
    'BAR'::public.department_code
  );
  v_new_kitchen_sig := public.order_department_item_signature(
    p_order_id,
    'KITCHEN'::public.department_code
  );

  v_bar_changed := COALESCE(p_old_bar_sig, '') IS DISTINCT FROM v_new_bar_sig;
  v_kitchen_changed := COALESCE(p_old_kitchen_sig, '') IS DISTINCT FROM v_new_kitchen_sig;

  IF NOT v_has_bar OR p_target_status = 'DRAFT'::public.order_status THEN
    v_next_bar := NULL;
  ELSIF v_order.bar_status IS NULL OR v_bar_changed THEN
    -- Première boisson, ou nouveaux/ajoutés produits bar → à préparer
    v_next_bar := 'TO_PREPARE'::public.bar_prep_status;
  ELSE
    v_next_bar := v_order.bar_status;
  END IF;

  IF NOT v_has_kitchen OR p_target_status = 'DRAFT'::public.order_status THEN
    v_next_kitchen := NULL;
  ELSIF v_order.kitchen_status IS NULL OR v_kitchen_changed THEN
    v_next_kitchen := 'TO_PREPARE'::public.kitchen_prep_status;
  ELSE
    v_next_kitchen := v_order.kitchen_status;
  END IF;

  UPDATE public.orders
  SET
    status = p_target_status,
    bar_status = v_next_bar,
    bar_status_updated_at = CASE
      WHEN v_next_bar IS NULL THEN NULL
      WHEN v_bar_changed OR v_order.bar_status IS DISTINCT FROM v_next_bar THEN now()
      ELSE bar_status_updated_at
    END,
    kitchen_status = v_next_kitchen,
    kitchen_status_updated_at = CASE
      WHEN v_next_kitchen IS NULL THEN NULL
      WHEN v_kitchen_changed OR v_order.kitchen_status IS DISTINCT FROM v_next_kitchen THEN now()
      ELSE kitchen_status_updated_at
    END,
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;

-- save_order_items : détecte le changement BAR/KITCHEN avant remplacement des lignes
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

  v_old_bar_sig := public.order_department_item_signature(
    p_order_id,
    'BAR'::public.department_code
  );
  v_old_kitchen_sig := public.order_department_item_signature(
    p_order_id,
    'KITCHEN'::public.department_code
  );

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

    INSERT INTO public.order_items (
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
      v_order.organization_id,
      v_order.establishment_id,
      p_order_id,
      v_product.id,
      v_product.department_id,
      v_product.name,
      v_product.selling_price,
      v_quantity,
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
        public.order_department_item_signature(p_order_id, 'BAR'::public.department_code),
      'kitchen_items_changed', COALESCE(v_old_kitchen_sig, '') IS DISTINCT FROM
        public.order_department_item_signature(p_order_id, 'KITCHEN'::public.department_code)
    )
  );

  RETURN p_order_id;
END;
$$;

COMMENT ON FUNCTION public.save_order_items(uuid, jsonb, public.order_status) IS
  'Remplace les articles et renvoie bar/cuisine en TO_PREPARE si le contenu du département a changé (ex. ajout boissons sur commande à encaisser).';

-- Remplace les lignes d'une commande desktop déjà synchronisée + refresh prep.
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

  v_old_bar_sig := public.order_department_item_signature(
    p_order_id,
    'BAR'::public.department_code
  );
  v_old_kitchen_sig := public.order_department_item_signature(
    p_order_id,
    'KITCHEN'::public.department_code
  );

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
      COALESCE((v_item ->> 'quantity')::numeric, 1),
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