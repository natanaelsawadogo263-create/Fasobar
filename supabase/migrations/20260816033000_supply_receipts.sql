-- Approvisionnement multi-lignes : 1 opération = N produits. Stock uniquement à la validation.

DO $$
BEGIN
  CREATE TYPE public.supply_receipt_status AS ENUM ('DRAFT', 'VALIDATED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.supply_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  status public.supply_receipt_status NOT NULL DEFAULT 'DRAFT',
  received_on date NOT NULL DEFAULT (timezone('utc', now()))::date,
  notes text,
  total_amount integer NOT NULL DEFAULT 0,
  validated_at timestamptz,
  validated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT supply_receipts_total_non_negative CHECK (total_amount >= 0),
  CONSTRAINT supply_receipts_validated_fields CHECK (
    (status = 'DRAFT' AND validated_at IS NULL AND validated_by IS NULL)
    OR (status = 'VALIDATED' AND validated_at IS NOT NULL AND validated_by IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS supply_receipts_establishment_id_idx
  ON public.supply_receipts (establishment_id, received_on DESC);
CREATE INDEX IF NOT EXISTS supply_receipts_supplier_id_idx
  ON public.supply_receipts (supplier_id);

CREATE TABLE IF NOT EXISTS public.supply_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL REFERENCES public.supply_receipts (id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items (id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  unit_level_id uuid,
  unit_name text NOT NULL,
  purchased_quantity numeric(14, 3) NOT NULL,
  conversion_factor numeric(14, 6) NOT NULL DEFAULT 1,
  stock_quantity numeric(14, 3) NOT NULL,
  purchase_price integer NOT NULL,
  line_total integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supply_receipt_lines_qty_positive CHECK (purchased_quantity > 0),
  CONSTRAINT supply_receipt_lines_factor_positive CHECK (conversion_factor > 0),
  CONSTRAINT supply_receipt_lines_stock_positive CHECK (stock_quantity > 0),
  CONSTRAINT supply_receipt_lines_price_non_negative CHECK (purchase_price >= 0),
  CONSTRAINT supply_receipt_lines_total_non_negative CHECK (line_total >= 0),
  CONSTRAINT supply_receipt_lines_unit_name_not_blank CHECK (btrim(unit_name) <> '')
);

CREATE INDEX IF NOT EXISTS supply_receipt_lines_receipt_id_idx
  ON public.supply_receipt_lines (receipt_id);

ALTER TABLE public.supply_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.supply_receipt_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supply_receipts_select ON public.supply_receipts;
CREATE POLICY supply_receipts_select
  ON public.supply_receipts
  FOR SELECT
  TO authenticated
  USING (public.user_can_manage_stock((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS supply_receipts_insert ON public.supply_receipts;
CREATE POLICY supply_receipts_insert
  ON public.supply_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_manage_stock((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS supply_receipts_update ON public.supply_receipts;
CREATE POLICY supply_receipts_update
  ON public.supply_receipts
  FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_stock((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_stock((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS supply_receipts_delete ON public.supply_receipts;
CREATE POLICY supply_receipts_delete
  ON public.supply_receipts
  FOR DELETE
  TO authenticated
  USING (
    status = 'DRAFT'
    AND public.user_can_manage_stock((SELECT auth.uid()), establishment_id)
  );

DROP POLICY IF EXISTS supply_receipt_lines_select ON public.supply_receipt_lines;
CREATE POLICY supply_receipt_lines_select
  ON public.supply_receipt_lines
  FOR SELECT
  TO authenticated
  USING (public.user_can_manage_stock((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS supply_receipt_lines_insert ON public.supply_receipt_lines;
CREATE POLICY supply_receipt_lines_insert
  ON public.supply_receipt_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_manage_stock((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS supply_receipt_lines_update ON public.supply_receipt_lines;
CREATE POLICY supply_receipt_lines_update
  ON public.supply_receipt_lines
  FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_stock((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_stock((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS supply_receipt_lines_delete ON public.supply_receipt_lines;
CREATE POLICY supply_receipt_lines_delete
  ON public.supply_receipt_lines
  FOR DELETE
  TO authenticated
  USING (public.user_can_manage_stock((SELECT auth.uid()), establishment_id));

CREATE OR REPLACE FUNCTION public.validate_supply_receipt(p_receipt_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_receipt public.supply_receipts%ROWTYPE;
  v_line public.supply_receipt_lines%ROWTYPE;
  v_unit_cost integer;
  v_total integer := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT *
  INTO v_receipt
  FROM public.supply_receipts
  WHERE id = p_receipt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approvisionnement introuvable.';
  END IF;

  IF NOT public.user_can_manage_stock(v_user_id, v_receipt.establishment_id) THEN
    RAISE EXCEPTION 'Permission insuffisante pour valider cet approvisionnement.';
  END IF;

  IF v_receipt.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Cet approvisionnement est déjà validé.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.supply_receipt_lines WHERE receipt_id = v_receipt.id
  ) THEN
    RAISE EXCEPTION 'Ajoutez au moins un produit.';
  END IF;

  FOR v_line IN
    SELECT *
    FROM public.supply_receipt_lines
    WHERE receipt_id = v_receipt.id
    ORDER BY sort_order, created_at
  LOOP
    v_total := v_total + v_line.line_total;
    v_unit_cost := CASE
      WHEN v_line.conversion_factor > 1 THEN round(v_line.purchase_price / v_line.conversion_factor)::integer
      ELSE v_line.purchase_price
    END;

    PERFORM public.record_stock_entry(
      v_line.stock_item_id,
      'PURCHASE'::public.stock_movement_type,
      v_line.stock_quantity,
      v_line.purchased_quantity,
      v_line.conversion_factor,
      v_unit_cost,
      v_receipt.supplier_id,
      'APP-' || left(v_receipt.id::text, 8),
      NULLIF(btrim(COALESCE(v_receipt.notes, '')), '')
    );
  END LOOP;

  UPDATE public.supply_receipts
  SET
    status = 'VALIDATED',
    total_amount = v_total,
    validated_at = now(),
    validated_by = v_user_id,
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = v_receipt.id;

  RETURN v_receipt.id;
END;
$$;

REVOKE ALL ON TABLE public.supply_receipts FROM anon;
REVOKE ALL ON TABLE public.supply_receipt_lines FROM anon;
REVOKE ALL ON TYPE public.supply_receipt_status FROM anon;
REVOKE ALL ON FUNCTION public.validate_supply_receipt(uuid) FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.supply_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.supply_receipt_lines TO authenticated;
GRANT USAGE ON TYPE public.supply_receipt_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_supply_receipt(uuid) TO authenticated;
