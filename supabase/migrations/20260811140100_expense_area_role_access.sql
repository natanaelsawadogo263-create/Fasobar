-- Autoriser Bar et Caisse–Cuisine à gérer les dépenses de leur zone
-- Appliquer après 20260811140000_expense_area.sql

CREATE OR REPLACE FUNCTION public.user_can_manage_expense_area(
  p_user_id uuid,
  p_establishment_id uuid,
  p_area public.expense_area
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_establishment_id IS NULL OR p_area IS NULL THEN
    RETURN false;
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.establishments
  WHERE id = p_establishment_id;

  IF v_org_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.user_is_organization_owner_or_admin(p_user_id, v_org_id) THEN
    RETURN true;
  END IF;

  IF NOT public.user_belongs_to_establishment(p_user_id, p_establishment_id) THEN
    RETURN false;
  END IF;

  IF p_area = 'BAR'::public.expense_area THEN
    RETURN public.user_has_establishment_role(
      p_user_id,
      p_establishment_id,
      'BAR_MANAGER'::public.membership_role
    );
  END IF;

  -- CAISSE : rôles caisse / cuisine
  RETURN EXISTS (
    SELECT 1
    FROM public.establishment_memberships em
    WHERE em.user_id = p_user_id
      AND em.establishment_id = p_establishment_id
      AND em.status = 'ACTIVE'::public.entity_status
      AND em.role::text IN ('CASHIER', 'CASHIER_KITCHEN', 'KITCHEN_MANAGER')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.user_can_manage_expense_area(uuid, uuid, public.expense_area) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_manage_expense_area(uuid, uuid, public.expense_area) TO authenticated;

DROP POLICY IF EXISTS expenses_insert ON public.expenses;
CREATE POLICY expenses_insert
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_manage_expense_area((SELECT auth.uid()), establishment_id, area)
  );

DROP POLICY IF EXISTS expenses_update ON public.expenses;
CREATE POLICY expenses_update
  ON public.expenses FOR UPDATE TO authenticated
  USING (
    public.user_can_manage_expense_area((SELECT auth.uid()), establishment_id, area)
  )
  WITH CHECK (
    public.user_can_manage_expense_area((SELECT auth.uid()), establishment_id, area)
  );

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
  IF NOT public.user_belongs_to_establishment(v_user_id, p_establishment_id) THEN
    RAISE EXCEPTION 'Établissement non autorisé';
  END IF;
  IF NOT public.user_can_manage_expense_area(v_user_id, p_establishment_id, v_area) THEN
    RAISE EXCEPTION 'Permission insuffisante';
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
  IF NOT public.user_belongs_to_establishment(v_user_id, v_row.establishment_id) THEN
    RAISE EXCEPTION 'Établissement non autorisé';
  END IF;
  IF NOT public.user_can_manage_expense_area(v_user_id, v_row.establishment_id, v_row.area) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;
  IF NOT public.user_can_manage_expense_area(v_user_id, v_row.establishment_id, v_area) THEN
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

CREATE OR REPLACE FUNCTION public.cancel_expense(
  p_expense_id uuid,
  p_reason text
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
  IF NOT public.user_belongs_to_establishment(v_user_id, v_row.establishment_id) THEN
    RAISE EXCEPTION 'Établissement non autorisé';
  END IF;
  IF NOT public.user_can_manage_expense_area(v_user_id, v_row.establishment_id, v_row.area) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;
  IF v_row.status = 'CANCELLED'::public.expense_status THEN
    RAISE EXCEPTION 'Dépense déjà annulée';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Le motif d''annulation est obligatoire';
  END IF;

  UPDATE public.expenses SET
    status = 'CANCELLED'::public.expense_status,
    cancel_reason = btrim(p_reason),
    cancelled_at = now(),
    cancelled_by = v_user_id,
    updated_by = v_user_id
  WHERE id = p_expense_id;

  PERFORM public.write_admin_audit_log(
    v_row.organization_id, v_row.establishment_id, 'expense', p_expense_id,
    'EXPENSE_CANCELLED'::public.audit_action, v_user_id,
    jsonb_build_object('reason', btrim(p_reason), 'amount', v_row.amount)
  );
END;
$$;
