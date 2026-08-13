-- FasoBar: realtime complet + notification admin à l’arrivée d’une commande.
-- Appliquer après 20260813140000. Ne pas modifier les migrations antérieures.

CREATE OR REPLACE FUNCTION public.notify_admin_on_order_prep()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor text;
  v_title text;
  v_body text;
  v_is_add boolean := false;
  v_bar_to_prep boolean := false;
  v_kitchen_to_prep boolean := false;
BEGIN
  IF NEW.status = 'CANCELLED'::public.order_status THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_bar_to_prep := NEW.bar_status = 'TO_PREPARE'::public.bar_prep_status;
    v_kitchen_to_prep := NEW.kitchen_status = 'TO_PREPARE'::public.kitchen_prep_status;
  ELSE
    v_bar_to_prep :=
      NEW.bar_status = 'TO_PREPARE'::public.bar_prep_status
      AND OLD.bar_status IS DISTINCT FROM 'TO_PREPARE'::public.bar_prep_status;
    v_kitchen_to_prep :=
      NEW.kitchen_status = 'TO_PREPARE'::public.kitchen_prep_status
      AND OLD.kitchen_status IS DISTINCT FROM 'TO_PREPARE'::public.kitchen_prep_status;
  END IF;

  IF NOT v_bar_to_prep AND NOT v_kitchen_to_prep THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (v_bar_to_prep AND OLD.bar_status = 'READY'::public.bar_prep_status)
      OR (
        v_kitchen_to_prep
        AND OLD.kitchen_status IN (
          'READY'::public.kitchen_prep_status,
          'SERVED'::public.kitchen_prep_status
        )
      )
    THEN
      v_is_add := true;
    END IF;
  END IF;

  SELECT p.full_name INTO v_actor
  FROM public.profiles p
  WHERE p.id = NEW.created_by;

  IF v_is_add THEN
    v_title := 'Ajout commande #' || NEW.order_number::text;
  ELSE
    v_title := 'Nouvelle commande #' || NEW.order_number::text;
  END IF;

  v_body := COALESCE(
    NULLIF(btrim(COALESCE(NEW.table_reference, '')), ''),
    NULLIF(btrim(COALESCE(NEW.customer_reference, '')), ''),
    'Caisse'
  ) || COALESCE(' · ' || v_actor, '');

  PERFORM public.insert_admin_notification(
    NEW.organization_id,
    NEW.establishment_id,
    'ORDER'::public.admin_notification_kind,
    v_title,
    v_body,
    '/application/commandes',
    'order',
    NEW.id,
    NEW.created_by
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_notify_admin_prep ON public.orders;
CREATE TRIGGER orders_notify_admin_prep
  AFTER INSERT OR UPDATE OF bar_status, kitchen_status, status
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_order_prep();

DO $$
DECLARE
  tables text[] := ARRAY[
    'orders',
    'order_items',
    'payments',
    'cash_register_sessions',
    'bar_sessions',
    'stock_movements',
    'stock_items',
    'products',
    'categories',
    'product_packagings',
    'expenses',
    'inventory_sessions',
    'admin_notifications'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = t
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'admin_notifications'
  ) THEN
    EXECUTE 'ALTER TABLE public.admin_notifications REPLICA IDENTITY FULL';
  END IF;
END
$$;
