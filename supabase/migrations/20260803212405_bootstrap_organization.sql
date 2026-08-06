-- FasoBar: onboarding bootstrap RPC and establishment metadata

CREATE TYPE public.establishment_type AS ENUM (
  'RESTAURANT_MAQUIS',
  'RESTAURANT',
  'MAQUIS',
  'BAR'
);

ALTER TABLE public.organizations
  ADD COLUMN phone text;

ALTER TABLE public.establishments
  ADD COLUMN establishment_type public.establishment_type NOT NULL DEFAULT 'RESTAURANT_MAQUIS',
  ADD COLUMN address text,
  ADD COLUMN city text,
  ADD COLUMN country text NOT NULL DEFAULT 'Burkina Faso',
  ADD COLUMN currency text NOT NULL DEFAULT 'XOF',
  ADD COLUMN timezone text NOT NULL DEFAULT 'Africa/Ouagadougou';

CREATE OR REPLACE FUNCTION public.normalize_slug(p_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_slug text;
BEGIN
  v_slug := lower(trim(p_input));
  v_slug := translate(
    v_slug,
    'àáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ',
    'aaaaaaaceeeeiiiinoooooouuuuyy'
  );
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '-+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  IF v_slug IS NULL OR v_slug = '' THEN
    RAISE EXCEPTION 'Slug invalide.';
  END IF;

  IF v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Slug invalide.';
  END IF;

  RETURN v_slug;
END;
$$;

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

  RETURN QUERY SELECT v_org_id, v_est_id;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_slug(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bootstrap_organization(
  text,
  text,
  text,
  text,
  public.establishment_type,
  text,
  text,
  text,
  text,
  text,
  text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.normalize_slug(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_organization(
  text,
  text,
  text,
  text,
  public.establishment_type,
  text,
  text,
  text,
  text,
  text,
  text
) TO authenticated;

REVOKE ALL ON TYPE public.establishment_type FROM anon;
GRANT USAGE ON TYPE public.establishment_type TO authenticated;
