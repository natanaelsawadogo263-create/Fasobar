-- FasoBar E-commerce : livreurs, stock par livreur et commandes de livraison.
--
-- Flux :
--   1. L'admin remet du stock à un livreur  → stock principal -q, stock livreur +q.
--   2. La caissière crée une commande       → statut PENDING, visible par tous les livreurs.
--   3. Un livreur l'accepte (le premier)    → statut ACCEPTED, attribuée à ce livreur.
--   4. Le livreur finalise la livraison     → statut DELIVERED, stock livreur -q.
--   5. L'admin peut reprendre des invendus  → stock livreur -q, stock principal +q.
--
-- Toutes les écritures passent par des fonctions SECURITY DEFINER (pas de
-- politique INSERT/UPDATE) : chaque mouvement est tracé et vérifié côté base.
-- Réservé aux établissements activity_code = 'ecommerce'.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE public.delivery_order_status AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DELIVERED',
  'CANCELLED'
);

CREATE TYPE public.courier_stock_movement_type AS ENUM (
  'ALLOCATION',
  'RETURN',
  'DELIVERY'
);

-- ---------------------------------------------------------------------------
-- delivery_orders — commandes à livrer
-- ---------------------------------------------------------------------------

CREATE TABLE public.delivery_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  order_number integer NOT NULL,
  status public.delivery_order_status NOT NULL DEFAULT 'PENDING',
  customer_name text,
  customer_phone text,
  delivery_address text,
  note text,
  total_amount integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  courier_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  accepted_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_orders_total_non_negative CHECK (total_amount >= 0),
  CONSTRAINT delivery_orders_courier_when_taken CHECK (
    status IN ('PENDING', 'CANCELLED') OR courier_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX delivery_orders_establishment_number_key
  ON public.delivery_orders (establishment_id, order_number);
CREATE INDEX delivery_orders_establishment_status_idx
  ON public.delivery_orders (establishment_id, status, created_at DESC);
CREATE INDEX delivery_orders_courier_idx
  ON public.delivery_orders (courier_id, status);

CREATE TRIGGER delivery_orders_set_updated_at
  BEFORE UPDATE ON public.delivery_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- delivery_order_items — lignes (prix figé à la commande)
-- ---------------------------------------------------------------------------

CREATE TABLE public.delivery_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id uuid NOT NULL REFERENCES public.delivery_orders (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  unit_price integer NOT NULL,
  quantity numeric(14, 3) NOT NULL,
  line_total integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT delivery_order_items_unit_price_non_negative CHECK (unit_price >= 0),
  CONSTRAINT delivery_order_items_line_total_non_negative CHECK (line_total >= 0),
  CONSTRAINT delivery_order_items_unique_product UNIQUE (delivery_order_id, product_id)
);

CREATE INDEX delivery_order_items_order_idx ON public.delivery_order_items (delivery_order_id);
CREATE INDEX delivery_order_items_establishment_idx ON public.delivery_order_items (establishment_id);

-- ---------------------------------------------------------------------------
-- courier_stock — ce que chaque livreur a en main
-- ---------------------------------------------------------------------------

CREATE TABLE public.courier_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity numeric(14, 3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courier_stock_quantity_non_negative CHECK (quantity >= 0),
  CONSTRAINT courier_stock_unique_line UNIQUE (establishment_id, courier_id, product_id)
);

CREATE INDEX courier_stock_courier_idx ON public.courier_stock (establishment_id, courier_id);

CREATE TRIGGER courier_stock_set_updated_at
  BEFORE UPDATE ON public.courier_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- courier_stock_movements — traçabilité (remises, retours, livraisons)
-- ---------------------------------------------------------------------------

CREATE TABLE public.courier_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  type public.courier_stock_movement_type NOT NULL,
  quantity numeric(14, 3) NOT NULL,
  quantity_before numeric(14, 3) NOT NULL,
  quantity_after numeric(14, 3) NOT NULL,
  delivery_order_id uuid REFERENCES public.delivery_orders (id) ON DELETE SET NULL,
  stock_movement_id uuid REFERENCES public.stock_movements (id) ON DELETE SET NULL,
  note text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courier_stock_movements_quantity_non_zero CHECK (quantity <> 0),
  CONSTRAINT courier_stock_movements_after_non_negative CHECK (quantity_after >= 0)
);

CREATE INDEX courier_stock_movements_courier_idx
  ON public.courier_stock_movements (establishment_id, courier_id, created_at DESC);
CREATE INDEX courier_stock_movements_order_idx
  ON public.courier_stock_movements (delivery_order_id);

-- ---------------------------------------------------------------------------
-- Helpers d'autorisation
-- ---------------------------------------------------------------------------

-- Gestionnaire livraisons : owner/admin org, ou admin/manager de l'établissement.
CREATE OR REPLACE FUNCTION public.delivery_user_is_manager(
  p_user_id uuid,
  p_establishment_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.user_is_organization_owner_or_admin(
      p_user_id,
      public.establishment_organization_id(p_establishment_id)
    )
    OR public.user_has_establishment_role(p_user_id, p_establishment_id, 'ADMIN'::public.membership_role)
    OR public.user_has_establishment_role(p_user_id, p_establishment_id, 'MANAGER'::public.membership_role);
$$;

-- Établissement e-commerce actif → organization_id (sinon exception).
CREATE OR REPLACE FUNCTION public.delivery_require_ecommerce(p_establishment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT e.organization_id INTO v_org
  FROM public.establishments e
  WHERE e.id = p_establishment_id
    AND e.status = 'ACTIVE'::public.entity_status
    AND e.activity_code = 'ecommerce';

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Les livraisons sont réservées aux établissements e-commerce.';
  END IF;

  RETURN v_org;
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_require_courier(
  p_courier_id uuid,
  p_establishment_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.user_has_establishment_role(
    p_courier_id,
    p_establishment_id,
    'DELIVERY_AGENT'::public.membership_role
  ) THEN
    RAISE EXCEPTION 'Livreur introuvable ou désactivé.';
  END IF;
END;
$$;

-- Lignes {product_id, quantity} regroupées par produit, quantités > 0.
CREATE OR REPLACE FUNCTION public.delivery_parse_items(p_items jsonb)
RETURNS TABLE (product_id uuid, quantity numeric)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Ajoutez au moins un article.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity numeric)
    WHERE x.product_id IS NULL OR x.quantity IS NULL OR x.quantity <= 0
  ) THEN
    RAISE EXCEPTION 'Quantité invalide : chaque article doit avoir une quantité positive.';
  END IF;

  RETURN QUERY
  SELECT x.product_id, round(sum(x.quantity), 3)
  FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity numeric)
  GROUP BY x.product_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- allocate_courier_stock — remise de stock à un livreur
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.allocate_courier_stock(
  p_establishment_id uuid,
  p_courier_id uuid,
  p_items jsonb,
  p_note text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid;
  v_courier_name text;
  v_line record;
  v_product public.products%ROWTYPE;
  v_stock public.stock_items%ROWTYPE;
  v_stock_movement_id uuid;
  v_after numeric(14, 3);
  v_count integer := 0;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  v_org := public.delivery_require_ecommerce(p_establishment_id);

  IF NOT public.delivery_user_is_manager(v_actor, p_establishment_id) THEN
    RAISE EXCEPTION 'Seul l''administrateur peut remettre du stock aux livreurs.';
  END IF;

  PERFORM public.delivery_require_courier(p_courier_id, p_establishment_id);

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'livreur') INTO v_courier_name
  FROM public.profiles p
  WHERE p.id = p_courier_id;

  FOR v_line IN SELECT * FROM public.delivery_parse_items(p_items) LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_line.product_id
      AND establishment_id = p_establishment_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article introuvable dans cet établissement.';
    END IF;

    SELECT si.* INTO v_stock
    FROM public.stock_items si
    WHERE si.product_id = v_line.product_id
      AND si.establishment_id = p_establishment_id
    ORDER BY si.id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Aucun stock enregistré pour « % ».', v_product.name;
    END IF;

    IF v_stock.current_quantity < v_line.quantity THEN
      RAISE EXCEPTION 'Stock insuffisant pour « % » : % disponible(s).',
        v_product.name, v_stock.current_quantity;
    END IF;

    UPDATE public.stock_items
    SET current_quantity = v_stock.current_quantity - v_line.quantity,
        updated_at = now()
    WHERE id = v_stock.id;

    INSERT INTO public.stock_movements (
      organization_id, establishment_id, stock_item_id, type,
      quantity, quantity_before, quantity_after, reference, reason, created_by
    )
    VALUES (
      v_org, p_establishment_id, v_stock.id, 'TRANSFER_OUT'::public.stock_movement_type,
      -v_line.quantity, v_stock.current_quantity, v_stock.current_quantity - v_line.quantity,
      'livreur:' || p_courier_id::text,
      'Remise au livreur ' || v_courier_name,
      v_actor
    )
    RETURNING id INTO v_stock_movement_id;

    INSERT INTO public.courier_stock AS cs (
      organization_id, establishment_id, courier_id, product_id, quantity
    )
    VALUES (v_org, p_establishment_id, p_courier_id, v_line.product_id, v_line.quantity)
    ON CONFLICT (establishment_id, courier_id, product_id)
    DO UPDATE SET quantity = cs.quantity + EXCLUDED.quantity
    RETURNING cs.quantity INTO v_after;

    INSERT INTO public.courier_stock_movements (
      organization_id, establishment_id, courier_id, product_id, product_name, type,
      quantity, quantity_before, quantity_after, stock_movement_id, note, created_by
    )
    VALUES (
      v_org, p_establishment_id, p_courier_id, v_line.product_id, v_product.name,
      'ALLOCATION'::public.courier_stock_movement_type,
      v_line.quantity, v_after - v_line.quantity, v_after, v_stock_movement_id,
      NULLIF(btrim(COALESCE(p_note, '')), ''), v_actor
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- return_courier_stock — retour d'invendus au stock principal
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.return_courier_stock(
  p_establishment_id uuid,
  p_courier_id uuid,
  p_items jsonb,
  p_note text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid;
  v_courier_name text;
  v_line record;
  v_product public.products%ROWTYPE;
  v_courier public.courier_stock%ROWTYPE;
  v_stock public.stock_items%ROWTYPE;
  v_reserved numeric(14, 3);
  v_stock_movement_id uuid;
  v_count integer := 0;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  v_org := public.delivery_require_ecommerce(p_establishment_id);

  IF NOT public.delivery_user_is_manager(v_actor, p_establishment_id) THEN
    RAISE EXCEPTION 'Seul l''administrateur peut enregistrer un retour de stock.';
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'livreur') INTO v_courier_name
  FROM public.profiles p
  WHERE p.id = p_courier_id;

  FOR v_line IN SELECT * FROM public.delivery_parse_items(p_items) LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_line.product_id
      AND establishment_id = p_establishment_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article introuvable dans cet établissement.';
    END IF;

    SELECT * INTO v_courier
    FROM public.courier_stock
    WHERE establishment_id = p_establishment_id
      AND courier_id = p_courier_id
      AND product_id = v_line.product_id
    FOR UPDATE;

    IF NOT FOUND OR v_courier.quantity < v_line.quantity THEN
      RAISE EXCEPTION 'Le livreur n''a pas assez de « % » : % en main.',
        v_product.name, COALESCE(v_courier.quantity, 0);
    END IF;

    -- Ne pas reprendre ce qui est déjà réservé par ses livraisons acceptées.
    SELECT COALESCE(sum(i.quantity), 0) INTO v_reserved
    FROM public.delivery_order_items i
    JOIN public.delivery_orders o ON o.id = i.delivery_order_id
    WHERE o.establishment_id = p_establishment_id
      AND o.courier_id = p_courier_id
      AND o.status = 'ACCEPTED'::public.delivery_order_status
      AND i.product_id = v_line.product_id;

    IF v_courier.quantity - v_reserved < v_line.quantity THEN
      RAISE EXCEPTION 'Impossible : % « % » sont réservés pour des livraisons en cours.',
        v_reserved, v_product.name;
    END IF;

    SELECT si.* INTO v_stock
    FROM public.stock_items si
    WHERE si.product_id = v_line.product_id
      AND si.establishment_id = p_establishment_id
    ORDER BY si.id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Aucun stock enregistré pour « % ».', v_product.name;
    END IF;

    UPDATE public.courier_stock
    SET quantity = v_courier.quantity - v_line.quantity
    WHERE id = v_courier.id;

    UPDATE public.stock_items
    SET current_quantity = v_stock.current_quantity + v_line.quantity,
        updated_at = now()
    WHERE id = v_stock.id;

    INSERT INTO public.stock_movements (
      organization_id, establishment_id, stock_item_id, type,
      quantity, quantity_before, quantity_after, reference, reason, created_by
    )
    VALUES (
      v_org, p_establishment_id, v_stock.id, 'TRANSFER_IN'::public.stock_movement_type,
      v_line.quantity, v_stock.current_quantity, v_stock.current_quantity + v_line.quantity,
      'livreur:' || p_courier_id::text,
      'Retour du livreur ' || v_courier_name,
      v_actor
    )
    RETURNING id INTO v_stock_movement_id;

    INSERT INTO public.courier_stock_movements (
      organization_id, establishment_id, courier_id, product_id, product_name, type,
      quantity, quantity_before, quantity_after, stock_movement_id, note, created_by
    )
    VALUES (
      v_org, p_establishment_id, p_courier_id, v_line.product_id, v_product.name,
      'RETURN'::public.courier_stock_movement_type,
      -v_line.quantity, v_courier.quantity, v_courier.quantity - v_line.quantity,
      v_stock_movement_id, NULLIF(btrim(COALESCE(p_note, '')), ''), v_actor
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- create_delivery_order — saisie par la caissière (ou l'admin)
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

  FOR v_line IN SELECT * FROM public.delivery_parse_items(p_items) LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_line.product_id
      AND establishment_id = p_establishment_id
      AND active;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article introuvable ou désactivé.';
    END IF;

    v_line_total := round(v_product.selling_price * v_line.quantity)::integer;
    v_total := v_total + v_line_total;

    INSERT INTO public.delivery_order_items (
      delivery_order_id, organization_id, establishment_id, product_id,
      product_name, unit_price, quantity, line_total
    )
    VALUES (
      v_order_id, v_org, p_establishment_id, v_product.id,
      v_product.name, v_product.selling_price, v_line.quantity, v_line_total
    );
  END LOOP;

  UPDATE public.delivery_orders
  SET total_amount = v_total
  WHERE id = v_order_id;

  RETURN jsonb_build_object('id', v_order_id, 'order_number', v_number);
END;
$$;

-- ---------------------------------------------------------------------------
-- accept_delivery_order — le premier livreur qui accepte prend la commande
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
    SELECT i.product_id, i.product_name, i.quantity
    FROM public.delivery_order_items i
    WHERE i.delivery_order_id = p_order_id
  LOOP
    SELECT COALESCE(cs.quantity, 0) INTO v_in_hand
    FROM public.courier_stock cs
    WHERE cs.establishment_id = v_order.establishment_id
      AND cs.courier_id = v_actor
      AND cs.product_id = v_line.product_id;

    v_in_hand := COALESCE(v_in_hand, 0);

    SELECT COALESCE(sum(i.quantity), 0) INTO v_reserved
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
-- release_delivery_order — le livreur se désiste (retour en attente)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.release_delivery_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.delivery_orders%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT * INTO v_order
  FROM public.delivery_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_order.status <> 'ACCEPTED'::public.delivery_order_status
    OR v_order.courier_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Cette livraison ne vous est pas attribuée.';
  END IF;

  UPDATE public.delivery_orders
  SET status = 'PENDING'::public.delivery_order_status,
      courier_id = NULL,
      accepted_at = NULL
  WHERE id = p_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- complete_delivery_order — livraison finalisée : stock du livreur diminué
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
    SELECT i.product_id, i.product_name, i.quantity
    FROM public.delivery_order_items i
    WHERE i.delivery_order_id = p_order_id
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
-- cancel_delivery_order — annulation (avant livraison, aucun effet stock)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_delivery_order(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.delivery_orders%ROWTYPE;
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

  IF NOT (
    public.delivery_user_is_manager(v_actor, v_order.establishment_id)
    OR public.user_has_establishment_role(v_actor, v_order.establishment_id, 'CASHIER_KITCHEN'::public.membership_role)
    OR public.user_has_establishment_role(v_actor, v_order.establishment_id, 'CASHIER'::public.membership_role)
  ) THEN
    RAISE EXCEPTION 'Permission insuffisante pour annuler cette commande.';
  END IF;

  IF v_order.status NOT IN (
    'PENDING'::public.delivery_order_status,
    'ACCEPTED'::public.delivery_order_status
  ) THEN
    RAISE EXCEPTION 'Une commande livrée ou déjà annulée ne peut plus être annulée.';
  END IF;

  UPDATE public.delivery_orders
  SET status = 'CANCELLED'::public.delivery_order_status,
      cancelled_at = now(),
      cancelled_by = v_actor,
      cancel_reason = NULLIF(btrim(COALESCE(p_reason, '')), '')
  WHERE id = p_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- provision_employee_account — autorise DELIVERY_AGENT (e-commerce seulement)
-- Copie de 20260808160000 ; seule la validation du rôle change.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.provision_employee_account(
  p_user_id uuid,
  p_organization_id uuid,
  p_establishment_id uuid,
  p_role public.membership_role,
  p_full_name text,
  p_phone text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_login_identifier text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_login text;
  v_login_norm text;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF NOT public.user_is_organization_owner_or_admin(v_actor_id, p_organization_id) THEN
    RAISE EXCEPTION 'Permission insuffisante.';
  END IF;

  IF p_role = 'OWNER'::public.membership_role THEN
    RAISE EXCEPTION 'Impossible de créer un propriétaire via ce formulaire.';
  END IF;

  IF p_role NOT IN (
    'ADMIN'::public.membership_role,
    'CASHIER_KITCHEN'::public.membership_role,
    'BAR_MANAGER'::public.membership_role,
    'DELIVERY_AGENT'::public.membership_role
  ) THEN
    RAISE EXCEPTION 'Rôle non autorisé pour un compte employé.';
  END IF;

  IF p_role = 'DELIVERY_AGENT'::public.membership_role AND NOT EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = p_establishment_id
      AND e.organization_id = p_organization_id
      AND e.activity_code = 'ecommerce'
  ) THEN
    RAISE EXCEPTION 'Les comptes livreurs sont réservés aux établissements e-commerce.';
  END IF;

  IF p_full_name IS NULL OR btrim(p_full_name) = '' THEN
    RAISE EXCEPTION 'Le nom complet est obligatoire.';
  END IF;

  v_login_norm := public.normalize_login_identifier(p_login_identifier);
  IF v_login_norm IS NULL THEN
    RAISE EXCEPTION 'Identifiant FasoBar obligatoire.';
  END IF;

  IF length(v_login_norm) < 3 OR length(v_login_norm) > 64 THEN
    RAISE EXCEPTION 'Identifiant FasoBar invalide (3–64 caractères).';
  END IF;

  -- Refuse les entrées accentuées / hors charset qui divergeraient de la
  -- normalisation applicative (NFD → ASCII). Exige déjà la forme canonique.
  IF regexp_replace(lower(btrim(COALESCE(p_login_identifier, ''))), '\s+', '', 'g')
     IS DISTINCT FROM v_login_norm THEN
    RAISE EXCEPTION
      'Identifiant FasoBar invalide : utilisez uniquement a-z, 0-9, point, tiret et underscore.';
  END IF;

  IF v_login_norm !~ '^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$' THEN
    RAISE EXCEPTION 'Identifiant FasoBar invalide.';
  END IF;

  v_login := v_login_norm;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.login_identifier_normalized = v_login_norm
      AND p.id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'Cet identifiant FasoBar est déjà utilisé.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = p_establishment_id
      AND e.organization_id = p_organization_id
      AND e.status = 'ACTIVE'::public.entity_status
  ) THEN
    RAISE EXCEPTION 'Établissement introuvable ou non autorisé.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Cet utilisateur appartient déjà à votre organisation.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = p_user_id
      AND om.organization_id <> p_organization_id
  ) THEN
    RAISE EXCEPTION 'Cet utilisateur appartient déjà à une autre organisation.';
  END IF;

  PERFORM set_config('fasobar.profile_credential_update', 'on', true);

  UPDATE public.profiles
  SET
    full_name = btrim(p_full_name),
    phone = NULLIF(btrim(COALESCE(p_phone, '')), ''),
    status = 'ACTIVE'::public.entity_status,
    must_change_password = true,
    credentials_created_at = now(),
    credentials_created_by = v_actor_id,
    password_changed_at = NULL,
    login_identifier = v_login,
    login_identifier_normalized = v_login_norm,
    credential_version = 1,
    permissions_version = 1,
    updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil utilisateur introuvable.';
  END IF;

  INSERT INTO public.organization_memberships (
    organization_id, user_id, role, status
  )
  VALUES (
    p_organization_id, p_user_id, p_role, 'ACTIVE'::public.entity_status
  );

  INSERT INTO public.establishment_memberships (
    establishment_id, user_id, role, status
  )
  VALUES (
    p_establishment_id, p_user_id, p_role, 'ACTIVE'::public.entity_status
  );

  PERFORM public.write_membership_audit_log(
    p_organization_id,
    p_establishment_id,
    p_user_id,
    'EMPLOYEE_ACCOUNT_CREATED'::public.audit_action,
    v_actor_id,
    jsonb_build_object(
      'role', p_role,
      'full_name', btrim(p_full_name),
      'login_identifier', v_login
    )
  );

  PERFORM public.write_membership_audit_log(
    p_organization_id,
    p_establishment_id,
    p_user_id,
    'EMPLOYEE_MEMBERSHIPS_CREATED'::public.audit_action,
    v_actor_id,
    jsonb_build_object('role', p_role)
  );

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'role', p_role,
    'organization_id', p_organization_id,
    'establishment_id', p_establishment_id,
    'login_identifier', v_login
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS : lecture seulement (écritures via fonctions ci-dessus)
-- ---------------------------------------------------------------------------

ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY delivery_orders_select ON public.delivery_orders
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));

CREATE POLICY delivery_order_items_select ON public.delivery_order_items
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));

-- Stock livreur : le livreur voit le sien, l'admin voit tout.
CREATE POLICY courier_stock_select ON public.courier_stock
  FOR SELECT TO authenticated
  USING (
    public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id)
    AND (
      courier_id = (SELECT auth.uid())
      OR public.delivery_user_is_manager((SELECT auth.uid()), establishment_id)
    )
  );

CREATE POLICY courier_stock_movements_select ON public.courier_stock_movements
  FOR SELECT TO authenticated
  USING (
    public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id)
    AND (
      courier_id = (SELECT auth.uid())
      OR public.delivery_user_is_manager((SELECT auth.uid()), establishment_id)
    )
  );

REVOKE ALL ON TABLE public.delivery_orders FROM anon;
REVOKE ALL ON TABLE public.delivery_order_items FROM anon;
REVOKE ALL ON TABLE public.courier_stock FROM anon;
REVOKE ALL ON TABLE public.courier_stock_movements FROM anon;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.delivery_orders FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.delivery_order_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.courier_stock FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.courier_stock_movements FROM authenticated;

GRANT SELECT ON TABLE public.delivery_orders TO authenticated;
GRANT SELECT ON TABLE public.delivery_order_items TO authenticated;
GRANT SELECT ON TABLE public.courier_stock TO authenticated;
GRANT SELECT ON TABLE public.courier_stock_movements TO authenticated;

-- ---------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------

-- Helper de politique RLS : doit rester exécutable par authenticated.
REVOKE ALL ON FUNCTION public.delivery_user_is_manager(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_user_is_manager(uuid, uuid) TO authenticated;

-- Helpers internes : appelés uniquement depuis les fonctions SECURITY DEFINER.
REVOKE ALL ON FUNCTION public.delivery_require_ecommerce(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delivery_require_courier(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delivery_parse_items(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_require_ecommerce(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delivery_require_courier(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delivery_parse_items(jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.allocate_courier_stock(uuid, uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.return_courier_stock(uuid, uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_delivery_order(uuid, jsonb, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_delivery_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_delivery_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_delivery_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_delivery_order(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.allocate_courier_stock(uuid, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_courier_stock(uuid, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_delivery_order(uuid, jsonb, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_delivery_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_delivery_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_delivery_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_delivery_order(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.provision_employee_account(
  uuid, uuid, uuid, public.membership_role, text, text, uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provision_employee_account(
  uuid, uuid, uuid, public.membership_role, text, text, uuid, text
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Realtime : les livreurs connectés voient les nouvelles commandes en direct
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'delivery_orders'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_orders;
  END IF;
END
$$;
