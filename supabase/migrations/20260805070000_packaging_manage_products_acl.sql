-- Autoriser les managers produits (OWNER/ADMIN/MANAGER) à gérer les conditionnements.
-- Avant : owner/admin org seulement → l'enregistrement du packaging faisait échouer la création.

CREATE OR REPLACE FUNCTION public.upsert_product_packaging(
  p_product_id uuid,
  p_name text,
  p_packaging_unit public.product_unit,
  p_conversion_factor numeric,
  p_packaging_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_product public.products%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;

  IF NOT public.user_can_manage_products(v_user_id, v_product.establishment_id) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Le nom du conditionnement est obligatoire';
  END IF;
  IF p_conversion_factor IS NULL OR p_conversion_factor <= 0 THEN
    RAISE EXCEPTION 'Le coefficient doit être strictement positif';
  END IF;

  IF p_packaging_id IS NULL THEN
    INSERT INTO public.product_packagings (
      organization_id, establishment_id, product_id, name, packaging_unit, base_unit,
      conversion_factor, created_by, updated_by
    ) VALUES (
      v_product.organization_id, v_product.establishment_id, p_product_id, btrim(p_name),
      p_packaging_unit, v_product.unit, p_conversion_factor, v_user_id, v_user_id
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.product_packagings SET
      name = btrim(p_name),
      packaging_unit = p_packaging_unit,
      base_unit = v_product.unit,
      conversion_factor = p_conversion_factor,
      updated_by = v_user_id,
      active = true
    WHERE id = p_packaging_id AND product_id = p_product_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN RAISE EXCEPTION 'Conditionnement introuvable'; END IF;
  END IF;

  PERFORM public.write_admin_audit_log(
    v_product.organization_id, v_product.establishment_id, 'product_packaging', v_id,
    'PACKAGING_UPSERTED'::public.audit_action, v_user_id,
    jsonb_build_object('product_id', p_product_id, 'name', btrim(p_name), 'factor', p_conversion_factor)
  );

  RETURN v_id;
END;
$$;

DROP POLICY IF EXISTS product_packagings_select ON public.product_packagings;
DROP POLICY IF EXISTS product_packagings_insert ON public.product_packagings;
DROP POLICY IF EXISTS product_packagings_update ON public.product_packagings;
DROP POLICY IF EXISTS product_packagings_delete ON public.product_packagings;
DROP POLICY IF EXISTS product_packagings_select_authorized ON public.product_packagings;
DROP POLICY IF EXISTS product_packagings_insert_manage ON public.product_packagings;
DROP POLICY IF EXISTS product_packagings_update_manage ON public.product_packagings;
DROP POLICY IF EXISTS product_packagings_delete_manage ON public.product_packagings;

CREATE POLICY product_packagings_select
  ON public.product_packagings
  FOR SELECT
  TO authenticated
  USING (
    public.user_can_manage_products((SELECT auth.uid()), establishment_id)
    OR public.user_can_manage_stock(
      (SELECT auth.uid()),
      establishment_id,
      'BAR'::public.department_code
    )
    OR public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id)
  );

CREATE POLICY product_packagings_insert
  ON public.product_packagings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

CREATE POLICY product_packagings_update
  ON public.product_packagings
  FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

CREATE POLICY product_packagings_delete
  ON public.product_packagings
  FOR DELETE
  TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id));
