-- Moteur catalogue quincaillerie : marques, attributs, unités de conditionnement.
-- Ne pas exécuter automatiquement.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand_id uuid,
  ADD COLUMN IF NOT EXISTS model_name text,
  ADD COLUMN IF NOT EXISTS internal_ref text,
  ADD COLUMN IF NOT EXISTS stock_unit_label text,
  ADD COLUMN IF NOT EXISTS fractionable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fraction_precision numeric;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS attribute_id uuid,
  ADD COLUMN IF NOT EXISTS attribute_value text,
  ADD COLUMN IF NOT EXISTS internal_ref text,
  ADD COLUMN IF NOT EXISTS minimum_stock integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.product_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT product_brands_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS product_brands_establishment_name_key
  ON public.product_brands (establishment_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS product_brands_establishment_id_idx
  ON public.product_brands (establishment_id);

CREATE TABLE IF NOT EXISTS public.product_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT product_attributes_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS product_attributes_establishment_name_key
  ON public.product_attributes (establishment_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS product_attributes_establishment_id_idx
  ON public.product_attributes (establishment_id);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_brand_id_fkey;
ALTER TABLE public.products
  ADD CONSTRAINT products_brand_id_fkey
  FOREIGN KEY (brand_id) REFERENCES public.product_brands (id) ON DELETE SET NULL;

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_attribute_id_fkey;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_attribute_id_fkey
  FOREIGN KEY (attribute_id) REFERENCES public.product_attributes (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.product_unit_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants (id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES public.product_unit_levels (id) ON DELETE RESTRICT,
  contains_qty numeric(18, 6) NOT NULL DEFAULT 1,
  is_base boolean NOT NULL DEFAULT false,
  purchasable boolean NOT NULL DEFAULT false,
  sellable boolean NOT NULL DEFAULT true,
  purchase_price integer,
  selling_price integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT product_unit_levels_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT product_unit_levels_qty_positive CHECK (contains_qty > 0),
  CONSTRAINT product_unit_levels_not_self CHECK (parent_id IS DISTINCT FROM id),
  CONSTRAINT product_unit_levels_prices_non_negative CHECK (
    (purchase_price IS NULL OR purchase_price >= 0)
    AND (selling_price IS NULL OR selling_price >= 0)
  )
);

CREATE INDEX IF NOT EXISTS product_unit_levels_product_id_idx
  ON public.product_unit_levels (product_id);
CREATE INDEX IF NOT EXISTS product_unit_levels_variant_id_idx
  ON public.product_unit_levels (variant_id);

DROP TRIGGER IF EXISTS product_brands_set_updated_at ON public.product_brands;
CREATE TRIGGER product_brands_set_updated_at
  BEFORE UPDATE ON public.product_brands
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS product_attributes_set_updated_at ON public.product_attributes;
CREATE TRIGGER product_attributes_set_updated_at
  BEFORE UPDATE ON public.product_attributes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS product_unit_levels_set_updated_at ON public.product_unit_levels;
CREATE TRIGGER product_unit_levels_set_updated_at
  BEFORE UPDATE ON public.product_unit_levels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.product_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_brands FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attributes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_unit_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_unit_levels FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_brands_select ON public.product_brands;
CREATE POLICY product_brands_select ON public.product_brands
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
DROP POLICY IF EXISTS product_brands_write ON public.product_brands;
CREATE POLICY product_brands_write ON public.product_brands
  FOR ALL TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS product_attributes_select ON public.product_attributes;
CREATE POLICY product_attributes_select ON public.product_attributes
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
DROP POLICY IF EXISTS product_attributes_write ON public.product_attributes;
CREATE POLICY product_attributes_write ON public.product_attributes
  FOR ALL TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS product_unit_levels_select ON public.product_unit_levels;
CREATE POLICY product_unit_levels_select ON public.product_unit_levels
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
DROP POLICY IF EXISTS product_unit_levels_write ON public.product_unit_levels;
CREATE POLICY product_unit_levels_write ON public.product_unit_levels
  FOR ALL TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_brands TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_attributes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_unit_levels TO authenticated;
