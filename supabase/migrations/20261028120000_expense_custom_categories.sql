-- Catégories de dépense créées par l'admin (en plus des catégories fixes).
-- Une dépense rattachée à une catégorie perso garde category = 'OTHER'
-- (compatibilité : rapports et anciens écrans la classent dans « Autres »).

CREATE TABLE IF NOT EXISTS public.expense_custom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS expense_custom_categories_unique_name
  ON public.expense_custom_categories (establishment_id, lower(btrim(name)));

ALTER TABLE public.expense_custom_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expense_custom_categories_select ON public.expense_custom_categories;
CREATE POLICY expense_custom_categories_select
  ON public.expense_custom_categories FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));

GRANT SELECT ON public.expense_custom_categories TO authenticated;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS custom_category_id uuid
    REFERENCES public.expense_custom_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expenses_custom_category_idx
  ON public.expenses (custom_category_id)
  WHERE custom_category_id IS NOT NULL;

-- Crée (ou retrouve, même nom sans tenir compte de la casse) une catégorie.
CREATE OR REPLACE FUNCTION public.create_expense_category(
  p_establishment_id uuid,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_name text := btrim(COALESCE(p_name, ''));
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT e.organization_id INTO v_org_id
  FROM public.establishments e
  WHERE e.id = p_establishment_id AND e.status = 'ACTIVE'::public.entity_status;

  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Établissement introuvable'; END IF;
  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_org_id) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;
  IF NOT public.user_belongs_to_establishment(v_user_id, p_establishment_id) THEN
    RAISE EXCEPTION 'Établissement non autorisé';
  END IF;
  IF char_length(v_name) < 2 OR char_length(v_name) > 60 THEN
    RAISE EXCEPTION 'Le nom de la catégorie doit faire entre 2 et 60 caractères';
  END IF;

  SELECT c.id INTO v_id
  FROM public.expense_custom_categories c
  WHERE c.establishment_id = p_establishment_id
    AND lower(btrim(c.name)) = lower(v_name);

  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.expense_custom_categories (organization_id, establishment_id, name, created_by)
  VALUES (v_org_id, p_establishment_id, v_name, v_user_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Supprime une catégorie : ses dépenses repassent dans « Autres » (FK SET NULL).
CREATE OR REPLACE FUNCTION public.delete_expense_category(p_category_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.expense_custom_categories%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT * INTO v_row FROM public.expense_custom_categories WHERE id = p_category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Catégorie introuvable'; END IF;
  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_row.organization_id) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;
  IF NOT public.user_belongs_to_establishment(v_user_id, v_row.establishment_id) THEN
    RAISE EXCEPTION 'Établissement non autorisé';
  END IF;

  DELETE FROM public.expense_custom_categories WHERE id = p_category_id;
END;
$$;

-- Rattache (ou détache avec NULL) une dépense à une catégorie perso du même établissement.
CREATE OR REPLACE FUNCTION public.set_expense_custom_category(
  p_expense_id uuid,
  p_category_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.expenses%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT * INTO v_row FROM public.expenses WHERE id = p_expense_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dépense introuvable'; END IF;
  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_row.organization_id) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;
  IF NOT public.user_belongs_to_establishment(v_user_id, v_row.establishment_id) THEN
    RAISE EXCEPTION 'Établissement non autorisé';
  END IF;
  IF v_row.status <> 'RECORDED'::public.expense_status THEN
    RAISE EXCEPTION 'Cette dépense est verrouillée';
  END IF;

  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.expense_custom_categories c
    WHERE c.id = p_category_id AND c.establishment_id = v_row.establishment_id
  ) THEN
    RAISE EXCEPTION 'Catégorie introuvable';
  END IF;

  UPDATE public.expenses SET
    custom_category_id = p_category_id,
    category = CASE WHEN p_category_id IS NULL THEN category ELSE 'OTHER'::public.expense_category END,
    updated_by = v_user_id
  WHERE id = p_expense_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_expense_category(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_expense_category(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_expense_custom_category(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_expense_category(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_expense_category(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_expense_custom_category(uuid, uuid) TO authenticated;
