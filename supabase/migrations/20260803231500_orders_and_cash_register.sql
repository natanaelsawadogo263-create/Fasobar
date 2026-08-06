-- FasoBar: orders, order items and cash register RPCs

CREATE TYPE public.order_type AS ENUM ('ON_SITE', 'TAKEAWAY');

CREATE TYPE public.order_status AS ENUM (
  'DRAFT',
  'OPEN',
  'READY_TO_PAY',
  'CANCELLED'
);

CREATE TYPE public.order_payment_status AS ENUM (
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID'
);

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'ORDER_CREATED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'ORDER_UPDATED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'ORDER_CANCELLED';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.establishment_order_sequences (
  establishment_id uuid PRIMARY KEY REFERENCES public.establishments (id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0,
  CONSTRAINT establishment_order_sequences_last_number_non_negative CHECK (last_number >= 0)
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  order_number integer NOT NULL,
  table_reference text,
  customer_reference text,
  order_type public.order_type NOT NULL DEFAULT 'ON_SITE'::public.order_type,
  status public.order_status NOT NULL DEFAULT 'DRAFT'::public.order_status,
  payment_status public.order_payment_status NOT NULL DEFAULT 'UNPAID'::public.order_payment_status,
  subtotal integer NOT NULL DEFAULT 0,
  discount_amount integer NOT NULL DEFAULT 0,
  total_amount integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  CONSTRAINT orders_order_number_positive CHECK (order_number > 0),
  CONSTRAINT orders_subtotal_non_negative CHECK (subtotal >= 0),
  CONSTRAINT orders_discount_amount_non_negative CHECK (discount_amount >= 0),
  CONSTRAINT orders_total_amount_non_negative CHECK (total_amount >= 0),
  CONSTRAINT orders_unique_number_per_establishment UNIQUE (establishment_id, order_number)
);

CREATE INDEX orders_organization_id_idx ON public.orders (organization_id);
CREATE INDEX orders_establishment_id_idx ON public.orders (establishment_id);
CREATE INDEX orders_status_idx ON public.orders (status);
CREATE INDEX orders_payment_status_idx ON public.orders (payment_status);
CREATE INDEX orders_created_at_idx ON public.orders (created_at);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE RESTRICT,
  product_name_snapshot text NOT NULL,
  unit_price_snapshot integer NOT NULL,
  quantity numeric(10, 3) NOT NULL,
  line_total integer NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_items_product_name_not_blank CHECK (btrim(product_name_snapshot) <> ''),
  CONSTRAINT order_items_unit_price_non_negative CHECK (unit_price_snapshot >= 0),
  CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT order_items_line_total_non_negative CHECK (line_total >= 0),
  CONSTRAINT order_items_unique_product_per_order UNIQUE (order_id, product_id)
);

CREATE INDEX order_items_organization_id_idx ON public.order_items (organization_id);
CREATE INDEX order_items_establishment_id_idx ON public.order_items (establishment_id);
CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX order_items_product_id_idx ON public.order_items (product_id);
CREATE INDEX order_items_department_id_idx ON public.order_items (department_id);

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER order_items_set_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers
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
    OR public.user_has_establishment_role(
      p_user_id,
      p_establishment_id,
      'CASHIER'::public.membership_role
    )
    OR public.user_has_organization_role(
      p_user_id,
      public.establishment_organization_id(p_establishment_id),
      'CASHIER'::public.membership_role
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_department_manager_role(
  p_user_id uuid,
  p_establishment_id uuid,
  p_department_code public.department_code
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_department_code = 'BAR'::public.department_code
    AND (
      public.user_has_establishment_role(p_user_id, p_establishment_id, 'BAR_MANAGER'::public.membership_role)
      OR public.user_has_organization_role(
        p_user_id,
        public.establishment_organization_id(p_establishment_id),
        'BAR_MANAGER'::public.membership_role
      )
    )
    OR (
      p_department_code = 'KITCHEN'::public.department_code
      AND (
        public.user_has_establishment_role(p_user_id, p_establishment_id, 'KITCHEN_MANAGER'::public.membership_role)
        OR public.user_has_organization_role(
          p_user_id,
          public.establishment_organization_id(p_establishment_id),
          'KITCHEN_MANAGER'::public.membership_role
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_read_order(
  p_user_id uuid,
  p_order_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND (
        public.user_can_manage_orders(p_user_id, o.establishment_id)
        OR EXISTS (
          SELECT 1
          FROM public.order_items oi
          INNER JOIN public.departments d ON d.id = oi.department_id
          WHERE oi.order_id = o.id
            AND public.user_has_department_manager_role(p_user_id, o.establishment_id, d.code)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_read_order_item(
  p_user_id uuid,
  p_order_item_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    INNER JOIN public.orders o ON o.id = oi.order_id
    INNER JOIN public.departments d ON d.id = oi.department_id
    WHERE oi.id = p_order_item_id
      AND (
        public.user_can_manage_orders(p_user_id, o.establishment_id)
        OR public.user_has_department_manager_role(p_user_id, o.establishment_id, d.code)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.write_order_audit_log(
  p_organization_id uuid,
  p_establishment_id uuid,
  p_entity_id uuid,
  p_action public.audit_action,
  p_actor_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    organization_id,
    establishment_id,
    entity_type,
    entity_id,
    action,
    actor_id,
    metadata
  )
  VALUES (
    p_organization_id,
    p_establishment_id,
    'order',
    p_entity_id,
    p_action,
    p_actor_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.next_order_number(p_establishment_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_number integer;
BEGIN
  INSERT INTO public.establishment_order_sequences (establishment_id, last_number)
  VALUES (p_establishment_id, 1)
  ON CONFLICT (establishment_id) DO UPDATE
  SET last_number = public.establishment_order_sequences.last_number + 1
  RETURNING last_number INTO v_number;

  RETURN v_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_order_totals(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subtotal integer;
  v_discount integer;
  v_total integer;
BEGIN
  SELECT COALESCE(SUM(oi.line_total), 0)
  INTO v_subtotal
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  SELECT discount_amount
  INTO v_discount
  FROM public.orders
  WHERE id = p_order_id;

  v_discount := COALESCE(v_discount, 0);
  v_total := GREATEST(v_subtotal - v_discount, 0);

  UPDATE public.orders
  SET
    subtotal = v_subtotal,
    total_amount = v_total,
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: create order
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_order(
  p_table_reference text DEFAULT NULL,
  p_customer_reference text DEFAULT NULL,
  p_order_type public.order_type DEFAULT 'ON_SITE'::public.order_type,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_establishment_id uuid;
  v_organization_id uuid;
  v_order_id uuid;
  v_order_number integer;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT em.establishment_id, e.organization_id
  INTO v_establishment_id, v_organization_id
  FROM public.establishment_memberships em
  INNER JOIN public.establishments e ON e.id = em.establishment_id
  WHERE em.user_id = v_user_id
    AND em.status = 'ACTIVE'::public.entity_status
  LIMIT 1;

  IF v_establishment_id IS NULL THEN
    SELECT e.id, e.organization_id
    INTO v_establishment_id, v_organization_id
    FROM public.organization_memberships om
    INNER JOIN public.establishments e ON e.organization_id = om.organization_id
    WHERE om.user_id = v_user_id
      AND om.status = 'ACTIVE'::public.entity_status
    LIMIT 1;
  END IF;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Établissement actif introuvable.';
  END IF;

  IF NOT public.user_can_manage_orders(v_user_id, v_establishment_id) THEN
    RAISE EXCEPTION 'Permission insuffisante pour créer une commande.';
  END IF;

  v_order_number := public.next_order_number(v_establishment_id);

  INSERT INTO public.orders (
    organization_id,
    establishment_id,
    order_number,
    table_reference,
    customer_reference,
    order_type,
    status,
    payment_status,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    v_organization_id,
    v_establishment_id,
    v_order_number,
    NULLIF(btrim(p_table_reference), ''),
    NULLIF(btrim(p_customer_reference), ''),
    p_order_type,
    'DRAFT'::public.order_status,
    'UNPAID'::public.order_payment_status,
    NULLIF(btrim(p_notes), ''),
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_order_id;

  PERFORM public.write_order_audit_log(
    v_organization_id,
    v_establishment_id,
    v_order_id,
    'ORDER_CREATED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'order_number', v_order_number,
      'order_type', p_order_type,
      'table_reference', NULLIF(btrim(p_table_reference), ''),
      'customer_reference', NULLIF(btrim(p_customer_reference), '')
    )
  );

  RETURN v_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: save order items (atomic, server-side pricing)
-- ---------------------------------------------------------------------------

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
      NULLIF(btrim(v_item ->> 'notes'), '')
    );
  END LOOP;

  PERFORM public.recalculate_order_totals(p_order_id);

  UPDATE public.orders
  SET
    status = p_target_status,
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

-- ---------------------------------------------------------------------------
-- RPC: update order header
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_order_header(
  p_order_id uuid,
  p_table_reference text DEFAULT NULL,
  p_customer_reference text DEFAULT NULL,
  p_order_type public.order_type DEFAULT NULL,
  p_notes text DEFAULT NULL
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

  IF NOT public.user_can_manage_orders(v_user_id, v_order.establishment_id) THEN
    RAISE EXCEPTION 'Permission insuffisante pour modifier cette commande.';
  END IF;

  IF v_order.payment_status = 'PAID'::public.order_payment_status THEN
    RAISE EXCEPTION 'Une commande payée ne peut plus être modifiée.';
  END IF;

  IF v_order.status = 'CANCELLED'::public.order_status THEN
    RAISE EXCEPTION 'Une commande annulée ne peut plus être modifiée.';
  END IF;

  UPDATE public.orders
  SET
    table_reference = COALESCE(NULLIF(btrim(p_table_reference), ''), table_reference),
    customer_reference = COALESCE(NULLIF(btrim(p_customer_reference), ''), customer_reference),
    order_type = COALESCE(p_order_type, order_type),
    notes = COALESCE(NULLIF(btrim(p_notes), ''), notes),
    updated_by = v_user_id,
    updated_at = now()
  WHERE id = p_order_id;

  PERFORM public.write_order_audit_log(
    v_order.organization_id,
    v_order.establishment_id,
    p_order_id,
    'ORDER_UPDATED'::public.audit_action,
    v_user_id,
    jsonb_build_object('scope', 'header')
  );

  RETURN p_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: cancel order
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id uuid,
  p_reason text
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

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Le motif d''annulation est obligatoire.';
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
    RAISE EXCEPTION 'Permission insuffisante pour annuler cette commande.';
  END IF;

  IF v_order.payment_status = 'PAID'::public.order_payment_status THEN
    RAISE EXCEPTION 'Une commande payée ne peut pas être annulée.';
  END IF;

  IF v_order.status = 'CANCELLED'::public.order_status THEN
    RAISE EXCEPTION 'Cette commande est déjà annulée.';
  END IF;

  UPDATE public.orders
  SET
    status = 'CANCELLED'::public.order_status,
    cancelled_at = now(),
    cancellation_reason = btrim(p_reason),
    updated_by = v_user_id,
    updated_at = now()
  WHERE id = p_order_id;

  PERFORM public.write_order_audit_log(
    v_order.organization_id,
    v_order.establishment_id,
    p_order_id,
    'ORDER_CANCELLED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'reason', btrim(p_reason),
      'order_number', v_order.order_number
    )
  );

  RETURN p_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.establishment_order_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.establishment_order_sequences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_items FORCE ROW LEVEL SECURITY;

CREATE POLICY establishment_order_sequences_no_access
  ON public.establishment_order_sequences
  FOR ALL
  TO authenticated
  USING (false);

CREATE POLICY orders_select_authorized
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.user_can_read_order((SELECT auth.uid()), id));

CREATE POLICY orders_immutable_insert
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY orders_immutable_update
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY orders_immutable_delete
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY order_items_select_authorized
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (public.user_can_read_order_item((SELECT auth.uid()), id));

CREATE POLICY order_items_immutable_insert
  ON public.order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY order_items_immutable_update
  ON public.order_items
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY order_items_immutable_delete
  ON public.order_items
  FOR DELETE
  TO authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.establishment_order_sequences FROM anon;
REVOKE ALL ON TABLE public.orders FROM anon;
REVOKE ALL ON TABLE public.order_items FROM anon;

REVOKE ALL ON TYPE public.order_type FROM anon;
REVOKE ALL ON TYPE public.order_status FROM anon;
REVOKE ALL ON TYPE public.order_payment_status FROM anon;

GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.order_items TO authenticated;

GRANT USAGE ON TYPE public.order_type TO authenticated;
GRANT USAGE ON TYPE public.order_status TO authenticated;
GRANT USAGE ON TYPE public.order_payment_status TO authenticated;

REVOKE ALL ON FUNCTION public.user_can_manage_orders(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_department_manager_role(uuid, uuid, public.department_code) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_read_order(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_read_order_item(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.write_order_audit_log(uuid, uuid, uuid, public.audit_action, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_order_number(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalculate_order_totals(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_order(text, text, public.order_type, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_order_items(uuid, jsonb, public.order_status) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_order_header(uuid, text, text, public.order_type, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_order(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.user_can_manage_orders(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_department_manager_role(uuid, uuid, public.department_code) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_read_order(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_read_order_item(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(text, text, public.order_type, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_order_items(uuid, jsonb, public.order_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_header(uuid, text, text, public.order_type, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid, text) TO authenticated;
