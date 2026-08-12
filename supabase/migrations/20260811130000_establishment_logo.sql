-- Logo établissement pour en-tête des reçus / additions
-- Appliquer manuellement via supabase db push ou SQL Editor.

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN public.establishments.logo_url IS
  'URL publique du logo affiché en en-tête des reçus et additions imprimés.';

-- Remplace la RPC paramètres pour accepter logo_url
DROP FUNCTION IF EXISTS public.update_establishment_settings(uuid, text, text, text, text, text, text, text, text, integer);

CREATE OR REPLACE FUNCTION public.update_establishment_settings(
  p_establishment_id uuid,
  p_name text,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_currency text DEFAULT 'XOF',
  p_timezone text DEFAULT 'Africa/Ouagadougou',
  p_receipt_header text DEFAULT NULL,
  p_receipt_footer text DEFAULT NULL,
  p_thank_you_message text DEFAULT NULL,
  p_default_minimum_stock integer DEFAULT 5,
  p_logo_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT organization_id INTO v_org_id FROM public.establishments WHERE id = p_establishment_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Établissement introuvable'; END IF;
  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_org_id) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Le nom de l''établissement est obligatoire'; END IF;
  IF p_default_minimum_stock IS NULL OR p_default_minimum_stock < 0 THEN
    RAISE EXCEPTION 'Le seuil de stock par défaut doit être positif ou nul';
  END IF;

  UPDATE public.establishments SET
    name = btrim(p_name),
    address = NULLIF(btrim(COALESCE(p_address, '')), ''),
    phone = NULLIF(btrim(COALESCE(p_phone, '')), ''),
    currency = COALESCE(NULLIF(btrim(p_currency), ''), 'XOF'),
    timezone = COALESCE(NULLIF(btrim(p_timezone), ''), 'Africa/Ouagadougou'),
    receipt_header = NULLIF(btrim(COALESCE(p_receipt_header, '')), ''),
    receipt_footer = NULLIF(btrim(COALESCE(p_receipt_footer, '')), ''),
    thank_you_message = NULLIF(btrim(COALESCE(p_thank_you_message, '')), ''),
    default_minimum_stock = COALESCE(p_default_minimum_stock, 5),
    logo_url = NULLIF(btrim(COALESCE(p_logo_url, '')), '')
  WHERE id = p_establishment_id;

  PERFORM public.write_admin_audit_log(
    v_org_id, p_establishment_id, 'establishment', p_establishment_id,
    'SETTINGS_UPDATED'::public.audit_action, v_user_id,
    jsonb_build_object(
      'name', btrim(p_name),
      'has_logo', NULLIF(btrim(COALESCE(p_logo_url, '')), '') IS NOT NULL
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_establishment_settings(uuid, text, text, text, text, text, text, text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_establishment_settings(uuid, text, text, text, text, text, text, text, text, integer, text) TO authenticated;

-- Bucket public logos (max 2 Mo)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'establishment-logos',
  'establishment-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "establishment_logos_public_read" ON storage.objects;
CREATE POLICY "establishment_logos_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'establishment-logos');

DROP POLICY IF EXISTS "establishment_logos_admin_insert" ON storage.objects;
CREATE POLICY "establishment_logos_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'establishment-logos'
    AND public.user_is_organization_owner_or_admin(
      (SELECT auth.uid()),
      NULLIF(split_part(name, '/', 1), '')::uuid
    )
  );

DROP POLICY IF EXISTS "establishment_logos_admin_update" ON storage.objects;
CREATE POLICY "establishment_logos_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'establishment-logos'
    AND public.user_is_organization_owner_or_admin(
      (SELECT auth.uid()),
      NULLIF(split_part(name, '/', 1), '')::uuid
    )
  )
  WITH CHECK (
    bucket_id = 'establishment-logos'
    AND public.user_is_organization_owner_or_admin(
      (SELECT auth.uid()),
      NULLIF(split_part(name, '/', 1), '')::uuid
    )
  );

DROP POLICY IF EXISTS "establishment_logos_admin_delete" ON storage.objects;
CREATE POLICY "establishment_logos_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'establishment-logos'
    AND public.user_is_organization_owner_or_admin(
      (SELECT auth.uid()),
      NULLIF(split_part(name, '/', 1), '')::uuid
    )
  );
