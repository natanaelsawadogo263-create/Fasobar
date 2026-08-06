-- FasoBar: création produit fiable (contourne les faux négatifs RLS sur INSERT+RETURNING)
-- Ne pas exécuter automatiquement — appliquer via SQL Editor / supabase db push.

-- 1) SELECT catalogue pour les managers (par établissement), utile pour INSERT … RETURNING
DROP POLICY IF EXISTS products_select_manage ON public.products;
CREATE POLICY products_select_manage
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    public.user_can_manage_products((SELECT auth.uid()), establishment_id)
  );

-- 2) INSERT : ne plus exiger created_by/updated_by = auth.uid() dans la policy
--    (le contrôle métier reste dans l'app / la RPC ; évite les échecs JWT / trigger)
DROP POLICY IF EXISTS products_insert_manage ON public.products;
CREATE POLICY products_insert_manage
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_can_manage_products((SELECT auth.uid()), establishment_id)
  );

-- 3) UPDATE : aligner
DROP POLICY IF EXISTS products_update_manage ON public.products;
CREATE POLICY products_update_manage
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

-- 4) Audit logs : autoriser l'acteur manager de l'établissement (triggers SECURITY DEFINER)
DROP POLICY IF EXISTS audit_logs_insert_system ON public.audit_logs;
CREATE POLICY audit_logs_insert_system
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = (SELECT auth.uid())
    OR public.user_can_manage_products((SELECT auth.uid()), establishment_id)
  );

-- 5) RPC dédiée : création produit atomique et fiable
CREATE OR REPLACE FUNCTION public.create_establishment_product(
  p_establishment_id uuid,
  p_department_id uuid,
  p_category_id uuid,
  p_name text,
  p_slug text,
  p_selling_price numeric,
  p_unit public.product_unit,
  p_minimum_stock numeric DEFAULT 0,
  p_description text DEFAULT NULL,
  p_active boolean DEFAULT true,
  p_image_url text DEFAULT NULL,
  p_image_original_url text DEFAULT NULL,
  p_image_optimized_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF NOT public.user_can_manage_products(v_user_id, p_establishment_id) THEN
    RAISE EXCEPTION 'Permission insuffisante pour créer un produit';
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.establishments
  WHERE id = p_establishment_id
    AND status = 'ACTIVE'::public.entity_status;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Établissement introuvable';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Le nom du produit est obligatoire';
  END IF;

  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RAISE EXCEPTION 'Identifiant produit invalide';
  END IF;

  IF p_selling_price IS NULL OR p_selling_price < 0 THEN
    RAISE EXCEPTION 'Prix de vente invalide';
  END IF;

  INSERT INTO public.products (
    organization_id,
    establishment_id,
    department_id,
    category_id,
    name,
    slug,
    description,
    selling_price,
    unit,
    minimum_stock,
    active,
    image_url,
    image_original_url,
    image_optimized_url,
    created_by,
    updated_by
  ) VALUES (
    v_org_id,
    p_establishment_id,
    p_department_id,
    p_category_id,
    btrim(p_name),
    btrim(p_slug),
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    p_selling_price,
    p_unit,
    COALESCE(p_minimum_stock, 0),
    COALESCE(p_active, true),
    NULLIF(btrim(COALESCE(p_image_url, '')), ''),
    NULLIF(btrim(COALESCE(p_image_original_url, '')), ''),
    NULLIF(btrim(COALESCE(p_image_optimized_url, '')), ''),
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_establishment_product(
  uuid, uuid, uuid, text, text, numeric, public.product_unit, numeric, text, boolean, text, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_establishment_product(
  uuid, uuid, uuid, text, text, numeric, public.product_unit, numeric, text, boolean, text, text, text
) TO authenticated;
