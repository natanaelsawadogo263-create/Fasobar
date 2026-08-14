-- Quincaillerie : unités, champs produit, variantes, remises, clients, crédits, bons de commande.
-- Ne pas exécuter automatiquement.

ALTER TYPE public.product_unit ADD VALUE IF NOT EXISTS 'TONNE';
ALTER TYPE public.product_unit ADD VALUE IF NOT EXISTS 'METER';
ALTER TYPE public.product_unit ADD VALUE IF NOT EXISTS 'ROLL';
ALTER TYPE public.product_unit ADD VALUE IF NOT EXISTS 'BARRE';
ALTER TYPE public.product_unit ADD VALUE IF NOT EXISTS 'SHEET';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS purchase_price integer,
  ADD COLUMN IF NOT EXISTS wholesale_price integer,
  ADD COLUMN IF NOT EXISTS purchase_unit public.product_unit,
  ADD COLUMN IF NOT EXISTS units_per_purchase numeric,
  ADD COLUMN IF NOT EXISTS discount_min_quantity numeric,
  ADD COLUMN IF NOT EXISTS discount_percent numeric;

CREATE UNIQUE INDEX IF NOT EXISTS products_establishment_sku_key
  ON public.products (establishment_id, sku)
  WHERE sku IS NOT NULL AND btrim(sku) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS products_establishment_barcode_key
  ON public.products (establishment_id, barcode)
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '';

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  barcode text,
  unit public.product_unit,
  selling_price integer,
  wholesale_price integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT product_variants_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT product_variants_selling_price_non_negative CHECK (selling_price IS NULL OR selling_price >= 0)
);

CREATE INDEX IF NOT EXISTS product_variants_establishment_id_idx
  ON public.product_variants (establishment_id);
CREATE INDEX IF NOT EXISTS product_variants_product_id_idx
  ON public.product_variants (product_id);

CREATE TABLE IF NOT EXISTS public.trade_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  address text,
  customer_type text NOT NULL DEFAULT 'INDIVIDUAL',
  company_name text,
  tax_id text,
  credit_limit integer NOT NULL DEFAULT 300000,
  current_debt integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT trade_customers_name_not_blank CHECK (btrim(full_name) <> ''),
  CONSTRAINT trade_customers_type_valid CHECK (
    customer_type IN ('INDIVIDUAL', 'CRAFTSMAN', 'COMPANY', 'RESELLER')
  ),
  CONSTRAINT trade_customers_credit_limit_positive CHECK (credit_limit >= 0),
  CONSTRAINT trade_customers_debt_non_negative CHECK (current_debt >= 0)
);

CREATE INDEX IF NOT EXISTS trade_customers_establishment_id_idx
  ON public.trade_customers (establishment_id);
CREATE INDEX IF NOT EXISTS trade_customers_phone_idx
  ON public.trade_customers (establishment_id, phone);

CREATE TABLE IF NOT EXISTS public.customer_credit_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.trade_customers (id) ON DELETE RESTRICT,
  cash_register_id uuid,
  cash_session_id uuid,
  amount integer NOT NULL,
  payment_method public.payment_method NOT NULL DEFAULT 'CASH',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT customer_credit_payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS customer_credit_payments_customer_id_idx
  ON public.customer_credit_payments (customer_id);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  supplier_id uuid,
  status text NOT NULL DEFAULT 'DRAFT',
  reference text,
  notes text,
  ordered_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT purchase_orders_status_valid CHECK (
    status IN ('DRAFT', 'SENT', 'PENDING', 'PARTIAL', 'RECEIVED', 'CANCELLED')
  )
);

CREATE INDEX IF NOT EXISTS purchase_orders_establishment_id_idx
  ON public.purchase_orders (establishment_id);

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders (id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products (id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES public.product_variants (id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity_ordered numeric NOT NULL DEFAULT 0,
  quantity_received numeric NOT NULL DEFAULT 0,
  unit public.product_unit,
  unit_cost integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_order_lines_qty_non_negative CHECK (
    quantity_ordered >= 0 AND quantity_received >= 0
  )
);

CREATE INDEX IF NOT EXISTS purchase_order_lines_po_id_idx
  ON public.purchase_order_lines (purchase_order_id);

CREATE TABLE IF NOT EXISTS public.sales_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.trade_customers (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  reference text,
  notes text,
  converted_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.sales_quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.sales_quotes (id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products (id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES public.product_variants (id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric NOT NULL,
  unit public.product_unit,
  unit_price integer NOT NULL,
  sale_mode text NOT NULL DEFAULT 'RETAIL',
  discount_percent numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trade_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quote_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_variants_select ON public.product_variants;
CREATE POLICY product_variants_select ON public.product_variants
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
DROP POLICY IF EXISTS product_variants_write ON public.product_variants;
CREATE POLICY product_variants_write ON public.product_variants
  FOR ALL TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS trade_customers_select ON public.trade_customers;
CREATE POLICY trade_customers_select ON public.trade_customers
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
DROP POLICY IF EXISTS trade_customers_write ON public.trade_customers;
CREATE POLICY trade_customers_write ON public.trade_customers
  FOR ALL TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS customer_credit_payments_select ON public.customer_credit_payments;
CREATE POLICY customer_credit_payments_select ON public.customer_credit_payments
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
DROP POLICY IF EXISTS customer_credit_payments_insert ON public.customer_credit_payments;
CREATE POLICY customer_credit_payments_insert ON public.customer_credit_payments
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS purchase_orders_select ON public.purchase_orders;
CREATE POLICY purchase_orders_select ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
DROP POLICY IF EXISTS purchase_orders_write ON public.purchase_orders;
CREATE POLICY purchase_orders_write ON public.purchase_orders
  FOR ALL TO authenticated
  USING (public.user_can_manage_stock((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_stock((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS purchase_order_lines_select ON public.purchase_order_lines;
CREATE POLICY purchase_order_lines_select ON public.purchase_order_lines
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
DROP POLICY IF EXISTS purchase_order_lines_write ON public.purchase_order_lines;
CREATE POLICY purchase_order_lines_write ON public.purchase_order_lines
  FOR ALL TO authenticated
  USING (public.user_can_manage_stock((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_stock((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS sales_quotes_select ON public.sales_quotes;
CREATE POLICY sales_quotes_select ON public.sales_quotes
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
DROP POLICY IF EXISTS sales_quotes_write ON public.sales_quotes;
CREATE POLICY sales_quotes_write ON public.sales_quotes
  FOR ALL TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

DROP POLICY IF EXISTS sales_quote_lines_select ON public.sales_quote_lines;
CREATE POLICY sales_quote_lines_select ON public.sales_quote_lines
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id));
DROP POLICY IF EXISTS sales_quote_lines_write ON public.sales_quote_lines;
CREATE POLICY sales_quote_lines_write ON public.sales_quote_lines
  FOR ALL TO authenticated
  USING (public.user_can_manage_products((SELECT auth.uid()), establishment_id))
  WITH CHECK (public.user_can_manage_products((SELECT auth.uid()), establishment_id));

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
  )
  OR EXISTS (
    SELECT 1
    FROM public.establishment_memberships em
    INNER JOIN public.establishments e ON e.id = em.establishment_id
    INNER JOIN public.organizations o ON o.id = e.organization_id
    WHERE em.establishment_id = p_establishment_id
      AND em.user_id = p_user_id
      AND em.role = 'BAR_MANAGER'::public.membership_role
      AND e.activity_code = 'hardware'
      AND em.status = 'ACTIVE'::public.entity_status
      AND e.status = 'ACTIVE'::public.entity_status
      AND o.status = 'ACTIVE'::public.entity_status
  );
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trade_customers TO authenticated;
GRANT SELECT, INSERT ON TABLE public.customer_credit_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.purchase_order_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_quote_lines TO authenticated;
