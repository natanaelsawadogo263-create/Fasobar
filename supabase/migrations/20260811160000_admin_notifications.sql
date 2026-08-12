-- FasoBar: notifications admin (ventes, appro, pertes, sessions).
-- Appliquer manuellement. Ne pas modifier les migrations antérieures.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_notification_kind') THEN
    CREATE TYPE public.admin_notification_kind AS ENUM (
      'SALE',
      'SUPPLY',
      'LOSS',
      'CASH_SESSION_OPEN',
      'CASH_SESSION_CLOSE',
      'BAR_SESSION_OPEN',
      'BAR_SESSION_CLOSE',
      'EXPENSE'
    );
  END IF;
END
$$;

GRANT USAGE ON TYPE public.admin_notification_kind TO authenticated;

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  kind public.admin_notification_kind NOT NULL,
  title text NOT NULL,
  body text,
  href text,
  entity_type text,
  entity_id uuid,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_notifications_title_not_blank CHECK (btrim(title) <> '')
);

CREATE INDEX IF NOT EXISTS admin_notifications_establishment_created_idx
  ON public.admin_notifications (establishment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_notifications_kind_idx
  ON public.admin_notifications (kind);

CREATE TABLE IF NOT EXISTS public.admin_notification_reads (
  notification_id uuid NOT NULL REFERENCES public.admin_notifications (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS admin_notification_reads_user_idx
  ON public.admin_notification_reads (user_id, read_at DESC);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_reads FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_notifications_select_admin ON public.admin_notifications;
CREATE POLICY admin_notifications_select_admin
  ON public.admin_notifications
  FOR SELECT
  TO authenticated
  USING (
    public.user_belongs_to_establishment(auth.uid(), establishment_id)
    AND public.user_is_organization_owner_or_admin(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS admin_notification_reads_select_own ON public.admin_notification_reads;
CREATE POLICY admin_notification_reads_select_own
  ON public.admin_notification_reads
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS admin_notification_reads_insert_own ON public.admin_notification_reads;
CREATE POLICY admin_notification_reads_insert_own
  ON public.admin_notification_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.admin_notifications FROM anon;
REVOKE ALL ON TABLE public.admin_notification_reads FROM anon;
GRANT SELECT ON TABLE public.admin_notifications TO authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_notification_reads TO authenticated;

CREATE OR REPLACE FUNCTION public.insert_admin_notification(
  p_organization_id uuid,
  p_establishment_id uuid,
  p_kind public.admin_notification_kind,
  p_title text,
  p_body text DEFAULT NULL,
  p_href text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.admin_notifications (
    organization_id,
    establishment_id,
    kind,
    title,
    body,
    href,
    entity_type,
    entity_id,
    actor_id
  ) VALUES (
    p_organization_id,
    p_establishment_id,
    p_kind,
    btrim(p_title),
    NULLIF(btrim(COALESCE(p_body, '')), ''),
    NULLIF(btrim(COALESCE(p_href, '')), ''),
    NULLIF(btrim(COALESCE(p_entity_type, '')), ''),
    p_entity_id,
    p_actor_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_admin_notification(
  uuid, uuid, public.admin_notification_kind, text, text, text, text, uuid, uuid
) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.mark_admin_notifications_read(
  p_establishment_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT e.organization_id INTO v_org_id
  FROM public.establishments e
  WHERE e.id = p_establishment_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Établissement introuvable';
  END IF;

  IF NOT public.user_belongs_to_establishment(v_user_id, p_establishment_id)
     OR NOT public.user_is_organization_owner_or_admin(v_user_id, v_org_id) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;

  INSERT INTO public.admin_notification_reads (notification_id, user_id)
  SELECT n.id, v_user_id
  FROM public.admin_notifications n
  WHERE n.establishment_id = p_establishment_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.admin_notification_reads r
      WHERE r.notification_id = n.id
        AND r.user_id = v_user_id
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_admin_notifications_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_admin_notifications_read(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_admin_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_number integer;
  v_actor text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'CONFIRMED'::public.payment_status THEN
    RETURN NEW;
  END IF;

  SELECT o.order_number INTO v_order_number
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  SELECT p.full_name INTO v_actor
  FROM public.profiles p
  WHERE p.id = NEW.received_by;

  PERFORM public.insert_admin_notification(
    NEW.organization_id,
    NEW.establishment_id,
    'SALE'::public.admin_notification_kind,
    'Vente encaissée — ' || trim(to_char(NEW.amount_applied, 'FM999G999G999')) || ' F',
    COALESCE('Commande #' || v_order_number::text, 'Paiement')
      || COALESCE(' · ' || v_actor, ''),
    '/application/ventes',
    'payment',
    NEW.id,
    NEW.received_by
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_notify_admin ON public.payments;
CREATE TRIGGER payments_notify_admin
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_payment();

CREATE OR REPLACE FUNCTION public.notify_admin_on_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item_name text;
  v_actor text;
  v_qty text;
  v_kind public.admin_notification_kind;
  v_title text;
  v_href text;
BEGIN
  SELECT si.name INTO v_item_name
  FROM public.stock_items si
  WHERE si.id = NEW.stock_item_id;

  SELECT p.full_name INTO v_actor
  FROM public.profiles p
  WHERE p.id = NEW.created_by;

  v_qty := trim(to_char(abs(NEW.quantity), 'FM999G999G990.999'));

  IF NEW.type = 'PURCHASE'::public.stock_movement_type THEN
    v_kind := 'SUPPLY'::public.admin_notification_kind;
    v_title := 'Approvisionnement — ' || COALESCE(v_item_name, 'Article');
    v_href := '/application/approvisionnements';
  ELSIF NEW.type IN (
    'LOSS'::public.stock_movement_type,
    'BREAKAGE'::public.stock_movement_type,
    'STAFF_CONSUMPTION'::public.stock_movement_type,
    'GIFT'::public.stock_movement_type
  ) THEN
    v_kind := 'LOSS'::public.admin_notification_kind;
    v_title := 'Perte déclarée — ' || COALESCE(v_item_name, 'Article');
    v_href := '/application/stock';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.insert_admin_notification(
    NEW.organization_id,
    NEW.establishment_id,
    v_kind,
    v_title,
    'Qté ' || v_qty || COALESCE(' · ' || v_actor, ''),
    v_href,
    'stock_movement',
    NEW.id,
    NEW.created_by
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_movements_notify_admin ON public.stock_movements;
CREATE TRIGGER stock_movements_notify_admin
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_stock_movement();

CREATE OR REPLACE FUNCTION public.notify_admin_on_cash_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor text;
  v_kind public.admin_notification_kind;
  v_title text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_kind := 'CASH_SESSION_OPEN'::public.admin_notification_kind;
    v_title := 'Session caisse ouverte';
    SELECT p.full_name INTO v_actor FROM public.profiles p WHERE p.id = NEW.opened_by;

    PERFORM public.insert_admin_notification(
      NEW.organization_id,
      NEW.establishment_id,
      v_kind,
      v_title,
      COALESCE(v_actor, 'Caissier'),
      '/application/caisses',
      'cash_register_session',
      NEW.id,
      NEW.opened_by
    );
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status = 'CLOSED'::public.cash_register_session_status THEN
    v_kind := 'CASH_SESSION_CLOSE'::public.admin_notification_kind;
    v_title := 'Session caisse fermée';
    SELECT p.full_name INTO v_actor
    FROM public.profiles p
    WHERE p.id = COALESCE(NEW.closed_by, NEW.opened_by);

    PERFORM public.insert_admin_notification(
      NEW.organization_id,
      NEW.establishment_id,
      v_kind,
      v_title,
      COALESCE(v_actor, 'Caissier'),
      '/application/caisses',
      'cash_register_session',
      NEW.id,
      COALESCE(NEW.closed_by, NEW.opened_by)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cash_sessions_notify_admin ON public.cash_register_sessions;
CREATE TRIGGER cash_sessions_notify_admin
  AFTER INSERT OR UPDATE OF status ON public.cash_register_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_cash_session();

CREATE OR REPLACE FUNCTION public.notify_admin_on_bar_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT p.full_name INTO v_actor FROM public.profiles p WHERE p.id = NEW.opened_by;
    PERFORM public.insert_admin_notification(
      NEW.organization_id,
      NEW.establishment_id,
      'BAR_SESSION_OPEN'::public.admin_notification_kind,
      'Session bar ouverte',
      COALESCE(v_actor, 'Responsable bar'),
      '/application/sessions-bar',
      'bar_session',
      NEW.id,
      NEW.opened_by
    );
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status = 'CLOSED'::public.bar_session_status THEN
    SELECT p.full_name INTO v_actor
    FROM public.profiles p
    WHERE p.id = COALESCE(NEW.closed_by, NEW.opened_by);
    PERFORM public.insert_admin_notification(
      NEW.organization_id,
      NEW.establishment_id,
      'BAR_SESSION_CLOSE'::public.admin_notification_kind,
      'Session bar fermée',
      COALESCE(v_actor, 'Responsable bar'),
      '/application/sessions-bar',
      'bar_session',
      NEW.id,
      COALESCE(NEW.closed_by, NEW.opened_by)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bar_sessions_notify_admin ON public.bar_sessions;
CREATE TRIGGER bar_sessions_notify_admin
  AFTER INSERT OR UPDATE OF status ON public.bar_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_bar_session();

CREATE OR REPLACE FUNCTION public.notify_admin_on_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.insert_admin_notification(
    NEW.organization_id,
    NEW.establishment_id,
    'EXPENSE'::public.admin_notification_kind,
    'Dépense — ' || trim(to_char(NEW.amount, 'FM999G999G999')) || ' F',
    NEW.label,
    '/application/depenses',
    'expense',
    NEW.id,
    NEW.created_by
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expenses_notify_admin ON public.expenses;
CREATE TRIGGER expenses_notify_admin
  AFTER INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_expense();

-- Realtime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  )
  AND EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'admin_notifications'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'admin_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
  END IF;
END
$$;
