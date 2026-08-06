-- FasoBar: catalog (departments, categories, products) and audit logs

CREATE TYPE public.department_code AS ENUM ('BAR', 'KITCHEN');

CREATE TYPE public.product_unit AS ENUM (
  'BOTTLE',
  'CAN',
  'PORTION',
  'PIECE',
  'KG',
  'LITER',
  'PACK',
  'CASE'
);

CREATE TYPE public.audit_action AS ENUM (
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_PRICE_UPDATED',
  'PRODUCT_ACTIVATED',
  'PRODUCT_DEACTIVATED'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  code public.department_code NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT departments_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX departments_establishment_code_key
  ON public.departments (establishment_id, code);
CREATE INDEX departments_organization_id_idx ON public.departments (organization_id);
CREATE INDEX departments_establishment_id_idx ON public.departments (establishment_id);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT categories_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT categories_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX categories_establishment_slug_key
  ON public.categories (establishment_id, slug);
CREATE INDEX categories_organization_id_idx ON public.categories (organization_id);
CREATE INDEX categories_establishment_id_idx ON public.categories (establishment_id);
CREATE INDEX categories_department_id_idx ON public.categories (department_id);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE RESTRICT,
  category_id uuid NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  selling_price integer NOT NULL,
  unit public.product_unit NOT NULL,
  minimum_stock integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT products_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT products_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT products_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT products_selling_price_non_negative CHECK (selling_price >= 0),
  CONSTRAINT products_minimum_stock_non_negative CHECK (minimum_stock >= 0)
);

CREATE UNIQUE INDEX products_establishment_slug_key
  ON public.products (establishment_id, slug);
CREATE INDEX products_organization_id_idx ON public.products (organization_id);
CREATE INDEX products_establishment_id_idx ON public.products (establishment_id);
CREATE INDEX products_department_id_idx ON public.products (department_id);
CREATE INDEX products_category_id_idx ON public.products (category_id);
CREATE INDEX products_active_idx ON public.products (active);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action public.audit_action NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_entity_type_not_blank CHECK (btrim(entity_type) <> '')
);

CREATE INDEX audit_logs_organization_id_idx ON public.audit_logs (organization_id);
CREATE INDEX audit_logs_establishment_id_idx ON public.audit_logs (establishment_id);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at);

-- ---------------------------------------------------------------------------
-- Referential integrity helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_category_belongs_to_establishment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.categories c
    WHERE c.id = NEW.category_id
      AND c.establishment_id = NEW.establishment_id
      AND c.organization_id = NEW.organization_id
      AND c.department_id = NEW.department_id
  ) THEN
    RAISE EXCEPTION 'La catégorie doit appartenir au même établissement et département.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER products_validate_category
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_category_belongs_to_establishment();

CREATE TRIGGER departments_set_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed BAR / KITCHEN departments
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_establishment_departments(
  p_organization_id uuid,
  p_establishment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bar_id uuid;
  v_kitchen_id uuid;
BEGIN
  INSERT INTO public.departments (organization_id, establishment_id, code, name, active)
  VALUES
    (p_organization_id, p_establishment_id, 'BAR'::public.department_code, 'Boissons', true),
    (p_organization_id, p_establishment_id, 'KITCHEN'::public.department_code, 'Nourriture', true)
  ON CONFLICT (establishment_id, code) DO NOTHING;

  SELECT id INTO v_bar_id
  FROM public.departments
  WHERE establishment_id = p_establishment_id
    AND code = 'BAR'::public.department_code;

  SELECT id INTO v_kitchen_id
  FROM public.departments
  WHERE establishment_id = p_establishment_id
    AND code = 'KITCHEN'::public.department_code;

  IF v_bar_id IS NOT NULL THEN
    INSERT INTO public.categories (organization_id, establishment_id, department_id, name, slug, active)
    VALUES (p_organization_id, p_establishment_id, v_bar_id, 'Boissons', 'boissons', true)
    ON CONFLICT (establishment_id, slug) DO NOTHING;
  END IF;

  IF v_kitchen_id IS NOT NULL THEN
    INSERT INTO public.categories (organization_id, establishment_id, department_id, name, slug, active)
    VALUES (p_organization_id, p_establishment_id, v_kitchen_id, 'Plats', 'plats', true)
    ON CONFLICT (establishment_id, slug) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_establishment_departments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.seed_establishment_departments(NEW.organization_id, NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_establishment_created_seed_departments
  AFTER INSERT ON public.establishments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_establishment_departments();

INSERT INTO public.departments (organization_id, establishment_id, code, name, active)
SELECT
  e.organization_id,
  e.id,
  seed.code,
  seed.name,
  true
FROM public.establishments e
CROSS JOIN (
  VALUES
    ('BAR'::public.department_code, 'Boissons'),
    ('KITCHEN'::public.department_code, 'Nourriture')
) AS seed(code, name)
ON CONFLICT (establishment_id, code) DO NOTHING;

INSERT INTO public.categories (organization_id, establishment_id, department_id, name, slug, active)
SELECT
  d.organization_id,
  d.establishment_id,
  d.id,
  CASE d.code
    WHEN 'BAR'::public.department_code THEN 'Boissons'
    ELSE 'Plats'
  END,
  CASE d.code
    WHEN 'BAR'::public.department_code THEN 'boissons'
    ELSE 'plats'
  END,
  true
FROM public.departments d
ON CONFLICT (establishment_id, slug) DO NOTHING;

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

  PERFORM public.seed_establishment_departments(v_org_id, v_est_id);

  RETURN QUERY SELECT v_org_id, v_est_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Product audit logging
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.write_product_audit_log(
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
    'product',
    p_entity_id,
    p_action,
    p_actor_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_product_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := COALESCE(NEW.updated_by, NEW.created_by, auth.uid());

  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_product_audit_log(
      NEW.organization_id,
      NEW.establishment_id,
      NEW.id,
      'PRODUCT_CREATED'::public.audit_action,
      v_actor,
      jsonb_build_object(
        'name', NEW.name,
        'selling_price', NEW.selling_price,
        'active', NEW.active
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.selling_price IS DISTINCT FROM NEW.selling_price THEN
      PERFORM public.write_product_audit_log(
        NEW.organization_id,
        NEW.establishment_id,
        NEW.id,
        'PRODUCT_PRICE_UPDATED'::public.audit_action,
        v_actor,
        jsonb_build_object(
          'previous_price', OLD.selling_price,
          'new_price', NEW.selling_price
        )
      );
    END IF;

    IF OLD.active IS DISTINCT FROM NEW.active THEN
      PERFORM public.write_product_audit_log(
        NEW.organization_id,
        NEW.establishment_id,
        NEW.id,
        CASE
          WHEN NEW.active THEN 'PRODUCT_ACTIVATED'::public.audit_action
          ELSE 'PRODUCT_DEACTIVATED'::public.audit_action
        END,
        v_actor,
        jsonb_build_object('active', NEW.active)
      );
    END IF;

    IF OLD.name IS DISTINCT FROM NEW.name
      OR OLD.description IS DISTINCT FROM NEW.description
      OR OLD.unit IS DISTINCT FROM NEW.unit
      OR OLD.minimum_stock IS DISTINCT FROM NEW.minimum_stock
      OR OLD.category_id IS DISTINCT FROM NEW.category_id
      OR OLD.department_id IS DISTINCT FROM NEW.department_id THEN
      PERFORM public.write_product_audit_log(
        NEW.organization_id,
        NEW.establishment_id,
        NEW.id,
        'PRODUCT_UPDATED'::public.audit_action,
        v_actor,
        jsonb_build_object(
          'name', NEW.name,
          'unit', NEW.unit,
          'minimum_stock', NEW.minimum_stock
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER products_audit_changes
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_product_changes();

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_manage_products(
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
    FROM public.establishments e
    INNER JOIN public.organizations o ON o.id = e.organization_id
    INNER JOIN public.organization_memberships om ON om.organization_id = e.organization_id
    WHERE e.id = p_establishment_id
      AND om.user_id = p_user_id
      AND om.role IN (
        'OWNER'::public.membership_role,
        'ADMIN'::public.membership_role,
        'MANAGER'::public.membership_role
      )
      AND om.status = 'ACTIVE'::public.entity_status
      AND e.status = 'ACTIVE'::public.entity_status
      AND o.status = 'ACTIVE'::public.entity_status
  )
  OR EXISTS (
    SELECT 1
    FROM public.establishment_memberships em
    INNER JOIN public.establishments e ON e.id = em.establishment_id
    INNER JOIN public.organizations o ON o.id = e.organization_id
    WHERE em.establishment_id = p_establishment_id
      AND em.user_id = p_user_id
      AND em.role IN (
        'OWNER'::public.membership_role,
        'ADMIN'::public.membership_role,
        'MANAGER'::public.membership_role
      )
      AND em.status = 'ACTIVE'::public.entity_status
      AND e.status = 'ACTIVE'::public.entity_status
      AND o.status = 'ACTIVE'::public.entity_status
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_read_product(
  p_user_id uuid,
  p_product_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    INNER JOIN public.departments d ON d.id = p.department_id
    WHERE p.id = p_product_id
      AND (
        public.user_can_manage_products(p_user_id, p.establishment_id)
        OR (
          p.active = true
          AND public.user_belongs_to_establishment(p_user_id, p.establishment_id)
          AND (
            EXISTS (
              SELECT 1
              FROM public.establishment_memberships em
              WHERE em.establishment_id = p.establishment_id
                AND em.user_id = p_user_id
                AND em.role = 'CASHIER'::public.membership_role
                AND em.status = 'ACTIVE'::public.entity_status
            )
            OR EXISTS (
              SELECT 1
              FROM public.establishment_memberships em
              WHERE em.establishment_id = p.establishment_id
                AND em.user_id = p_user_id
                AND em.role = 'BAR_MANAGER'::public.membership_role
                AND em.status = 'ACTIVE'::public.entity_status
                AND d.code = 'BAR'::public.department_code
            )
            OR EXISTS (
              SELECT 1
              FROM public.establishment_memberships em
              WHERE em.establishment_id = p.establishment_id
                AND em.user_id = p_user_id
                AND em.role = 'KITCHEN_MANAGER'::public.membership_role
                AND em.status = 'ACTIVE'::public.entity_status
                AND d.code = 'KITCHEN'::public.department_code
            )
            OR EXISTS (
              SELECT 1
              FROM public.organization_memberships om
              WHERE om.organization_id = p.organization_id
                AND om.user_id = p_user_id
                AND om.role = 'CASHIER'::public.membership_role
                AND om.status = 'ACTIVE'::public.entity_status
            )
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_read_department(
  p_user_id uuid,
  p_department_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.departments d
    WHERE d.id = p_department_id
      AND (
        public.user_can_manage_products(p_user_id, d.establishment_id)
        OR public.user_belongs_to_establishment(p_user_id, d.establishment_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_read_category(
  p_user_id uuid,
  p_category_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.categories c
    WHERE c.id = p_category_id
      AND (
        public.user_can_manage_products(p_user_id, c.establishment_id)
        OR public.user_belongs_to_establishment(p_user_id, c.establishment_id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.departments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY departments_select_authorized
  ON public.departments
  FOR SELECT
  TO authenticated
  USING (public.user_can_read_department((SELECT auth.uid()), id));

CREATE POLICY departments_manage_products
  ON public.departments
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

CREATE POLICY categories_select_authorized
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (public.user_can_read_category((SELECT auth.uid()), id));

CREATE POLICY categories_insert_manage
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

CREATE POLICY categories_update_manage
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

CREATE POLICY categories_delete_manage
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

CREATE POLICY products_select_authorized
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.user_can_read_product((SELECT auth.uid()), id));

CREATE POLICY products_insert_manage
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_can_manage_products((SELECT auth.uid()), establishment_id)
    AND created_by = (SELECT auth.uid())
    AND updated_by = (SELECT auth.uid())
  );

CREATE POLICY products_update_manage
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id))
  WITH CHECK (
    public.user_can_manage_products((SELECT auth.uid()), establishment_id)
    AND updated_by = (SELECT auth.uid())
  );

CREATE POLICY products_delete_manage
  ON public.products
  FOR DELETE
  TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

CREATE POLICY audit_logs_select_manage
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

CREATE POLICY audit_logs_insert_system
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.departments FROM anon;
REVOKE ALL ON TABLE public.categories FROM anon;
REVOKE ALL ON TABLE public.products FROM anon;
REVOKE ALL ON TABLE public.audit_logs FROM anon;

REVOKE ALL ON TYPE public.department_code FROM anon;
REVOKE ALL ON TYPE public.product_unit FROM anon;
REVOKE ALL ON TYPE public.audit_action FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;

GRANT USAGE ON TYPE public.department_code TO authenticated;
GRANT USAGE ON TYPE public.product_unit TO authenticated;
GRANT USAGE ON TYPE public.audit_action TO authenticated;

REVOKE ALL ON FUNCTION public.seed_establishment_departments(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.write_product_audit_log(uuid, uuid, uuid, public.audit_action, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_manage_products(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_read_product(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_read_department(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_read_category(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.user_can_manage_products(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_read_product(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_read_department(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_read_category(uuid, uuid) TO authenticated;
