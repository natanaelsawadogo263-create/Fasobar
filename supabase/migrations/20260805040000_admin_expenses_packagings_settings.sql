-- FasoBar Admin: expenses, product packagings, establishment settings, unit extensions
-- Do NOT auto-run. Apply manually when ready.

ALTER TYPE public.product_unit ADD VALUE IF NOT EXISTS 'SACHET';
ALTER TYPE public.product_unit ADD VALUE IF NOT EXISTS 'JERRYCAN';
ALTER TYPE public.product_unit ADD VALUE IF NOT EXISTS 'CARTON';
ALTER TYPE public.product_unit ADD VALUE IF NOT EXISTS 'BUNDLE';

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'EXPENSE_CREATED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'EXPENSE_UPDATED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'EXPENSE_CANCELLED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'PACKAGING_UPSERTED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'SETTINGS_UPDATED';

CREATE TYPE public.expense_category AS ENUM (
  'KITCHEN_PURCHASE',
  'GAS',
  'CHARCOAL',
  'TRANSPORT',
  'MAINTENANCE',
  'PAYROLL',
  'RENT',
  'WATER',
  'ELECTRICITY',
  'OTHER'
);

CREATE TYPE public.expense_status AS ENUM (
  'RECORDED',
  'CANCELLED'
);

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'XOF',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Ouagadougou',
  ADD COLUMN IF NOT EXISTS receipt_header text,
  ADD COLUMN IF NOT EXISTS receipt_footer text,
  ADD COLUMN IF NOT EXISTS thank_you_message text,
  ADD COLUMN IF NOT EXISTS default_minimum_stock integer NOT NULL DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'establishments_currency_not_blank'
  ) THEN
    ALTER TABLE public.establishments
      ADD CONSTRAINT establishments_currency_not_blank CHECK (btrim(currency) <> '');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'establishments_timezone_not_blank'
  ) THEN
    ALTER TABLE public.establishments
      ADD CONSTRAINT establishments_timezone_not_blank CHECK (btrim(timezone) <> '');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'establishments_default_minimum_stock_non_negative'
  ) THEN
    ALTER TABLE public.establishments
      ADD CONSTRAINT establishments_default_minimum_stock_non_negative
        CHECK (default_minimum_stock >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.product_packagings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  name text NOT NULL,
  packaging_unit public.product_unit NOT NULL,
  base_unit public.product_unit NOT NULL,
  conversion_factor numeric(14, 3) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT product_packagings_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT product_packagings_conversion_positive CHECK (conversion_factor > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_packagings_product_name_key
  ON public.product_packagings (product_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS product_packagings_organization_id_idx ON public.product_packagings (organization_id);
CREATE INDEX IF NOT EXISTS product_packagings_establishment_id_idx ON public.product_packagings (establishment_id);
CREATE INDEX IF NOT EXISTS product_packagings_product_id_idx ON public.product_packagings (product_id);

DROP TRIGGER IF EXISTS product_packagings_set_updated_at ON public.product_packagings;
CREATE TRIGGER product_packagings_set_updated_at
  BEFORE UPDATE ON public.product_packagings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  category public.expense_category NOT NULL,
  label text NOT NULL,
  amount integer NOT NULL,
  supplier_name text,
  expense_date date NOT NULL DEFAULT (CURRENT_DATE),
  reference text,
  note text,
  status public.expense_status NOT NULL DEFAULT 'RECORDED',
  cancel_reason text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  cancelled_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_label_not_blank CHECK (btrim(label) <> ''),
  CONSTRAINT expenses_amount_positive CHECK (amount > 0),
  CONSTRAINT expenses_cancel_reason_when_cancelled CHECK (
    (status = 'RECORDED'::public.expense_status AND cancel_reason IS NULL AND cancelled_at IS NULL AND cancelled_by IS NULL)
    OR (status = 'CANCELLED'::public.expense_status AND cancel_reason IS NOT NULL AND btrim(cancel_reason) <> '')
  )
);

CREATE INDEX IF NOT EXISTS expenses_organization_id_idx ON public.expenses (organization_id);
CREATE INDEX IF NOT EXISTS expenses_establishment_id_idx ON public.expenses (establishment_id);
CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON public.expenses (expense_date);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON public.expenses (category);
CREATE INDEX IF NOT EXISTS expenses_status_idx ON public.expenses (status);

DROP TRIGGER IF EXISTS expenses_set_updated_at ON public.expenses;
CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.product_packagings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_packagings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_packagings_select ON public.product_packagings;
CREATE POLICY product_packagings_select
  ON public.product_packagings FOR SELECT TO authenticated
  USING (
    public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id)
    OR public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS product_packagings_insert ON public.product_packagings;
CREATE POLICY product_packagings_insert
  ON public.product_packagings FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS product_packagings_update ON public.product_packagings;
CREATE POLICY product_packagings_update
  ON public.product_packagings FOR UPDATE TO authenticated
  USING (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id))
  WITH CHECK (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id));

DROP POLICY IF EXISTS product_packagings_delete ON public.product_packagings;
CREATE POLICY product_packagings_delete
  ON public.product_packagings FOR DELETE TO authenticated
  USING (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id));

DROP POLICY IF EXISTS expenses_select ON public.expenses;
CREATE POLICY expenses_select
  ON public.expenses FOR SELECT TO authenticated
  USING (
    public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id)
    OR public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS expenses_insert ON public.expenses;
CREATE POLICY expenses_insert
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS expenses_update ON public.expenses;
CREATE POLICY expenses_update
  ON public.expenses FOR UPDATE TO authenticated
  USING (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id))
  WITH CHECK (public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id));

DROP POLICY IF EXISTS expenses_delete_deny ON public.expenses;
CREATE POLICY expenses_delete_deny
  ON public.expenses FOR DELETE TO authenticated
  USING (false);

REVOKE ALL ON TABLE public.product_packagings FROM anon;
REVOKE ALL ON TABLE public.expenses FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_packagings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.expenses TO authenticated;
GRANT USAGE ON TYPE public.expense_category TO authenticated;
GRANT USAGE ON TYPE public.expense_status TO authenticated;

CREATE OR REPLACE FUNCTION public.write_admin_audit_log(
  p_organization_id uuid,
  p_establishment_id uuid,
  p_entity_type text,
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
    organization_id, establishment_id, entity_type, entity_id, action, actor_id, metadata
  ) VALUES (
    p_organization_id, p_establishment_id, p_entity_type, p_entity_id, p_action, p_actor_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_expense(
  p_establishment_id uuid,
  p_category public.expense_category,
  p_label text,
  p_amount integer,
  p_supplier_name text DEFAULT NULL,
  p_expense_date date DEFAULT CURRENT_DATE,
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL
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
    organization_id, establishment_id, category, label, amount, supplier_name,
    expense_date, reference, note, created_by, updated_by
  ) VALUES (
    v_org_id, p_establishment_id, p_category, btrim(p_label), p_amount,
    NULLIF(btrim(COALESCE(p_supplier_name, '')), ''),
    COALESCE(p_expense_date, CURRENT_DATE),
    NULLIF(btrim(COALESCE(p_reference, '')), ''),
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    v_user_id, v_user_id
  ) RETURNING id INTO v_expense_id;

  PERFORM public.write_admin_audit_log(
    v_org_id, p_establishment_id, 'expense', v_expense_id,
    'EXPENSE_CREATED'::public.audit_action, v_user_id,
    jsonb_build_object('category', p_category, 'amount', p_amount, 'label', btrim(p_label))
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
  p_note text DEFAULT NULL
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
  IF v_row.status <> 'RECORDED'::public.expense_status THEN
    RAISE EXCEPTION 'Cette dépense est verrouillée';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Le montant doit être strictement positif'; END IF;
  IF p_label IS NULL OR btrim(p_label) = '' THEN RAISE EXCEPTION 'Le libellé est obligatoire'; END IF;

  UPDATE public.expenses SET
    category = p_category,
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
    jsonb_build_object('amount', p_amount, 'label', btrim(p_label))
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
  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_row.organization_id) THEN
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
  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_product.organization_id) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Le nom du conditionnement est obligatoire'; END IF;
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

CREATE OR REPLACE FUNCTION public.update_establishment_settings(
  p_establishment_id uuid,
  p_name text,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_currency text DEFAULT 'XOF',
  p_timezone text DEFAULT 'Africa/Ouagadougou',
  p_receipt_header text DEFAULT NULL,
  p_receipt_footer text DEFAULT NULL,
  p_thank_you_message text DEFAULT NULL,
  p_default_minimum_stock integer DEFAULT 5
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT organization_id INTO v_org_id FROM public.establishments WHERE id = p_establishment_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Établissement introuvable'; END IF;
  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_org_id) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Le nom de l''établissement est obligatoire'; END IF;
  IF p_default_minimum_stock IS NULL OR p_default_minimum_stock < 0 THEN
    RAISE EXCEPTION 'Le seuil de stock par défaut doit être positif ou nul';
  END IF;

  UPDATE public.establishments SET
    name = btrim(p_name),
    address = NULLIF(btrim(COALESCE(p_address, '')), ''),
    phone = NULLIF(btrim(COALESCE(p_phone, '')), ''),
    currency = COALESCE(NULLIF(btrim(p_currency), ''), 'XOF'),
    timezone = COALESCE(NULLIF(btrim(p_timezone), ''), 'Africa/Ouagadougou'),
    receipt_header = NULLIF(btrim(COALESCE(p_receipt_header, '')), ''),
    receipt_footer = NULLIF(btrim(COALESCE(p_receipt_footer, '')), ''),
    thank_you_message = NULLIF(btrim(COALESCE(p_thank_you_message, '')), ''),
    default_minimum_stock = COALESCE(p_default_minimum_stock, 5)
  WHERE id = p_establishment_id;

  PERFORM public.write_admin_audit_log(
    v_org_id, p_establishment_id, 'establishment', p_establishment_id,
    'SETTINGS_UPDATED'::public.audit_action, v_user_id,
    jsonb_build_object('name', btrim(p_name))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.write_admin_audit_log(uuid, uuid, text, uuid, public.audit_action, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_expense(uuid, public.expense_category, text, integer, text, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_expense(uuid, public.expense_category, text, integer, text, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_expense(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_product_packaging(uuid, text, public.product_unit, numeric, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_establishment_settings(uuid, text, text, text, text, text, text, text, text, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_expense(uuid, public.expense_category, text, integer, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_expense(uuid, public.expense_category, text, integer, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_expense(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_product_packaging(uuid, text, public.product_unit, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_establishment_settings(uuid, text, text, text, text, text, text, text, text, integer) TO authenticated;
