-- FasoBar e-commerce : les ventes en gros (carton, pack…) peuvent partir en livraison.
--
-- Une ligne de livraison garde l'unité vendue (ex. « Carton de 12 ») et son prix
-- de gros. Le stock du livreur, lui, se compte toujours à l'unité :
--   stock_quantity = quantité × coefficient (1 carton de 12 = 12 unités).
-- Même logique que les lignes de vente caisse (order_items, 20260815223000).
-- Les livraisons existantes (à l'unité) restent identiques : coefficient 1.

-- ---------------------------------------------------------------------------
-- delivery_order_items : unité de vente
-- ---------------------------------------------------------------------------

ALTER TABLE public.delivery_order_items
  ADD COLUMN IF NOT EXISTS unit_level_id uuid
    REFERENCES public.product_unit_levels (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_unit_name text,
  ADD COLUMN IF NOT EXISTS sale_unit_factor numeric(14, 6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stock_quantity numeric(14, 3);

UPDATE public.delivery_order_items
SET stock_quantity = quantity
WHERE stock_quantity IS NULL;

ALTER TABLE public.delivery_order_items
  ALTER COLUMN stock_quantity SET NOT NULL;

ALTER TABLE public.delivery_order_items
  DROP CONSTRAINT IF EXISTS delivery_order_items_stock_quantity_positive;
ALTER TABLE public.delivery_order_items
  ADD CONSTRAINT delivery_order_items_stock_quantity_positive CHECK (stock_quantity > 0);

-- Un même produit peut figurer à l'unité ET en carton dans une livraison.
ALTER TABLE public.delivery_order_items
  DROP CONSTRAINT IF EXISTS delivery_order_items_unique_product;

CREATE UNIQUE INDEX IF NOT EXISTS delivery_order_items_unique_product_unit
  ON public.delivery_order_items (
    delivery_order_id,
    product_id,
    COALESCE(unit_level_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

COMMENT ON COLUMN public.delivery_order_items.quantity IS
  'Quantité dans l''unité vendue (ex. 2 cartons).';
COMMENT ON COLUMN public.delivery_order_items.stock_quantity IS
  'Quantité en unités de stock (quantité × coefficient), débitée au livreur.';

-- ---------------------------------------------------------------------------
-- create_delivery_order — accepte une unité de vente par ligne (unit_level_id)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_delivery_order(
  p_establishment_id uuid,
  p_items jsonb,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_delivery_address text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid;
  v_order_id uuid;
  v_number integer;
  v_line record;
  v_product public.products%ROWTYPE;
  v_unit public.product_unit_levels%ROWTYPE;
  v_unit_price integer;
  v_factor numeric(14, 6);
  v_unit_name text;
  v_line_total integer;
  v_total integer := 0;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  v_org := public.delivery_require_ecommerce(p_establishment_id);

  IF NOT (
    public.delivery_user_is_manager(v_actor, p_establishment_id)
    OR public.user_has_establishment_role(v_actor, p_establishment_id, 'CASHIER_KITCHEN'::public.membership_role)
    OR public.user_has_establishment_role(v_actor, p_establishment_id, 'CASHIER'::public.membership_role)
  ) THEN
    RAISE EXCEPTION 'Permission insuffisante pour créer une commande.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Ajoutez au moins un article.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity numeric, unit_level_id uuid)
    WHERE x.product_id IS NULL OR x.quantity IS NULL OR x.quantity <= 0
  ) THEN
    RAISE EXCEPTION 'Quantité invalide : chaque article doit avoir une quantité positive.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('delivery_orders:' || p_establishment_id::text));

  SELECT COALESCE(max(order_number), 0) + 1 INTO v_number
  FROM public.delivery_orders
  WHERE establishment_id = p_establishment_id;

  INSERT INTO public.delivery_orders (
    organization_id, establishment_id, order_number, status,
    customer_name, customer_phone, delivery_address, note, created_by
  )
  VALUES (
    v_org, p_establishment_id, v_number, 'PENDING'::public.delivery_order_status,
    NULLIF(btrim(COALESCE(p_customer_name, '')), ''),
    NULLIF(btrim(COALESCE(p_customer_phone, '')), ''),
    NULLIF(btrim(COALESCE(p_delivery_address, '')), ''),
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    v_actor
  )
  RETURNING id INTO v_order_id;

  FOR v_line IN
    SELECT x.product_id, x.unit_level_id, round(sum(x.quantity), 3) AS quantity
    FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity numeric, unit_level_id uuid)
    GROUP BY x.product_id, x.unit_level_id
  LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_line.product_id
      AND establishment_id = p_establishment_id
      AND active;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article introuvable ou désactivé.';
    END IF;

    v_unit_price := v_product.selling_price;
    v_factor := 1;
    v_unit_name := NULL;

    IF v_line.unit_level_id IS NOT NULL THEN
      SELECT * INTO v_unit
      FROM public.product_unit_levels ul
      WHERE ul.id = v_line.unit_level_id
        AND ul.product_id = v_product.id
        AND ul.establishment_id = p_establishment_id
        AND ul.sellable = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Format de vente invalide pour « % ».', v_product.name;
      END IF;

      v_factor := public.product_unit_stock_factor(v_unit.id);
      v_unit_price := COALESCE(NULLIF(v_unit.selling_price, 0), round(v_product.selling_price * v_factor)::integer);
      -- Nom affiché seulement pour un format en gros (l'unité de base reste « à l'unité »).
      IF v_factor <> 1 THEN
        v_unit_name := v_unit.name;
      END IF;
    END IF;

    v_line_total := round(v_unit_price * v_line.quantity)::integer;
    v_total := v_total + v_line_total;

    INSERT INTO public.delivery_order_items (
      delivery_order_id, organization_id, establishment_id, product_id,
      product_name, unit_price, quantity, line_total,
      unit_level_id, sale_unit_name, sale_unit_factor, stock_quantity
    )
    VALUES (
      v_order_id, v_org, p_establishment_id, v_product.id,
      v_product.name, v_unit_price, v_line.quantity, v_line_total,
      v_line.unit_level_id,
      v_unit_name, v_factor, round(v_line.quantity * v_factor, 3)
    );
  END LOOP;

  UPDATE public.delivery_orders
  SET total_amount = v_total
  WHERE id = v_order_id;

  RETURN jsonb_build_object('id', v_order_id, 'order_number', v_number);
END;
$$;

-- ---------------------------------------------------------------------------
-- accept_delivery_order — contrôle du stock en unités (cartons convertis)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_delivery_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.delivery_orders%ROWTYPE;
  v_line record;
  v_in_hand numeric(14, 3);
  v_reserved numeric(14, 3);
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT * INTO v_order
  FROM public.delivery_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  PERFORM public.delivery_require_ecommerce(v_order.establishment_id);
  PERFORM public.delivery_require_courier(v_actor, v_order.establishment_id);

  IF v_order.status = 'CANCELLED'::public.delivery_order_status THEN
    RAISE EXCEPTION 'Cette commande a été annulée.';
  END IF;

  IF v_order.status <> 'PENDING'::public.delivery_order_status THEN
    RAISE EXCEPTION 'Cette commande a déjà été prise par un autre livreur.';
  END IF;

  -- Stock en main moins ce qui est déjà réservé par ses autres livraisons en cours.
  FOR v_line IN
    SELECT i.product_id, min(i.product_name) AS product_name, sum(i.stock_quantity) AS quantity
    FROM public.delivery_order_items i
    WHERE i.delivery_order_id = p_order_id
    GROUP BY i.product_id
  LOOP
    SELECT COALESCE(cs.quantity, 0) INTO v_in_hand
    FROM public.courier_stock cs
    WHERE cs.establishment_id = v_order.establishment_id
      AND cs.courier_id = v_actor
      AND cs.product_id = v_line.product_id;

    v_in_hand := COALESCE(v_in_hand, 0);

    SELECT COALESCE(sum(i.stock_quantity), 0) INTO v_reserved
    FROM public.delivery_order_items i
    JOIN public.delivery_orders o ON o.id = i.delivery_order_id
    WHERE o.establishment_id = v_order.establishment_id
      AND o.courier_id = v_actor
      AND o.status = 'ACCEPTED'::public.delivery_order_status
      AND i.product_id = v_line.product_id;

    IF v_in_hand - v_reserved < v_line.quantity THEN
      RAISE EXCEPTION 'Stock insuffisant pour « % » : il vous en reste % disponible(s).',
        v_line.product_name, greatest(v_in_hand - v_reserved, 0);
    END IF;
  END LOOP;

  UPDATE public.delivery_orders
  SET status = 'ACCEPTED'::public.delivery_order_status,
      courier_id = v_actor,
      accepted_at = now()
  WHERE id = p_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- complete_delivery_order — débit du stock livreur en unités
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_delivery_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.delivery_orders%ROWTYPE;
  v_line record;
  v_courier public.courier_stock%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT * INTO v_order
  FROM public.delivery_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  PERFORM public.delivery_require_ecommerce(v_order.establishment_id);

  IF v_order.status <> 'ACCEPTED'::public.delivery_order_status
    OR v_order.courier_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Cette livraison ne vous est pas attribuée.';
  END IF;

  FOR v_line IN
    SELECT i.product_id, min(i.product_name) AS product_name, sum(i.stock_quantity) AS quantity
    FROM public.delivery_order_items i
    WHERE i.delivery_order_id = p_order_id
    GROUP BY i.product_id
    ORDER BY i.product_id
  LOOP
    SELECT * INTO v_courier
    FROM public.courier_stock
    WHERE establishment_id = v_order.establishment_id
      AND courier_id = v_actor
      AND product_id = v_line.product_id
    FOR UPDATE;

    IF NOT FOUND OR v_courier.quantity < v_line.quantity THEN
      RAISE EXCEPTION 'Stock insuffisant pour « % » : % en main.',
        v_line.product_name, COALESCE(v_courier.quantity, 0);
    END IF;

    UPDATE public.courier_stock
    SET quantity = v_courier.quantity - v_line.quantity
    WHERE id = v_courier.id;

    INSERT INTO public.courier_stock_movements (
      organization_id, establishment_id, courier_id, product_id, product_name, type,
      quantity, quantity_before, quantity_after, delivery_order_id, created_by
    )
    VALUES (
      v_order.organization_id, v_order.establishment_id, v_actor, v_line.product_id,
      v_line.product_name, 'DELIVERY'::public.courier_stock_movement_type,
      -v_line.quantity, v_courier.quantity, v_courier.quantity - v_line.quantity,
      p_order_id, v_actor
    );
  END LOOP;

  UPDATE public.delivery_orders
  SET status = 'DELIVERED'::public.delivery_order_status,
      delivered_at = now()
  WHERE id = p_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- cash_delivery_order — la vente garde l'unité vendue (carton…) et son coefficient
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cash_delivery_order(
  p_order_id uuid,
  p_method public.payment_method,
  p_amount_received integer DEFAULT NULL,
  p_transaction_reference text DEFAULT NULL,
  p_provider text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_delivery public.delivery_orders%ROWTYPE;
  v_line record;
  v_sale_id uuid;
  v_sale_number integer;
  v_department_id uuid;
  v_label text;
  v_payment jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_method IS NULL THEN
    RAISE EXCEPTION 'Choisissez un mode de paiement.';
  END IF;

  SELECT * INTO v_delivery
  FROM public.delivery_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  PERFORM public.delivery_require_ecommerce(v_delivery.establishment_id);

  IF NOT (
    public.delivery_user_is_manager(v_actor, v_delivery.establishment_id)
    OR public.user_has_establishment_role(v_actor, v_delivery.establishment_id, 'CASHIER_KITCHEN'::public.membership_role)
    OR public.user_has_establishment_role(v_actor, v_delivery.establishment_id, 'CASHIER'::public.membership_role)
  ) THEN
    RAISE EXCEPTION 'Permission insuffisante pour encaisser cette commande.';
  END IF;

  IF v_delivery.cashed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cette commande a déjà été encaissée.';
  END IF;

  IF v_delivery.status <> 'DELIVERED'::public.delivery_order_status THEN
    RAISE EXCEPTION 'Seule une commande livrée peut être encaissée.';
  END IF;

  IF v_delivery.total_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de commande invalide.';
  END IF;

  -- Encaissement uniquement dans une session de caisse ouverte (tous modes).
  IF public.get_active_cash_session(v_actor, v_delivery.establishment_id) IS NULL THEN
    RAISE EXCEPTION 'Ouvrez votre session de caisse avant d''encaisser.';
  END IF;

  v_label := 'Livraison L-' || lpad(v_delivery.order_number::text, 4, '0');
  v_sale_number := public.next_order_number(v_delivery.establishment_id);

  INSERT INTO public.orders (
    organization_id,
    establishment_id,
    order_number,
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
    stock_posted_at
  )
  VALUES (
    v_delivery.organization_id,
    v_delivery.establishment_id,
    v_sale_number,
    COALESCE(v_delivery.customer_name, v_label),
    'TAKEAWAY'::public.order_type,
    'OPEN'::public.order_status,
    'UNPAID'::public.order_payment_status,
    v_delivery.total_amount,
    0,
    v_delivery.total_amount,
    v_label,
    v_actor,
    v_actor,
    -- Stock déjà sorti vers le livreur : empêche un second débit au paiement.
    now()
  )
  RETURNING id INTO v_sale_id;

  FOR v_line IN
    SELECT i.product_id, i.product_name, i.unit_price, i.quantity, i.line_total,
           i.unit_level_id, i.sale_unit_name, i.sale_unit_factor, i.stock_quantity
    FROM public.delivery_order_items i
    WHERE i.delivery_order_id = p_order_id
    ORDER BY i.product_id, i.sale_unit_factor
  LOOP
    SELECT p.department_id INTO v_department_id
    FROM public.products p
    WHERE p.id = v_line.product_id;

    IF v_department_id IS NULL THEN
      RAISE EXCEPTION 'Article « % » introuvable dans le catalogue.', v_line.product_name;
    END IF;

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
      unit_level_id,
      sale_unit_name,
      sale_unit_factor,
      stock_quantity
    )
    VALUES (
      v_delivery.organization_id,
      v_delivery.establishment_id,
      v_sale_id,
      v_line.product_id,
      v_department_id,
      v_line.product_name,
      v_line.unit_price,
      v_line.quantity,
      v_line.line_total,
      v_line.unit_level_id,
      v_line.sale_unit_name,
      v_line.sale_unit_factor,
      v_line.stock_quantity
    );
  END LOOP;

  -- Chemin officiel : paiement, statut PAID, reçu, fond de caisse, journal.
  v_payment := public.record_order_payment(
    v_sale_id,
    p_method,
    v_delivery.total_amount,
    p_amount_received,
    p_transaction_reference,
    p_provider,
    v_label,
    'delivery-' || p_order_id::text
  );

  UPDATE public.delivery_orders
  SET cashed_at = now(),
      cashed_by = v_actor,
      sale_order_id = v_sale_id
  WHERE id = p_order_id;

  RETURN v_payment || jsonb_build_object(
    'sale_order_id', v_sale_id,
    'sale_order_number', v_sale_number
  );
END;
$$;
