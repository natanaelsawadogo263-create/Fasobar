-- Autoriser les managers produits (admin) à initialiser le catalogue caisse.
-- Ne pas exécuter automatiquement — appliquer via supabase db push ou SQL Editor.

CREATE OR REPLACE FUNCTION public.ensure_caisse_catalog(p_establishment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_bar_id uuid;
  v_kitchen_id uuid;
  v_category_id uuid;
  rec record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF NOT (
    public.user_can_manage_products(v_user_id, p_establishment_id)
    OR public.user_can_manage_orders(v_user_id, p_establishment_id)
  ) THEN
    RAISE EXCEPTION 'Permission insuffisante pour initialiser le catalogue caisse';
  END IF;

  SELECT organization_id
  INTO v_org_id
  FROM public.establishments
  WHERE id = p_establishment_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Établissement introuvable';
  END IF;

  PERFORM public.seed_establishment_departments(v_org_id, p_establishment_id);

  SELECT id INTO v_bar_id
  FROM public.departments
  WHERE establishment_id = p_establishment_id
    AND code = 'BAR'::public.department_code;

  SELECT id INTO v_kitchen_id
  FROM public.departments
  WHERE establishment_id = p_establishment_id
    AND code = 'KITCHEN'::public.department_code;

  IF v_bar_id IS NULL OR v_kitchen_id IS NULL THEN
    RAISE EXCEPTION 'Départements BAR/KITCHEN introuvables';
  END IF;

  FOR rec IN
    SELECT *
    FROM (
      VALUES
        ('Bières', 'bieres', 'BAR'::public.department_code),
        ('Sodas', 'sodas', 'BAR'::public.department_code),
        ('Eaux', 'eaux', 'BAR'::public.department_code),
        ('Spiritueux', 'spiritueux', 'BAR'::public.department_code),
        ('Jus & Boissons', 'jus-boissons', 'BAR'::public.department_code),
        ('Plats', 'plats', 'KITCHEN'::public.department_code),
        ('Accompagnements', 'accompagnements', 'KITCHEN'::public.department_code),
        ('Desserts', 'desserts', 'KITCHEN'::public.department_code)
    ) AS t(name, slug, dept_code)
  LOOP
    INSERT INTO public.categories (
      organization_id,
      establishment_id,
      department_id,
      name,
      slug,
      active
    )
    VALUES (
      v_org_id,
      p_establishment_id,
      CASE rec.dept_code
        WHEN 'BAR'::public.department_code THEN v_bar_id
        ELSE v_kitchen_id
      END,
      rec.name,
      rec.slug,
      true
    )
    ON CONFLICT (establishment_id, slug) DO UPDATE
      SET name = EXCLUDED.name,
          active = true,
          updated_at = now();
  END LOOP;

  FOR rec IN
    SELECT *
    FROM (
      VALUES
        ('BRAKINA', 'brakina', 'BAR'::public.department_code, 'Bières', 500, 'BOTTLE'::public.product_unit),
        ('CASTEL', 'castel', 'BAR'::public.department_code, 'Bières', 600, 'BOTTLE'::public.product_unit),
        ('GUINNESS', 'guinness', 'BAR'::public.department_code, 'Bières', 1000, 'BOTTLE'::public.product_unit),
        ('HEINEKEN', 'heineken', 'BAR'::public.department_code, 'Bières', 1000, 'BOTTLE'::public.product_unit),
        ('COCA-COLA', 'coca-cola', 'BAR'::public.department_code, 'Sodas', 500, 'BOTTLE'::public.product_unit),
        ('FANTA ORANGE', 'fanta-orange', 'BAR'::public.department_code, 'Sodas', 500, 'BOTTLE'::public.product_unit),
        ('EAU MINÉRALE 50cl', 'eau-minerale-50cl', 'BAR'::public.department_code, 'Eaux', 300, 'BOTTLE'::public.product_unit),
        ('POULET BRAISÉ', 'poulet-braise', 'KITCHEN'::public.department_code, 'Plats', 2000, 'PORTION'::public.product_unit),
        ('RIZ SAUCE', 'riz-sauce', 'KITCHEN'::public.department_code, 'Plats', 1500, 'PORTION'::public.product_unit),
        ('ATTIÉKÉ POISSON', 'attieke-poisson', 'KITCHEN'::public.department_code, 'Plats', 2000, 'PORTION'::public.product_unit),
        ('HARICOTS SAUCE', 'haricots-sauce', 'KITCHEN'::public.department_code, 'Plats', 1200, 'PORTION'::public.product_unit),
        ('SUCRERIE', 'sucrerie', 'KITCHEN'::public.department_code, 'Accompagnements', 200, 'PORTION'::public.product_unit),
        ('FLAG', 'flag', 'BAR'::public.department_code, 'Bières', 500, 'BOTTLE'::public.product_unit),
        ('SPRITE', 'sprite', 'BAR'::public.department_code, 'Sodas', 500, 'BOTTLE'::public.product_unit),
        ('EVIAN 50cl', 'evian-50cl', 'BAR'::public.department_code, 'Eaux', 400, 'BOTTLE'::public.product_unit),
        ('RHUM BLANC', 'rhum-blanc', 'BAR'::public.department_code, 'Spiritueux', 1500, 'BOTTLE'::public.product_unit),
        ('VODKA', 'vodka', 'BAR'::public.department_code, 'Spiritueux', 2000, 'BOTTLE'::public.product_unit),
        ('JUS D''ORANGE', 'jus-orange', 'BAR'::public.department_code, 'Jus & Boissons', 700, 'BOTTLE'::public.product_unit),
        ('JUS DE BISSAP', 'jus-bissap', 'BAR'::public.department_code, 'Jus & Boissons', 600, 'BOTTLE'::public.product_unit),
        ('BROCHETTE DE BŒUF', 'brochette-boeuf', 'KITCHEN'::public.department_code, 'Plats', 2500, 'PORTION'::public.product_unit),
        ('FRITURE DE POISSON', 'friture-poisson', 'KITCHEN'::public.department_code, 'Plats', 2200, 'PORTION'::public.product_unit),
        ('FRITE', 'frite', 'KITCHEN'::public.department_code, 'Accompagnements', 500, 'PORTION'::public.product_unit),
        ('TIRAMISU', 'tiramisu', 'KITCHEN'::public.department_code, 'Desserts', 800, 'PORTION'::public.product_unit)
    ) AS t(name, slug, dept_code, category_name, selling_price, unit)
  LOOP
    SELECT c.id
    INTO v_category_id
    FROM public.categories c
    WHERE c.establishment_id = p_establishment_id
      AND c.name = rec.category_name
    LIMIT 1;

    IF v_category_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.products (
      organization_id,
      establishment_id,
      department_id,
      category_id,
      name,
      slug,
      selling_price,
      unit,
      minimum_stock,
      active,
      created_by,
      updated_by
    )
    VALUES (
      v_org_id,
      p_establishment_id,
      CASE rec.dept_code
        WHEN 'BAR'::public.department_code THEN v_bar_id
        ELSE v_kitchen_id
      END,
      v_category_id,
      rec.name,
      rec.slug,
      rec.selling_price,
      rec.unit,
      0,
      true,
      v_user_id,
      v_user_id
    )
    ON CONFLICT (establishment_id, slug) DO UPDATE
      SET name = EXCLUDED.name,
          category_id = EXCLUDED.category_id,
          department_id = EXCLUDED.department_id,
          selling_price = EXCLUDED.selling_price,
          unit = EXCLUDED.unit,
          active = true,
          updated_by = v_user_id,
          updated_at = now();
  END LOOP;
END;
$$;
