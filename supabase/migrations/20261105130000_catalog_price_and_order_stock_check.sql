-- 1) Prix de vente imposé par le catalogue : save_order_items ignore le prix
--    envoyé par la caisse et reprend celui de l'unité de vente ou du produit.
--    Aucune caisse ne permet de modifier un prix : rien ne change à l'usage,
--    on empêche seulement d'enregistrer une vente sous le prix fixé.
--
-- 2) Restaurant / maquis / bar : « stock insuffisant = pas de vente » est
--    vérifié dès la prise de commande, et plus seulement à l'encaissement
--    (quand le client a déjà été servi). Le stock compté tient compte des
--    autres commandes envoyées et non payées du même produit. Une commande
--    mise de côté (DRAFT) est un simple mémo : elle ne réserve rien et n'est
--    contrôlée qu'au moment où on la réveille. Les autres activités ne
--    changent pas (e-commerce : vente possible avec le stock des livreurs).
--
-- 3) Remise en état si une version précédente de ce fichier (autorisant le
--    stock négatif) a déjà été exécutée : contraintes rétablies (NOT VALID :
--    contrôle des nouvelles écritures sans bloquer sur l'existant), trigger
--    supprimé, apply_paid_order_stock d'origine. Sans effet sinon.

DROP TRIGGER IF EXISTS stock_items_non_negative ON public.stock_items;
DROP FUNCTION IF EXISTS public.trg_stock_items_non_negative();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_items_current_quantity_non_negative'
  ) THEN
    ALTER TABLE public.stock_items
      ADD CONSTRAINT stock_items_current_quantity_non_negative
      CHECK (current_quantity >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_movements_quantity_before_non_negative'
  ) THEN
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT stock_movements_quantity_before_non_negative
      CHECK (quantity_before >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_movements_quantity_after_non_negative'
  ) THEN
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT stock_movements_quantity_after_non_negative
      CHECK (quantity_after >= 0) NOT VALID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_paid_order_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item public.order_items%ROWTYPE;
  v_stock public.stock_items%ROWTYPE;
  v_qty numeric(14, 3);
  v_before numeric(14, 3);
  v_after numeric(14, 3);
  v_movement_id uuid;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  IF v_order.payment_status IS DISTINCT FROM 'PAID'::public.order_payment_status THEN
    RETURN;
  END IF;

  IF v_order.stock_posted_at IS NOT NULL THEN
    RETURN;
  END IF;

  FOR v_item IN
    SELECT *
    FROM public.order_items
    WHERE order_id = p_order_id
    ORDER BY created_at, id
  LOOP
    v_qty := COALESCE(NULLIF(v_item.stock_quantity, 0), round(v_item.quantity * COALESCE(v_item.sale_unit_factor, 1), 3));
    IF v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT si.*
    INTO v_stock
    FROM public.stock_items si
    WHERE si.product_id = v_item.product_id
      AND si.establishment_id = v_order.establishment_id
    ORDER BY si.id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_before := v_stock.current_quantity;
    v_after := v_before - v_qty;
    IF v_after < 0 THEN
      RAISE EXCEPTION 'Stock insuffisant pour enregistrer cette vente.';
    END IF;

    UPDATE public.stock_items
    SET current_quantity = v_after, updated_at = now()
    WHERE id = v_stock.id;

    INSERT INTO public.stock_movements (
      organization_id,
      establishment_id,
      stock_item_id,
      type,
      quantity,
      quantity_before,
      quantity_after,
      reason,
      created_by
    )
    VALUES (
      v_stock.organization_id,
      v_stock.establishment_id,
      v_stock.id,
      'SALE'::public.stock_movement_type,
      -v_qty,
      v_before,
      v_after,
      'Vente ' || v_order.order_number::text,
      v_order.created_by
    )
    RETURNING id INTO v_movement_id;
  END LOOP;

  UPDATE public.orders
  SET stock_posted_at = now()
  WHERE id = p_order_id
    AND stock_posted_at IS NULL;
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
  v_unit_price integer;
  v_line_total integer;
  v_old_bar_sig text := '';
  v_old_kitchen_sig text := '';
  v_prepared_map jsonb := '{}'::jsonb;
  v_prepared numeric(10, 3);
  v_name text;
  v_unit_id uuid;
  v_unit public.product_unit_levels%ROWTYPE;
  v_factor numeric(14, 6);
  v_stock_qty numeric(14, 3);
  v_unit_name text;
  v_prep_key text;
  v_check_stock boolean;
  v_old_stock_map jsonb := '{}'::jsonb;
  v_need record;
  v_stock public.stock_items%ROWTYPE;
  v_reserved numeric(14, 3);
  v_available numeric(14, 3);
  v_message text;
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

  SELECT COALESCE(
    jsonb_object_agg(
      oi.product_id::text || ':' || COALESCE(oi.unit_level_id::text, ''),
      to_jsonb(oi.prepared_quantity)
    ),
    '{}'::jsonb
  )
  INTO v_prepared_map
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  -- Restaurant / maquis / bar (activité vide = anciens comptes restaurant).
  SELECT COALESCE(e.activity_code, 'restaurant') = 'restaurant'
  INTO v_check_stock
  FROM public.establishments e
  WHERE e.id = v_order.establishment_id;
  -- Mise de côté (DRAFT) = simple mémo : jamais bloquée par le stock.
  v_check_stock := COALESCE(v_check_stock, false)
    AND p_target_status <> 'DRAFT'::public.order_status;

  -- Quantités déjà commandées : seule une hausse est contrôlée, pour ne pas
  -- bloquer la modification d'une commande déjà servie. Une commande mise de
  -- côté qu'on réveille n'a jamais été contrôlée : tout est vérifié.
  IF v_order.status <> 'DRAFT'::public.order_status THEN
    SELECT COALESCE(jsonb_object_agg(t.product_id::text, to_jsonb(t.qty)), '{}'::jsonb)
    INTO v_old_stock_map
    FROM (
      SELECT
        oi.product_id,
        SUM(COALESCE(NULLIF(oi.stock_quantity, 0), oi.quantity * COALESCE(oi.sale_unit_factor, 1))) AS qty
      FROM public.order_items oi
      WHERE oi.order_id = p_order_id
      GROUP BY oi.product_id
    ) t;
  END IF;

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

    v_unit_id := NULLIF(btrim(COALESCE(v_item ->> 'unit_level_id', '')), '')::uuid;
    v_factor := 1;
    v_unit_name := NULL;
    v_unit := NULL;

    IF v_unit_id IS NOT NULL THEN
      SELECT * INTO v_unit
      FROM public.product_unit_levels ul
      WHERE ul.id = v_unit_id
        AND ul.product_id = v_product.id
        AND ul.sellable = true;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Unité de vente invalide pour ce produit.';
      END IF;
      v_factor := public.product_unit_stock_factor(v_unit.id);
      v_unit_name := v_unit.name;
    END IF;

    -- Prix du catalogue uniquement (le unit_price envoyé est ignoré).
    v_unit_price := v_product.selling_price;
    IF v_unit_id IS NOT NULL THEN
      v_unit_price := COALESCE(
        NULLIF(v_unit.selling_price, 0),
        v_product.selling_price
      );
    END IF;
    v_line_total := round(v_unit_price * v_quantity)::integer;
    v_name := NULLIF(btrim(COALESCE(v_item ->> 'product_name', '')), '');
    v_stock_qty := round(v_quantity * v_factor, 3);
    v_prep_key := v_product.id::text || ':' || COALESCE(v_unit_id::text, '');
    v_prepared := LEAST(v_quantity, COALESCE((v_prepared_map ->> v_prep_key)::numeric, 0));

    INSERT INTO public.order_items (
      organization_id, establishment_id, order_id, product_id, department_id,
      product_name_snapshot, unit_price_snapshot, quantity, prepared_quantity, line_total, notes,
      unit_level_id, sale_unit_name, sale_unit_factor, stock_quantity
    ) VALUES (
      v_order.organization_id, v_order.establishment_id, p_order_id, v_product.id, v_product.department_id,
      COALESCE(v_name, v_product.name), v_unit_price, v_quantity, v_prepared, v_line_total,
      NULLIF(btrim(COALESCE(v_item ->> 'notes', '')), ''),
      v_unit_id, v_unit_name, v_factor, v_stock_qty
    );
  END LOOP;

  IF v_check_stock THEN
    FOR v_need IN
      SELECT
        oi.product_id,
        p.name AS product_name,
        SUM(COALESCE(NULLIF(oi.stock_quantity, 0), oi.quantity * COALESCE(oi.sale_unit_factor, 1))) AS qty
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = p_order_id
      GROUP BY oi.product_id, p.name
    LOOP
      IF v_need.qty <= COALESCE((v_old_stock_map ->> v_need.product_id::text)::numeric, 0) THEN
        CONTINUE;
      END IF;

      -- Même article de stock que le débit à l'encaissement (apply_paid_order_stock).
      SELECT si.*
      INTO v_stock
      FROM public.stock_items si
      WHERE si.product_id = v_need.product_id
        AND si.establishment_id = v_order.establishment_id
      ORDER BY si.id
      LIMIT 1
      FOR UPDATE;

      -- Produit sans suivi de stock (plats cuisine) : pas de contrôle.
      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      SELECT COALESCE(SUM(COALESCE(NULLIF(oi.stock_quantity, 0), oi.quantity * COALESCE(oi.sale_unit_factor, 1))), 0)
      INTO v_reserved
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.product_id = v_need.product_id
        AND o.establishment_id = v_order.establishment_id
        AND o.id <> p_order_id
        -- Les commandes mises de côté (DRAFT) ne réservent rien.
        AND o.status IN (
          'OPEN'::public.order_status,
          'READY_TO_PAY'::public.order_status
        )
        AND o.payment_status <> 'PAID'::public.order_payment_status
        AND o.stock_posted_at IS NULL;

      v_available := v_stock.current_quantity - v_reserved;

      IF v_need.qty > v_available THEN
        v_message := format(
          'Stock insuffisant pour « %s » : %s disponible(s), %s demandé(s)',
          v_need.product_name,
          rtrim(rtrim(to_char(GREATEST(v_available, 0), 'FM999999990.999'), '0'), '.'),
          rtrim(rtrim(to_char(v_need.qty, 'FM999999990.999'), '0'), '.')
        );
        IF v_reserved > 0 THEN
          v_message := v_message || format(
            ' — %s déjà dans d''autres commandes non payées',
            rtrim(rtrim(to_char(v_reserved, 'FM999999990.999'), '0'), '.')
          );
        END IF;
        RAISE EXCEPTION '%.', v_message;
      END IF;
    END LOOP;
  END IF;

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
