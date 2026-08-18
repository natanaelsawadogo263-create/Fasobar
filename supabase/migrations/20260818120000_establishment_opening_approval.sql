-- Validation Super Admin avant accès à l’espace établissement.

CREATE TYPE public.establishment_opening_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE public.establishment_opening_requests (
  organization_id uuid PRIMARY KEY
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL
    REFERENCES public.establishments (id) ON DELETE CASCADE,
  requested_by uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  status public.establishment_opening_status NOT NULL DEFAULT 'PENDING',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  review_note text,
  CONSTRAINT establishment_opening_requests_establishment_id_key
    UNIQUE (establishment_id)
);

CREATE INDEX establishment_opening_requests_status_idx
  ON public.establishment_opening_requests (status);

ALTER TABLE public.establishment_opening_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishment_opening_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY establishment_opening_requests_select
  ON public.establishment_opening_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.organization_id = establishment_opening_requests.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'ACTIVE'::public.entity_status
    )
  );

GRANT SELECT ON TABLE public.establishment_opening_requests TO authenticated;

-- Nouvelle inscription → demande PENDING (pas d’accès admin immédiat).
CREATE OR REPLACE FUNCTION public.bootstrap_organization(
  organization_name text,
  organization_slug text,
  establishment_name text,
  establishment_slug text,
  establishment_type public.establishment_type,
  phone text DEFAULT NULL,
  address text DEFAULT NULL,
  city text DEFAULT NULL,
  country text DEFAULT 'Burkina Faso',
  currency text DEFAULT 'XOF',
  timezone text DEFAULT 'Africa/Ouagadougou'
)
RETURNS TABLE (
  organization_id uuid,
  establishment_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_org_slug text;
  v_est_slug text;
  v_org_id uuid;
  v_est_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_user_id
      AND p.status = 'ACTIVE'::public.entity_status
  ) THEN
    RAISE EXCEPTION 'Profil utilisateur inactif ou introuvable.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    INNER JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = v_user_id
      AND om.status = 'ACTIVE'::public.entity_status
      AND o.status = 'ACTIVE'::public.entity_status
  ) THEN
    RAISE EXCEPTION 'Cet utilisateur possède déjà une organisation active.';
  END IF;

  IF btrim(organization_name) = '' OR btrim(establishment_name) = '' THEN
    RAISE EXCEPTION 'Le nom commercial et le nom de l''établissement sont obligatoires.';
  END IF;

  v_org_slug := public.normalize_slug(organization_slug);
  v_est_slug := public.normalize_slug(establishment_slug);

  INSERT INTO public.organizations (name, slug, phone, status)
  VALUES (btrim(organization_name), v_org_slug, NULLIF(btrim(phone), ''), 'ACTIVE')
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_memberships (
    organization_id,
    user_id,
    role,
    status
  )
  VALUES (
    v_org_id,
    v_user_id,
    'OWNER'::public.membership_role,
    'ACTIVE'::public.entity_status
  );

  INSERT INTO public.establishments (
    organization_id,
    name,
    slug,
    establishment_type,
    address,
    city,
    country,
    currency,
    timezone,
    status
  )
  VALUES (
    v_org_id,
    btrim(establishment_name),
    v_est_slug,
    establishment_type,
    NULLIF(btrim(address), ''),
    NULLIF(btrim(city), ''),
    COALESCE(NULLIF(btrim(country), ''), 'Burkina Faso'),
    COALESCE(NULLIF(btrim(currency), ''), 'XOF'),
    COALESCE(NULLIF(btrim(timezone), ''), 'Africa/Ouagadougou'),
    'ACTIVE'::public.entity_status
  )
  RETURNING id INTO v_est_id;

  INSERT INTO public.establishment_memberships (
    establishment_id,
    user_id,
    role,
    status
  )
  VALUES (
    v_est_id,
    v_user_id,
    'OWNER'::public.membership_role,
    'ACTIVE'::public.entity_status
  );

  INSERT INTO public.establishment_opening_requests (
    organization_id,
    establishment_id,
    requested_by,
    status
  )
  VALUES (
    v_org_id,
    v_est_id,
    v_user_id,
    'PENDING'::public.establishment_opening_status
  );

  PERFORM public.seed_establishment_departments(v_org_id, v_est_id);

  RETURN QUERY SELECT v_org_id, v_est_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_establishment_opening(
  p_organization_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  UPDATE public.establishment_opening_requests
  SET
    status = 'APPROVED'::public.establishment_opening_status,
    reviewed_at = now(),
    reviewed_by = v_actor,
    review_note = NULL
  WHERE organization_id = p_organization_id
    AND status = 'PENDING'::public.establishment_opening_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable ou déjà traitée.';
  END IF;

  PERFORM public.write_platform_audit_log(
    'approve_establishment_opening',
    p_organization_id,
    'establishment_opening_requests',
    p_organization_id,
    '{}'::jsonb
  );

  RETURN p_organization_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_establishment_opening(
  p_organization_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  UPDATE public.establishment_opening_requests
  SET
    status = 'REJECTED'::public.establishment_opening_status,
    reviewed_at = now(),
    reviewed_by = v_actor,
    review_note = NULLIF(btrim(COALESCE(p_reason, '')), '')
  WHERE organization_id = p_organization_id
    AND status = 'PENDING'::public.establishment_opening_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable ou déjà traitée.';
  END IF;

  PERFORM public.write_platform_audit_log(
    'reject_establishment_opening',
    p_organization_id,
    'establishment_opening_requests',
    p_organization_id,
    jsonb_build_object('reason', p_reason)
  );

  RETURN p_organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_establishment_opening(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_establishment_opening(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_establishment_opening(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_establishment_opening(uuid, text) TO authenticated;
