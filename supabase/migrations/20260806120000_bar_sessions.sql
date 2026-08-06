-- FasoBar: sessions de service Responsable Bar (passation séquentielle + bilan)
-- Une seule session OPEN par établissement. Appliquer manuellement (db push / SQL Editor).

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'BAR_SESSION_OPENED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'BAR_SESSION_CLOSED';

CREATE TYPE public.bar_session_status AS ENUM (
  'OPEN',
  'CLOSED',
  'CANCELLED'
);

CREATE TABLE public.bar_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  closed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  status public.bar_session_status NOT NULL DEFAULT 'OPEN'::public.bar_session_status,
  opening_note text,
  closing_note text,
  orders_ready_count integer NOT NULL DEFAULT 0,
  closing_orders_pending_count integer,
  closing_stock_entries_count integer,
  closing_stock_entries_cost integer,
  closing_stock_losses_count integer,
  closing_stock_losses_qty numeric(14, 3),
  closing_low_stock_count integer,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bar_sessions_orders_ready_non_negative CHECK (orders_ready_count >= 0)
);

CREATE UNIQUE INDEX bar_sessions_one_open_per_establishment
  ON public.bar_sessions (establishment_id)
  WHERE status = 'OPEN'::public.bar_session_status;

CREATE INDEX bar_sessions_organization_id_idx ON public.bar_sessions (organization_id);
CREATE INDEX bar_sessions_establishment_id_idx ON public.bar_sessions (establishment_id);
CREATE INDEX bar_sessions_status_idx ON public.bar_sessions (status);
CREATE INDEX bar_sessions_opened_by_idx ON public.bar_sessions (opened_by);

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS bar_session_id uuid REFERENCES public.bar_sessions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS stock_movements_bar_session_id_idx
  ON public.stock_movements (bar_session_id);

CREATE TRIGGER bar_sessions_set_updated_at
  BEFORE UPDATE ON public.bar_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_is_bar_session_operator(
  p_user_id uuid,
  p_establishment_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.user_has_department_manager_role(
    p_user_id,
    p_establishment_id,
    'BAR'::public.department_code
  )
  AND NOT public.user_can_manage_products(p_user_id, p_establishment_id);
$$;

CREATE OR REPLACE FUNCTION public.get_active_bar_session(
  p_user_id uuid,
  p_establishment_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id
  FROM public.bar_sessions s
  WHERE s.establishment_id = p_establishment_id
    AND s.opened_by = p_user_id
    AND s.status = 'OPEN'::public.bar_session_status
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_open_bar_session(
  p_establishment_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id
  FROM public.bar_sessions s
  WHERE s.establishment_id = p_establishment_id
    AND s.status = 'OPEN'::public.bar_session_status
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_can_read_bar_session(
  p_user_id uuid,
  p_session_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bar_sessions s
    WHERE s.id = p_session_id
      AND (
        public.user_can_manage_products(p_user_id, s.establishment_id)
        OR public.user_has_department_manager_role(
          p_user_id,
          s.establishment_id,
          'BAR'::public.department_code
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.write_bar_session_audit_log(
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
    'bar_session',
    p_entity_id,
    p_action,
    p_actor_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: rattache les mouvements stock BAR à la session + gate opérateurs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stock_movements_attach_bar_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_department_code public.department_code;
  v_session_id uuid;
BEGIN
  SELECT d.code
  INTO v_department_code
  FROM public.stock_items si
  INNER JOIN public.departments d ON d.id = si.department_id
  WHERE si.id = NEW.stock_item_id;

  IF v_department_code IS DISTINCT FROM 'BAR'::public.department_code THEN
    RETURN NEW;
  END IF;

  v_session_id := public.get_active_bar_session(NEW.created_by, NEW.establishment_id);

  IF public.user_is_bar_session_operator(NEW.created_by, NEW.establishment_id)
     AND v_session_id IS NULL THEN
    RAISE EXCEPTION 'Ouvrez votre service bar avant d''enregistrer un mouvement de stock.';
  END IF;

  IF v_session_id IS NOT NULL THEN
    NEW.bar_session_id := v_session_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_movements_attach_bar_session ON public.stock_movements;
CREATE TRIGGER stock_movements_attach_bar_session
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.stock_movements_attach_bar_session();

-- ---------------------------------------------------------------------------
-- RPC: open / close
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.open_bar_session(
  p_opening_note text DEFAULT NULL
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
  v_session_id uuid;
  v_holder_name text;
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
    AND em.role = 'BAR_MANAGER'::public.membership_role
  LIMIT 1;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Permission insuffisante pour ouvrir un service bar.';
  END IF;

  IF NOT public.user_is_bar_session_operator(v_user_id, v_establishment_id) THEN
    RAISE EXCEPTION 'Permission insuffisante pour ouvrir un service bar.';
  END IF;

  IF public.get_active_bar_session(v_user_id, v_establishment_id) IS NOT NULL THEN
    RAISE EXCEPTION 'Votre service bar est déjà ouvert.';
  END IF;

  SELECT s.id, p.full_name
  INTO v_session_id, v_holder_name
  FROM public.bar_sessions s
  INNER JOIN public.profiles p ON p.id = s.opened_by
  WHERE s.establishment_id = v_establishment_id
    AND s.status = 'OPEN'::public.bar_session_status
  LIMIT 1;

  IF v_session_id IS NOT NULL THEN
    RAISE EXCEPTION 'Un service bar est déjà ouvert par %. Clôturez-le avant de prendre la relève.',
      COALESCE(v_holder_name, 'un autre responsable');
  END IF;

  INSERT INTO public.bar_sessions (
    organization_id,
    establishment_id,
    opened_by,
    status,
    opening_note
  )
  VALUES (
    v_organization_id,
    v_establishment_id,
    v_user_id,
    'OPEN'::public.bar_session_status,
    NULLIF(btrim(p_opening_note), '')
  )
  RETURNING id INTO v_session_id;

  PERFORM public.write_bar_session_audit_log(
    v_organization_id,
    v_establishment_id,
    v_session_id,
    'BAR_SESSION_OPENED'::public.audit_action,
    v_user_id,
    jsonb_build_object('opening_note', NULLIF(btrim(p_opening_note), ''))
  );

  RETURN v_session_id;
END;
$$;

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
  v_pending integer;
  v_entries_count integer;
  v_entries_cost integer;
  v_losses_count integer;
  v_losses_qty numeric(14, 3);
  v_low_stock integer;
  v_bar_department_id uuid;
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

  SELECT d.id
  INTO v_bar_department_id
  FROM public.departments d
  WHERE d.establishment_id = v_session.establishment_id
    AND d.code = 'BAR'::public.department_code
  LIMIT 1;

  SELECT COUNT(*)::integer
  INTO v_pending
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status <> 'CANCELLED'::public.order_status
    AND o.payment_status <> 'PAID'::public.order_payment_status
    AND o.bar_status IN (
      'TO_PREPARE'::public.bar_prep_status,
      'IN_PREPARATION'::public.bar_prep_status
    );

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
    )
  INTO v_entries_count, v_entries_cost, v_losses_count, v_losses_qty
  FROM public.stock_movements sm
  WHERE sm.bar_session_id = p_session_id;

  SELECT COUNT(*)::integer
  INTO v_low_stock
  FROM public.stock_items si
  WHERE si.establishment_id = v_session.establishment_id
    AND si.department_id = v_bar_department_id
    AND si.active = true
    AND si.current_quantity <= si.minimum_quantity;

  UPDATE public.bar_sessions
  SET
    status = 'CLOSED'::public.bar_session_status,
    closed_by = v_user_id,
    closing_note = NULLIF(btrim(p_closing_note), ''),
    closing_orders_pending_count = v_pending,
    closing_stock_entries_count = COALESCE(v_entries_count, 0),
    closing_stock_entries_cost = COALESCE(v_entries_cost, 0),
    closing_stock_losses_count = COALESCE(v_losses_count, 0),
    closing_stock_losses_qty = COALESCE(v_losses_qty, 0),
    closing_low_stock_count = COALESCE(v_low_stock, 0),
    closed_at = now(),
    updated_at = now()
  WHERE id = p_session_id;

  PERFORM public.write_bar_session_audit_log(
    v_session.organization_id,
    v_session.establishment_id,
    p_session_id,
    'BAR_SESSION_CLOSED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'orders_ready_count', v_session.orders_ready_count,
      'orders_pending_count', v_pending,
      'stock_entries_count', COALESCE(v_entries_count, 0),
      'stock_losses_count', COALESCE(v_losses_count, 0)
    )
  );

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'orders_ready_count', v_session.orders_ready_count,
    'orders_pending_count', v_pending,
    'stock_entries_count', COALESCE(v_entries_count, 0),
    'stock_entries_cost', COALESCE(v_entries_cost, 0),
    'stock_losses_count', COALESCE(v_losses_count, 0),
    'stock_losses_qty', COALESCE(v_losses_qty, 0),
    'low_stock_count', COALESCE(v_low_stock, 0)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Patch: update_order_bar_status exige une session pour les opérateurs bar
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.bar_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY bar_sessions_select
  ON public.bar_sessions FOR SELECT TO authenticated
  USING (public.user_can_read_bar_session((SELECT auth.uid()), id));

CREATE POLICY bar_sessions_immutable
  ON public.bar_sessions FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.bar_sessions FROM anon;
GRANT SELECT ON TABLE public.bar_sessions TO authenticated;

REVOKE ALL ON TYPE public.bar_session_status FROM anon;
GRANT USAGE ON TYPE public.bar_session_status TO authenticated;

REVOKE ALL ON FUNCTION public.user_is_bar_session_operator(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_active_bar_session(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_open_bar_session(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_read_bar_session(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.write_bar_session_audit_log(uuid, uuid, uuid, public.audit_action, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.stock_movements_attach_bar_session() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_bar_session(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_bar_session(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.user_is_bar_session_operator(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_bar_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_open_bar_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_read_bar_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_bar_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_bar_session(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_order_bar_status(uuid, public.bar_prep_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_order_bar_status(uuid, public.bar_prep_status) TO authenticated;
