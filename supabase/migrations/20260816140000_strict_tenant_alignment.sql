-- Isolation stricte : organization_id d’une ligne = organisation de l’établissement.
-- Empêche d’écrire le stock / les ventes d’un magasin dans un autre tenant.

CREATE OR REPLACE FUNCTION public.enforce_tenant_alignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.establishment_id IS NULL OR NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'Organisation et établissement obligatoires.';
  END IF;

  SELECT e.organization_id
  INTO v_org
  FROM public.establishments e
  WHERE e.id = NEW.establishment_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Établissement introuvable.';
  END IF;

  IF v_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Impossible de mélanger les données de deux établissements.';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'departments',
    'categories',
    'products',
    'audit_logs',
    'stock_items',
    'stock_movements',
    'suppliers',
    'orders',
    'payments',
    'cash_register_sessions',
    'expenses',
    'inventory_sessions',
    'bar_sessions',
    'product_packagings',
    'product_unit_levels',
    'product_variants',
    'product_brands',
    'product_attributes',
    'supply_receipts',
    'supply_receipt_lines',
    'admin_notifications'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'organization_id'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'establishment_id'
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON public.%I',
        t || '_tenant_alignment',
        t
      );
      EXECUTE format(
        'CREATE TRIGGER %I
           BEFORE INSERT OR UPDATE OF organization_id, establishment_id
           ON public.%I
           FOR EACH ROW
           EXECUTE FUNCTION public.enforce_tenant_alignment()',
        t || '_tenant_alignment',
        t
      );
    END IF;
  END LOOP;
END;
$$;
