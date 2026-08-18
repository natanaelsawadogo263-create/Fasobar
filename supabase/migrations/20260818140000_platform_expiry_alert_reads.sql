-- Lectures des alertes d'échéance (Super Admin) — badge cloche + persistance par admin.

CREATE TABLE IF NOT EXISTS public.platform_expiry_alert_reads (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  alert_id text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, alert_id)
);

CREATE INDEX IF NOT EXISTS platform_expiry_alert_reads_user_idx
  ON public.platform_expiry_alert_reads (user_id, read_at DESC);

ALTER TABLE public.platform_expiry_alert_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_expiry_alert_reads FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_expiry_alert_reads_select_own
  ON public.platform_expiry_alert_reads;
CREATE POLICY platform_expiry_alert_reads_select_own
  ON public.platform_expiry_alert_reads
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_active_platform_admin()
  );

DROP POLICY IF EXISTS platform_expiry_alert_reads_insert_own
  ON public.platform_expiry_alert_reads;
CREATE POLICY platform_expiry_alert_reads_insert_own
  ON public.platform_expiry_alert_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_active_platform_admin()
  );

REVOKE ALL ON TABLE public.platform_expiry_alert_reads FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.platform_expiry_alert_reads TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_platform_expiry_alerts_read(
  p_alert_ids text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;

  IF p_alert_ids IS NULL OR array_length(p_alert_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.platform_expiry_alert_reads (user_id, alert_id)
  SELECT v_user_id, alert_id
  FROM unnest(p_alert_ids) AS alert_id
  WHERE alert_id IS NOT NULL AND btrim(alert_id) <> ''
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_platform_expiry_alerts_read(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_platform_expiry_alerts_read(text[]) TO authenticated;

COMMENT ON TABLE public.platform_expiry_alert_reads IS
  'Alertes d''échéance essai/abonnement consultées par chaque Super Admin.';
