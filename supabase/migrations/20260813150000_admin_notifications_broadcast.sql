-- FasoBar: publication Realtime + broadcast à chaque notification admin.
-- Appliquer manuellement après les migrations notifications.

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
  v_title text := btrim(p_title);
  v_body text := NULLIF(btrim(COALESCE(p_body, '')), '');
  v_href text := NULLIF(btrim(COALESCE(p_href, '')), '');
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
    v_title,
    v_body,
    v_href,
    NULLIF(btrim(COALESCE(p_entity_type, '')), ''),
    p_entity_id,
    p_actor_id
  )
  RETURNING id INTO v_id;

  BEGIN
    PERFORM realtime.send(
      jsonb_build_object(
        'id', v_id,
        'kind', p_kind,
        'title', v_title,
        'body', v_body,
        'href', v_href,
        'created_at', now(),
        'establishment_id', p_establishment_id
      ),
      'new',
      'fasobar-admin:' || p_establishment_id::text,
      false
    );
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;

  RETURN v_id;
END;
$$;
