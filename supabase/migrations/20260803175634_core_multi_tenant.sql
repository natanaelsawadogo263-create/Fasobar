-- FasoBar core multi-tenant schema
-- RLS enabled on all tables; default deny when no policy matches.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

CREATE TYPE public.entity_status AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE public.membership_role AS ENUM (
  'OWNER',
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'BAR_MANAGER',
  'KITCHEN_MANAGER',
  'STOCK_AGENT'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT organizations_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX organizations_slug_key ON public.organizations (slug);
CREATE INDEX organizations_status_idx ON public.organizations (status);

CREATE TABLE public.establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT establishments_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT establishments_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT establishments_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX establishments_organization_slug_key
  ON public.establishments (organization_id, slug);
CREATE INDEX establishments_organization_id_idx ON public.establishments (organization_id);
CREATE INDEX establishments_status_idx ON public.establishments (status);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_status_idx ON public.profiles (status);

CREATE TABLE public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role public.membership_role NOT NULL,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_memberships_unique_member UNIQUE (organization_id, user_id)
);

CREATE UNIQUE INDEX organization_memberships_one_active_owner_key
  ON public.organization_memberships (organization_id)
  WHERE role = 'OWNER' AND status = 'ACTIVE';

CREATE INDEX organization_memberships_organization_id_idx
  ON public.organization_memberships (organization_id);
CREATE INDEX organization_memberships_user_id_idx
  ON public.organization_memberships (user_id);
CREATE INDEX organization_memberships_role_idx
  ON public.organization_memberships (role);
CREATE INDEX organization_memberships_status_idx
  ON public.organization_memberships (status);

CREATE TABLE public.establishment_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role public.membership_role NOT NULL,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT establishment_memberships_unique_member UNIQUE (establishment_id, user_id)
);

CREATE INDEX establishment_memberships_establishment_id_idx
  ON public.establishment_memberships (establishment_id);
CREATE INDEX establishment_memberships_user_id_idx
  ON public.establishment_memberships (user_id);
CREATE INDEX establishment_memberships_role_idx
  ON public.establishment_memberships (role);
CREATE INDEX establishment_memberships_status_idx
  ON public.establishment_memberships (status);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER establishments_set_updated_at
  BEFORE UPDATE ON public.establishments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER organization_memberships_set_updated_at
  BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER establishment_memberships_set_updated_at
  BEFORE UPDATE ON public.establishment_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile on auth.users insert
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', NEW.email),
    'ACTIVE'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER, explicit search_path)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    INNER JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = p_user_id
      AND om.organization_id = p_organization_id
      AND om.status = 'ACTIVE'::public.entity_status
      AND o.status = 'ACTIVE'::public.entity_status
  );
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_establishment(
  p_user_id uuid,
  p_establishment_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.establishment_memberships em
    INNER JOIN public.establishments e ON e.id = em.establishment_id
    INNER JOIN public.organizations o ON o.id = e.organization_id
    WHERE em.user_id = p_user_id
      AND em.establishment_id = p_establishment_id
      AND em.status = 'ACTIVE'::public.entity_status
      AND e.status = 'ACTIVE'::public.entity_status
      AND o.status = 'ACTIVE'::public.entity_status
  )
  OR EXISTS (
    SELECT 1
    FROM public.establishments e
    INNER JOIN public.organization_memberships om ON om.organization_id = e.organization_id
    INNER JOIN public.organizations o ON o.id = e.organization_id
    WHERE e.id = p_establishment_id
      AND om.user_id = p_user_id
      AND om.role IN (
        'OWNER'::public.membership_role,
        'ADMIN'::public.membership_role
      )
      AND om.status = 'ACTIVE'::public.entity_status
      AND e.status = 'ACTIVE'::public.entity_status
      AND o.status = 'ACTIVE'::public.entity_status
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_organization_role(
  p_user_id uuid,
  p_organization_id uuid,
  p_role public.membership_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    INNER JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = p_user_id
      AND om.organization_id = p_organization_id
      AND om.role = p_role
      AND om.status = 'ACTIVE'::public.entity_status
      AND o.status = 'ACTIVE'::public.entity_status
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_establishment_role(
  p_user_id uuid,
  p_establishment_id uuid,
  p_role public.membership_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.establishment_memberships em
    INNER JOIN public.establishments e ON e.id = em.establishment_id
    INNER JOIN public.organizations o ON o.id = e.organization_id
    WHERE em.user_id = p_user_id
      AND em.establishment_id = p_establishment_id
      AND em.role = p_role
      AND em.status = 'ACTIVE'::public.entity_status
      AND e.status = 'ACTIVE'::public.entity_status
      AND o.status = 'ACTIVE'::public.entity_status
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_organization_owner_or_admin(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    INNER JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = p_user_id
      AND om.organization_id = p_organization_id
      AND om.role IN (
        'OWNER'::public.membership_role,
        'ADMIN'::public.membership_role
      )
      AND om.status = 'ACTIVE'::public.entity_status
      AND o.status = 'ACTIVE'::public.entity_status
  );
$$;

CREATE OR REPLACE FUNCTION public.establishment_organization_id(
  p_establishment_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT e.organization_id
  FROM public.establishments e
  WHERE e.id = p_establishment_id
    AND e.status = 'ACTIVE'::public.entity_status
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishment_memberships ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.establishments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.establishment_memberships FORCE ROW LEVEL SECURITY;

-- organizations

CREATE POLICY organizations_select_member
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    public.user_belongs_to_organization((SELECT auth.uid()), id)
  );

CREATE POLICY organizations_insert_authenticated
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY organizations_update_owner_admin
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    public.user_is_organization_owner_or_admin((SELECT auth.uid()), id)
  )
  WITH CHECK (
    public.user_is_organization_owner_or_admin((SELECT auth.uid()), id)
  );

CREATE POLICY organizations_delete_owner_admin
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (
    public.user_is_organization_owner_or_admin((SELECT auth.uid()), id)
  );

-- establishments

CREATE POLICY establishments_select_authorized
  ON public.establishments
  FOR SELECT
  TO authenticated
  USING (
    public.user_belongs_to_establishment((SELECT auth.uid()), id)
  );

CREATE POLICY establishments_insert_owner_admin
  ON public.establishments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
  );

CREATE POLICY establishments_update_owner_admin
  ON public.establishments
  FOR UPDATE
  TO authenticated
  USING (
    public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
  )
  WITH CHECK (
    public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
  );

CREATE POLICY establishments_delete_owner_admin
  ON public.establishments
  FOR DELETE
  TO authenticated
  USING (
    public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
  );

-- profiles

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- profiles are created by trigger; no direct INSERT/DELETE for authenticated users

-- organization_memberships

CREATE POLICY organization_memberships_select_member
  ON public.organization_memberships
  FOR SELECT
  TO authenticated
  USING (
    public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  );

CREATE POLICY organization_memberships_insert_owner_admin
  ON public.organization_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
  );

CREATE POLICY organization_memberships_insert_bootstrap_owner
  ON public.organization_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND role = 'OWNER'::public.membership_role
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.organization_id = organization_memberships.organization_id
        AND om.role = 'OWNER'::public.membership_role
        AND om.status = 'ACTIVE'::public.entity_status
    )
  );

CREATE POLICY organization_memberships_update_owner_admin
  ON public.organization_memberships
  FOR UPDATE
  TO authenticated
  USING (
    public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
  )
  WITH CHECK (
    public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
  );

CREATE POLICY organization_memberships_delete_owner_admin
  ON public.organization_memberships
  FOR DELETE
  TO authenticated
  USING (
    public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
  );

-- establishment_memberships

CREATE POLICY establishment_memberships_select_authorized
  ON public.establishment_memberships
  FOR SELECT
  TO authenticated
  USING (
    public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id)
  );

CREATE POLICY establishment_memberships_insert_owner_admin
  ON public.establishment_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_organization_owner_or_admin(
      (SELECT auth.uid()),
      public.establishment_organization_id(establishment_id)
    )
  );

CREATE POLICY establishment_memberships_update_owner_admin
  ON public.establishment_memberships
  FOR UPDATE
  TO authenticated
  USING (
    public.user_is_organization_owner_or_admin(
      (SELECT auth.uid()),
      public.establishment_organization_id(establishment_id)
    )
  )
  WITH CHECK (
    public.user_is_organization_owner_or_admin(
      (SELECT auth.uid()),
      public.establishment_organization_id(establishment_id)
    )
  );

CREATE POLICY establishment_memberships_delete_owner_admin
  ON public.establishment_memberships
  FOR DELETE
  TO authenticated
  USING (
    public.user_is_organization_owner_or_admin(
      (SELECT auth.uid()),
      public.establishment_organization_id(establishment_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Privileges: authenticated only; never grant admin rights to anon
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.organizations FROM anon;
REVOKE ALL ON TABLE public.establishments FROM anon;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.organization_memberships FROM anon;
REVOKE ALL ON TABLE public.establishment_memberships FROM anon;

REVOKE ALL ON TYPE public.entity_status FROM anon;
REVOKE ALL ON TYPE public.membership_role FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.establishments TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.establishment_memberships TO authenticated;

GRANT USAGE ON TYPE public.entity_status TO authenticated;
GRANT USAGE ON TYPE public.membership_role TO authenticated;

REVOKE ALL ON FUNCTION public.user_belongs_to_organization(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_belongs_to_establishment(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_organization_role(uuid, uuid, public.membership_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_establishment_role(uuid, uuid, public.membership_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_is_organization_owner_or_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.establishment_organization_id(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.user_belongs_to_organization(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_establishment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_organization_role(uuid, uuid, public.membership_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_establishment_role(uuid, uuid, public.membership_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_organization_owner_or_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.establishment_organization_id(uuid) TO authenticated;
