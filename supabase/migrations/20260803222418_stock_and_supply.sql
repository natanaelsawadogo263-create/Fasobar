-- FasoBar: stock, suppliers, movements and inventory

CREATE TYPE public.stock_movement_type AS ENUM (
  'PURCHASE',
  'MANUAL_ENTRY',
  'SALE',
  'LOSS',
  'BREAKAGE',
  'STAFF_CONSUMPTION',
  'GIFT',
  'INVENTORY_ADJUSTMENT',
  'TRANSFER_IN',
  'TRANSFER_OUT'
);

CREATE TYPE public.inventory_session_status AS ENUM (
  'DRAFT',
  'COMPLETED',
  'CANCELLED'
);

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'STOCK_ENTRY_RECORDED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'STOCK_LOSS_RECORDED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'STOCK_ADJUSTMENT_RECORDED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'INVENTORY_COMPLETED';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_name_not_blank CHECK (btrim(name) <> '')
);

CREATE INDEX suppliers_organization_id_idx ON public.suppliers (organization_id);
CREATE INDEX suppliers_establishment_id_idx ON public.suppliers (establishment_id);
CREATE INDEX suppliers_active_idx ON public.suppliers (active);

CREATE TABLE public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  name text NOT NULL,
  unit public.product_unit NOT NULL,
  current_quantity numeric(14, 3) NOT NULL DEFAULT 0,
  minimum_quantity numeric(14, 3) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_items_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT stock_items_current_quantity_non_negative CHECK (current_quantity >= 0),
  CONSTRAINT stock_items_minimum_quantity_non_negative CHECK (minimum_quantity >= 0)
);

CREATE INDEX stock_items_organization_id_idx ON public.stock_items (organization_id);
CREATE INDEX stock_items_establishment_id_idx ON public.stock_items (establishment_id);
CREATE INDEX stock_items_department_id_idx ON public.stock_items (department_id);
CREATE INDEX stock_items_product_id_idx ON public.stock_items (product_id);
CREATE INDEX stock_items_active_idx ON public.stock_items (active);

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items (id) ON DELETE RESTRICT,
  type public.stock_movement_type NOT NULL,
  quantity numeric(14, 3) NOT NULL,
  quantity_before numeric(14, 3) NOT NULL,
  quantity_after numeric(14, 3) NOT NULL,
  unit_cost integer,
  total_cost integer,
  supplier_id uuid REFERENCES public.suppliers (id) ON DELETE SET NULL,
  reference text,
  reason text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_quantity_non_zero CHECK (quantity <> 0),
  CONSTRAINT stock_movements_quantity_before_non_negative CHECK (quantity_before >= 0),
  CONSTRAINT stock_movements_quantity_after_non_negative CHECK (quantity_after >= 0),
  CONSTRAINT stock_movements_unit_cost_non_negative CHECK (unit_cost IS NULL OR unit_cost >= 0),
  CONSTRAINT stock_movements_total_cost_non_negative CHECK (total_cost IS NULL OR total_cost >= 0)
);

CREATE INDEX stock_movements_organization_id_idx ON public.stock_movements (organization_id);
CREATE INDEX stock_movements_establishment_id_idx ON public.stock_movements (establishment_id);
CREATE INDEX stock_movements_stock_item_id_idx ON public.stock_movements (stock_item_id);
CREATE INDEX stock_movements_type_idx ON public.stock_movements (type);
CREATE INDEX stock_movements_created_at_idx ON public.stock_movements (created_at);

CREATE TABLE public.inventory_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE RESTRICT,
  status public.inventory_session_status NOT NULL DEFAULT 'DRAFT',
  started_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  completed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX inventory_sessions_organization_id_idx ON public.inventory_sessions (organization_id);
CREATE INDEX inventory_sessions_establishment_id_idx ON public.inventory_sessions (establishment_id);
CREATE INDEX inventory_sessions_department_id_idx ON public.inventory_sessions (department_id);
CREATE INDEX inventory_sessions_status_idx ON public.inventory_sessions (status);

CREATE TABLE public.inventory_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_session_id uuid NOT NULL REFERENCES public.inventory_sessions (id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items (id) ON DELETE RESTRICT,
  theoretical_quantity numeric(14, 3) NOT NULL,
  counted_quantity numeric(14, 3) NOT NULL,
  difference numeric(14, 3) NOT NULL,
  comment text,
  CONSTRAINT inventory_lines_unique_item UNIQUE (inventory_session_id, stock_item_id)
);

CREATE INDEX inventory_lines_session_id_idx ON public.inventory_lines (inventory_session_id);
CREATE INDEX inventory_lines_stock_item_id_idx ON public.inventory_lines (stock_item_id);

CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER stock_items_set_updated_at
  BEFORE UPDATE ON public.stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_manage_stock(
  p_user_id uuid,
  p_establishment_id uuid,
  p_department_code public.department_code DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.user_can_manage_products(p_user_id, p_establishment_id)
    OR (
      p_department_code IS NOT NULL
      AND p_department_code = 'BAR'::public.department_code
      AND (
        public.user_has_establishment_role(p_user_id, p_establishment_id, 'BAR_MANAGER'::public.membership_role)
        OR public.user_has_organization_role(
          p_user_id,
          public.establishment_organization_id(p_establishment_id),
          'BAR_MANAGER'::public.membership_role
        )
      )
    )
    OR (
      p_department_code IS NOT NULL
      AND p_department_code = 'KITCHEN'::public.department_code
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

CREATE OR REPLACE FUNCTION public.user_can_read_stock_item(
  p_user_id uuid,
  p_stock_item_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stock_items si
    INNER JOIN public.departments d ON d.id = si.department_id
    WHERE si.id = p_stock_item_id
      AND si.active = true
      AND (
        public.user_can_manage_stock(p_user_id, si.establishment_id, d.code)
        OR (
          public.user_belongs_to_establishment(p_user_id, si.establishment_id)
          AND EXISTS (
            SELECT 1
            FROM public.establishment_memberships em
            WHERE em.establishment_id = si.establishment_id
              AND em.user_id = p_user_id
              AND em.role = 'CASHIER'::public.membership_role
              AND em.status = 'ACTIVE'::public.entity_status
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_stock_item(
  p_user_id uuid,
  p_stock_item_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stock_items si
    INNER JOIN public.departments d ON d.id = si.department_id
    WHERE si.id = p_stock_item_id
      AND public.user_can_manage_stock(p_user_id, si.establishment_id, d.code)
  );
$$;

CREATE OR REPLACE FUNCTION public.write_stock_audit_log(
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
    'stock_item',
    p_entity_id,
    p_action,
    p_actor_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: record stock entry (atomic)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_stock_entry(
  p_stock_item_id uuid,
  p_movement_type public.stock_movement_type,
  p_quantity numeric,
  p_purchased_quantity numeric DEFAULT NULL,
  p_conversion_factor numeric DEFAULT 1,
  p_unit_cost integer DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_item public.stock_items%ROWTYPE;
  v_department_code public.department_code;
  v_quantity numeric(14, 3);
  v_before numeric(14, 3);
  v_after numeric(14, 3);
  v_total_cost integer;
  v_movement_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_movement_type NOT IN ('PURCHASE'::public.stock_movement_type, 'MANUAL_ENTRY'::public.stock_movement_type) THEN
    RAISE EXCEPTION 'Type de mouvement invalide pour une entrée.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être strictement positive.';
  END IF;

  IF p_conversion_factor IS NULL OR p_conversion_factor <= 0 THEN
    RAISE EXCEPTION 'Le coefficient de conversion doit être strictement positif.';
  END IF;

  v_quantity := round(p_quantity::numeric, 3);

  SELECT si.*
  INTO v_item
  FROM public.stock_items si
  WHERE si.id = p_stock_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article de stock introuvable.';
  END IF;

  SELECT d.code
  INTO v_department_code
  FROM public.departments d
  WHERE d.id = v_item.department_id;

  IF NOT public.user_can_manage_stock(v_user_id, v_item.establishment_id, v_department_code) THEN
    RAISE EXCEPTION 'Permission insuffisante pour gérer ce stock.';
  END IF;

  IF p_supplier_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.suppliers s
    WHERE s.id = p_supplier_id
      AND s.establishment_id = v_item.establishment_id
      AND s.active = true
  ) THEN
    RAISE EXCEPTION 'Fournisseur invalide.';
  END IF;

  v_before := v_item.current_quantity;
  v_after := v_before + v_quantity;

  IF v_after < 0 THEN
    RAISE EXCEPTION 'Le stock ne peut pas devenir négatif.';
  END IF;

  v_total_cost := CASE
    WHEN p_unit_cost IS NOT NULL THEN p_unit_cost * ceil(v_quantity)::integer
    ELSE NULL
  END;

  UPDATE public.stock_items
  SET current_quantity = v_after, updated_at = now()
  WHERE id = v_item.id;

  INSERT INTO public.stock_movements (
    organization_id,
    establishment_id,
    stock_item_id,
    type,
    quantity,
    quantity_before,
    quantity_after,
    unit_cost,
    total_cost,
    supplier_id,
    reference,
    reason,
    created_by
  )
  VALUES (
    v_item.organization_id,
    v_item.establishment_id,
    v_item.id,
    p_movement_type,
    v_quantity,
    v_before,
    v_after,
    p_unit_cost,
    v_total_cost,
    p_supplier_id,
    NULLIF(btrim(p_reference), ''),
    NULLIF(btrim(p_reason), ''),
    v_user_id
  )
  RETURNING id INTO v_movement_id;

  PERFORM public.write_stock_audit_log(
    v_item.organization_id,
    v_item.establishment_id,
    v_item.id,
    'STOCK_ENTRY_RECORDED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'movement_id', v_movement_id,
      'type', p_movement_type,
      'quantity', v_quantity,
      'purchased_quantity', p_purchased_quantity,
      'conversion_factor', p_conversion_factor,
      'quantity_before', v_before,
      'quantity_after', v_after,
      'unit_cost', p_unit_cost,
      'total_cost', v_total_cost
    )
  );

  RETURN v_movement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_stock_loss(
  p_stock_item_id uuid,
  p_movement_type public.stock_movement_type,
  p_quantity numeric,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_item public.stock_items%ROWTYPE;
  v_department_code public.department_code;
  v_quantity numeric(14, 3);
  v_before numeric(14, 3);
  v_after numeric(14, 3);
  v_movement_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_movement_type NOT IN (
    'LOSS'::public.stock_movement_type,
    'BREAKAGE'::public.stock_movement_type,
    'STAFF_CONSUMPTION'::public.stock_movement_type,
    'GIFT'::public.stock_movement_type
  ) THEN
    RAISE EXCEPTION 'Type de mouvement invalide pour une perte.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être strictement positive.';
  END IF;

  v_quantity := round(p_quantity::numeric, 3);

  SELECT si.*
  INTO v_item
  FROM public.stock_items si
  WHERE si.id = p_stock_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article de stock introuvable.';
  END IF;

  SELECT d.code
  INTO v_department_code
  FROM public.departments d
  WHERE d.id = v_item.department_id;

  IF NOT public.user_can_manage_stock(v_user_id, v_item.establishment_id, v_department_code) THEN
    RAISE EXCEPTION 'Permission insuffisante pour gérer ce stock.';
  END IF;

  v_before := v_item.current_quantity;
  v_after := v_before - v_quantity;

  IF v_after < 0 THEN
    RAISE EXCEPTION 'Stock insuffisant pour enregistrer cette perte.';
  END IF;

  UPDATE public.stock_items
  SET current_quantity = v_after, updated_at = now()
  WHERE id = v_item.id;

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
    v_item.organization_id,
    v_item.establishment_id,
    v_item.id,
    p_movement_type,
    -v_quantity,
    v_before,
    v_after,
    NULLIF(btrim(p_reason), ''),
    v_user_id
  )
  RETURNING id INTO v_movement_id;

  PERFORM public.write_stock_audit_log(
    v_item.organization_id,
    v_item.establishment_id,
    v_item.id,
    'STOCK_LOSS_RECORDED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'movement_id', v_movement_id,
      'type', p_movement_type,
      'quantity', v_quantity,
      'quantity_before', v_before,
      'quantity_after', v_after
    )
  );

  RETURN v_movement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_stock_quantity(
  p_stock_item_id uuid,
  p_new_quantity numeric,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_item public.stock_items%ROWTYPE;
  v_department_code public.department_code;
  v_before numeric(14, 3);
  v_after numeric(14, 3);
  v_delta numeric(14, 3);
  v_movement_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_new_quantity IS NULL OR p_new_quantity < 0 THEN
    RAISE EXCEPTION 'La quantité corrigée doit être positive ou nulle.';
  END IF;

  v_after := round(p_new_quantity::numeric, 3);

  SELECT si.*
  INTO v_item
  FROM public.stock_items si
  WHERE si.id = p_stock_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article de stock introuvable.';
  END IF;

  SELECT d.code
  INTO v_department_code
  FROM public.departments d
  WHERE d.id = v_item.department_id;

  IF NOT public.user_can_manage_stock(v_user_id, v_item.establishment_id, v_department_code) THEN
    RAISE EXCEPTION 'Permission insuffisante pour corriger ce stock.';
  END IF;

  v_before := v_item.current_quantity;
  v_delta := v_after - v_before;

  IF v_delta = 0 THEN
    RAISE EXCEPTION 'Aucune correction nécessaire.';
  END IF;

  UPDATE public.stock_items
  SET current_quantity = v_after, updated_at = now()
  WHERE id = v_item.id;

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
    v_item.organization_id,
    v_item.establishment_id,
    v_item.id,
    'INVENTORY_ADJUSTMENT'::public.stock_movement_type,
    v_delta,
    v_before,
    v_after,
    NULLIF(btrim(p_reason), ''),
    v_user_id
  )
  RETURNING id INTO v_movement_id;

  PERFORM public.write_stock_audit_log(
    v_item.organization_id,
    v_item.establishment_id,
    v_item.id,
    'STOCK_ADJUSTMENT_RECORDED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'movement_id', v_movement_id,
      'quantity_before', v_before,
      'quantity_after', v_after,
      'delta', v_delta
    )
  );

  RETURN v_movement_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.suppliers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY suppliers_select_manage
  ON public.suppliers
  FOR SELECT
  TO authenticated
  USING (public.user_can_manage_stock((SELECT auth.uid()), establishment_id));

CREATE POLICY suppliers_insert_manage
  ON public.suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_manage_stock((SELECT auth.uid()), establishment_id));

CREATE POLICY suppliers_update_manage
  ON public.suppliers
  FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_stock((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_stock((SELECT auth.uid()), establishment_id));

CREATE POLICY stock_items_select_authorized
  ON public.stock_items
  FOR SELECT
  TO authenticated
  USING (public.user_can_read_stock_item((SELECT auth.uid()), id));

CREATE POLICY stock_items_insert_manage
  ON public.stock_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.departments d
      WHERE d.id = department_id
        AND public.user_can_manage_stock((SELECT auth.uid()), establishment_id, d.code)
    )
  );

CREATE POLICY stock_items_update_manage
  ON public.stock_items
  FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_stock_item((SELECT auth.uid()), id))
  WITH CHECK (public.user_can_manage_stock_item((SELECT auth.uid()), id));

CREATE POLICY stock_movements_select_authorized
  ON public.stock_movements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stock_items si
      WHERE si.id = stock_item_id
        AND public.user_can_read_stock_item((SELECT auth.uid()), si.id)
    )
  );

CREATE POLICY stock_movements_immutable_update
  ON public.stock_movements
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY stock_movements_immutable_delete
  ON public.stock_movements
  FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY inventory_sessions_select_manage
  ON public.inventory_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.departments d
      WHERE d.id = department_id
        AND public.user_can_manage_stock((SELECT auth.uid()), establishment_id, d.code)
    )
  );

CREATE POLICY inventory_sessions_insert_manage
  ON public.inventory_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    started_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.departments d
      WHERE d.id = department_id
        AND public.user_can_manage_stock((SELECT auth.uid()), establishment_id, d.code)
    )
  );

CREATE POLICY inventory_sessions_update_manage
  ON public.inventory_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.departments d
      WHERE d.id = department_id
        AND public.user_can_manage_stock((SELECT auth.uid()), establishment_id, d.code)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.departments d
      WHERE d.id = department_id
        AND public.user_can_manage_stock((SELECT auth.uid()), establishment_id, d.code)
    )
  );

CREATE POLICY inventory_lines_select_manage
  ON public.inventory_lines
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.inventory_sessions s
      INNER JOIN public.departments d ON d.id = s.department_id
      WHERE s.id = inventory_session_id
        AND public.user_can_manage_stock((SELECT auth.uid()), s.establishment_id, d.code)
    )
  );

CREATE POLICY inventory_lines_insert_manage
  ON public.inventory_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.inventory_sessions s
      INNER JOIN public.departments d ON d.id = s.department_id
      WHERE s.id = inventory_session_id
        AND public.user_can_manage_stock((SELECT auth.uid()), s.establishment_id, d.code)
    )
  );

CREATE POLICY inventory_lines_update_manage
  ON public.inventory_lines
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.inventory_sessions s
      INNER JOIN public.departments d ON d.id = s.department_id
      WHERE s.id = inventory_session_id
        AND public.user_can_manage_stock((SELECT auth.uid()), s.establishment_id, d.code)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.inventory_sessions s
      INNER JOIN public.departments d ON d.id = s.department_id
      WHERE s.id = inventory_session_id
        AND public.user_can_manage_stock((SELECT auth.uid()), s.establishment_id, d.code)
    )
  );

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.suppliers FROM anon;
REVOKE ALL ON TABLE public.stock_items FROM anon;
REVOKE ALL ON TABLE public.stock_movements FROM anon;
REVOKE ALL ON TABLE public.inventory_sessions FROM anon;
REVOKE ALL ON TABLE public.inventory_lines FROM anon;

REVOKE ALL ON TYPE public.stock_movement_type FROM anon;
REVOKE ALL ON TYPE public.inventory_session_status FROM anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.stock_items TO authenticated;
GRANT SELECT ON TABLE public.stock_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.inventory_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.inventory_lines TO authenticated;

GRANT USAGE ON TYPE public.stock_movement_type TO authenticated;
GRANT USAGE ON TYPE public.inventory_session_status TO authenticated;

REVOKE ALL ON FUNCTION public.user_can_manage_stock(uuid, uuid, public.department_code) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_read_stock_item(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_manage_stock_item(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.write_stock_audit_log(uuid, uuid, uuid, public.audit_action, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_stock_entry(uuid, public.stock_movement_type, numeric, numeric, numeric, integer, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_stock_loss(uuid, public.stock_movement_type, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_stock_quantity(uuid, numeric, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.user_can_manage_stock(uuid, uuid, public.department_code) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_read_stock_item(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_stock_item(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_stock_entry(uuid, public.stock_movement_type, numeric, numeric, numeric, integer, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_stock_loss(uuid, public.stock_movement_type, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock_quantity(uuid, numeric, text) TO authenticated;
