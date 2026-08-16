-- Prix unitaire de vente (conditionnement) envoyé par la caisse.

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
  v_unit_price integer;
  v_line_total integer;
  v_old_bar_sig text := '';
  v_old_kitchen_sig text := '';
  v_prepared_map jsonb := '{}'::jsonb;
  v_prepared numeric(10, 3);
  v_name text;
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

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
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

  v_old_bar_sig := public.order_department_pending_signature(p_order_id, 'BAR'::public.department_code);
  v_old_kitchen_sig := public.order_department_pending_signature(p_order_id, 'KITCHEN'::public.department_code);

  SELECT COALESCE(jsonb_object_agg(oi.product_id::text, to_jsonb(oi.prepared_quantity)), '{}'::jsonb)
  INTO v_prepared_map
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  DELETE FROM public.order_items WHERE order_id = p_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF NOT (v_item ? 'product_id') OR NOT (v_item ? 'quantity') THEN
      RAISE EXCEPTION 'Article de commande invalide.';
    END IF;
    v_quantity := round((v_item ->> 'quantity')::numeric, 3);
    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'La quantité doit être strictement positive.';
    END IF;

    SELECT * INTO v_product
    FROM public.products p
    WHERE p.id = (v_item ->> 'product_id')::uuid
      AND p.establishment_id = v_order.establishment_id
      AND p.active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit introuvable ou inactif.';
    END IF;

    v_unit_price := COALESCE(NULLIF((v_item ->> 'unit_price')::integer, 0), v_product.selling_price);
    v_line_total := round(v_unit_price * v_quantity)::integer;
    v_name := NULLIF(btrim(COALESCE(v_item ->> 'product_name', '')), '');
    v_prepared := LEAST(v_quantity, COALESCE((v_prepared_map ->> v_product.id::text)::numeric, 0));

    INSERT INTO public.order_items (
      organization_id, establishment_id, order_id, product_id, department_id,
      product_name_snapshot, unit_price_snapshot, quantity, prepared_quantity, line_total, notes
    ) VALUES (
      v_order.organization_id, v_order.establishment_id, p_order_id, v_product.id, v_product.department_id,
      COALESCE(v_name, v_product.name), v_unit_price, v_quantity, v_prepared, v_line_total,
      NULLIF(btrim(COALESCE(v_item ->> 'notes', '')), '')
    );
  END LOOP;

  PERFORM public.recalculate_order_totals(p_order_id);
  PERFORM public.apply_order_prep_statuses_from_items(
    p_order_id, p_target_status, v_old_bar_sig, v_old_kitchen_sig
  );
  UPDATE public.orders SET updated_by = v_user_id WHERE id = p_order_id;
  PERFORM public.write_order_audit_log(
    v_order.organization_id, v_order.establishment_id, p_order_id,
    'ORDER_UPDATED'::public.audit_action, v_user_id,
    jsonb_build_object('target_status', p_target_status, 'item_count', jsonb_array_length(p_items))
  );
  RETURN p_order_id;
END;
$$;
