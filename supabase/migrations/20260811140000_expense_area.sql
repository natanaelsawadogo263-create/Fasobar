-- Rattachement des dépenses : Caisse ou Bar
-- Appliquer manuellement via supabase db push ou SQL Editor.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_area') THEN
    CREATE TYPE public.expense_area AS ENUM ('CAISSE', 'BAR');
  END IF;
END
$$;

GRANT USAGE ON TYPE public.expense_area TO authenticated;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS area public.expense_area NOT NULL DEFAULT 'CAISSE';

COMMENT ON COLUMN public.expenses.area IS
  'Service rattaché : CAISSE (caisse) ou BAR (responsable bar).';

-- Remplace record_expense / update_expense avec p_area
DROP FUNCTION IF EXISTS public.record_expense(uuid, public.expense_category, text, integer, text, date, text, text);
DROP FUNCTION IF EXISTS public.update_expense(uuid, public.expense_category, text, integer, text, date, text, text);

CREATE OR REPLACE FUNCTION public.record_expense(
  p_establishment_id uuid,
  p_category public.expense_category,
  p_label text,
  p_amount integer,
  p_supplier_name text DEFAULT NULL,
  p_expense_date date DEFAULT CURRENT_DATE,
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_area public.expense_area DEFAULT 'CAISSE'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_expense_id uuid;
  v_area public.expense_area := COALESCE(p_area, 'CAISSE'::public.expense_area);
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
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Le montant doit être strictement positif'; END IF;
  IF p_label IS NULL OR btrim(p_label) = '' THEN RAISE EXCEPTION 'Le libellé est obligatoire'; END IF;

  INSERT INTO public.expenses (
    organization_id, establishment_id, category, area, label, amount, supplier_name,
    expense_date, reference, note, created_by, updated_by
  ) VALUES (
    v_org_id, p_establishment_id, p_category, v_area, btrim(p_label), p_amount,
    NULLIF(btrim(COALESCE(p_supplier_name, '')), ''),
    COALESCE(p_expense_date, CURRENT_DATE),
    NULLIF(btrim(COALESCE(p_reference, '')), ''),
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    v_user_id, v_user_id
  ) RETURNING id INTO v_expense_id;

  PERFORM public.write_admin_audit_log(
    v_org_id, p_establishment_id, 'expense', v_expense_id,
    'EXPENSE_CREATED'::public.audit_action, v_user_id,
    jsonb_build_object(
      'category', p_category,
      'area', v_area,
      'amount', p_amount,
      'label', btrim(p_label)
    )
  );

  RETURN v_expense_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_expense(
  p_expense_id uuid,
  p_category public.expense_category,
  p_label text,
  p_amount integer,
  p_supplier_name text DEFAULT NULL,
  p_expense_date date DEFAULT CURRENT_DATE,
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_area public.expense_area DEFAULT 'CAISSE'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.expenses%ROWTYPE;
  v_area public.expense_area := COALESCE(p_area, 'CAISSE'::public.expense_area);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT * INTO v_row FROM public.expenses WHERE id = p_expense_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dépense introuvable'; END IF;
  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_row.organization_id) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;
  IF v_row.status <> 'RECORDED'::public.expense_status THEN
    RAISE EXCEPTION 'Cette dépense est verrouillée';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Le montant doit être strictement positif'; END IF;
  IF p_label IS NULL OR btrim(p_label) = '' THEN RAISE EXCEPTION 'Le libellé est obligatoire'; END IF;

  UPDATE public.expenses SET
    category = p_category,
    area = v_area,
    label = btrim(p_label),
    amount = p_amount,
    supplier_name = NULLIF(btrim(COALESCE(p_supplier_name, '')), ''),
    expense_date = COALESCE(p_expense_date, CURRENT_DATE),
    reference = NULLIF(btrim(COALESCE(p_reference, '')), ''),
    note = NULLIF(btrim(COALESCE(p_note, '')), ''),
    updated_by = v_user_id
  WHERE id = p_expense_id;

  PERFORM public.write_admin_audit_log(
    v_row.organization_id, v_row.establishment_id, 'expense', p_expense_id,
    'EXPENSE_UPDATED'::public.audit_action, v_user_id,
    jsonb_build_object(
      'amount', p_amount,
      'label', btrim(p_label),
      'area', v_area
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_expense(uuid, public.expense_category, text, integer, text, date, text, text, public.expense_area) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_expense(uuid, public.expense_category, text, integer, text, date, text, text, public.expense_area) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_expense(uuid, public.expense_category, text, integer, text, date, text, text, public.expense_area) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_expense(uuid, public.expense_category, text, integer, text, date, text, text, public.expense_area) TO authenticated;
