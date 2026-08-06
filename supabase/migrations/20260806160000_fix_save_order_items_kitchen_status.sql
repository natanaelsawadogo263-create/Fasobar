-- FasoBar: corriger save_order_items — conflit kitchen_status vs kitchen_prep_status
-- (CASE/WHEN could not convert type kitchen_prep_status to kitchen_status).
-- Fichier uniquement — à appliquer manuellement.

-- 1) Garantir l'enum attendu par l'app
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'kitchen_prep_status'
  ) THEN
    CREATE TYPE public.kitchen_prep_status AS ENUM (
      'TO_PREPARE',
      'IN_PREPARATION',
      'READY',
      'SERVED'
    );
  END IF;
END
$$;

-- 2) Aligner la colonne orders.kitchen_status sur kitchen_prep_status
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT t.typname
  INTO col_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE n.nspname = 'public'
    AND c.relname = 'orders'
    AND a.attname = 'kitchen_status'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF col_type IS NULL THEN
    ALTER TABLE public.orders
      ADD COLUMN kitchen_status public.kitchen_prep_status,
      ADD COLUMN IF NOT EXISTS kitchen_status_updated_at timestamptz;
  ELSIF col_type = 'kitchen_status' THEN
    ALTER TABLE public.orders
      ALTER COLUMN kitchen_status DROP DEFAULT;

    ALTER TABLE public.orders
      ALTER COLUMN kitchen_status
      TYPE public.kitchen_prep_status
      USING (
        CASE kitchen_status::text
          WHEN 'TO_PREPARE' THEN 'TO_PREPARE'::public.kitchen_prep_status
          WHEN 'IN_PREPARATION' THEN 'IN_PREPARATION'::public.kitchen_prep_status
          WHEN 'READY' THEN 'READY'::public.kitchen_prep_status
          WHEN 'SERVED' THEN 'SERVED'::public.kitchen_prep_status
          ELSE NULL
        END
      );
  ELSIF col_type <> 'kitchen_prep_status' THEN
    ALTER TABLE public.orders
      ALTER COLUMN kitchen_status DROP DEFAULT;

    ALTER TABLE public.orders
      ALTER COLUMN kitchen_status
      TYPE public.kitchen_prep_status
      USING kitchen_status::text::public.kitchen_prep_status;
  END IF;
END
$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS kitchen_status_updated_at timestamptz;

-- 3) save_order_items : casts homogènes kitchen_prep_status / bar_prep_status
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
  v_has_bar boolean := false;
  v_has_kitchen boolean := false;
  v_next_bar public.bar_prep_status;
  v_next_kitchen public.kitchen_prep_status;
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

  SELECT public.order_has_department_items(p_order_id, 'BAR'::public.department_code)
  INTO v_has_bar;

  SELECT public.order_has_department_items(p_order_id, 'KITCHEN'::public.department_code)
  INTO v_has_kitchen;

  IF NOT v_has_bar OR p_target_status = 'DRAFT'::public.order_status THEN
    v_next_bar := NULL;
  ELSIF v_order.bar_status IS NULL THEN
    v_next_bar := 'TO_PREPARE'::public.bar_prep_status;
  ELSE
    v_next_bar := v_order.bar_status;
  END IF;

  IF NOT v_has_kitchen OR p_target_status = 'DRAFT'::public.order_status THEN
    v_next_kitchen := NULL;
  ELSIF v_order.kitchen_status IS NULL THEN
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
      WHEN v_order.bar_status IS NULL AND v_next_bar IS NOT NULL THEN now()
      ELSE bar_status_updated_at
    END,
    kitchen_status = v_next_kitchen,
    kitchen_status_updated_at = CASE
      WHEN v_next_kitchen IS NULL THEN NULL
      WHEN v_order.kitchen_status IS NULL AND v_next_kitchen IS NOT NULL THEN now()
      ELSE kitchen_status_updated_at
    END,
    updated_by = v_user_id,
    updated_at = now()
  WHERE id = p_order_id;

  PERFORM public.write_order_audit_log(
    v_order.organization_id,
    v_order.establishment_id,
    p_order_id,
    'ORDER_UPDATED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'target_status', p_target_status,
      'item_count', jsonb_array_length(p_items)
    )
  );

  RETURN p_order_id;
END;
$$;

-- 4) update_order_kitchen_status aligné sur kitchen_prep_status
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

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_order_items(uuid, jsonb, public.order_status) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_order_kitchen_status(uuid, public.kitchen_prep_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_order_items(uuid, jsonb, public.order_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_kitchen_status(uuid, public.kitchen_prep_status) TO authenticated;
