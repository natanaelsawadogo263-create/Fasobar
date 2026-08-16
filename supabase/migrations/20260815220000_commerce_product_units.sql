-- Socle commerce : type de vente, caractéristiques, unités d’achat/vente.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'UNIT',
  ADD COLUMN IF NOT EXISTS characteristics jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_sale_type_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_sale_type_check
  CHECK (sale_type IN ('UNIT', 'WEIGHT', 'LENGTH', 'VOLUME', 'PACKS'));

ALTER TABLE public.product_unit_levels
  ADD COLUMN IF NOT EXISTS allow_decimal boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS barcode text;

COMMENT ON COLUMN public.products.sale_type IS
  'Mode de vente : unité, poids, longueur, volume, conditionnements.';
COMMENT ON COLUMN public.product_unit_levels.contains_qty IS
  'Combien d’unités parentes (ou de stock) dans ce conditionnement.';
COMMENT ON COLUMN public.product_unit_levels.purchasable IS
  'Unité d’achat (approvisionnement).';
COMMENT ON COLUMN public.product_unit_levels.sellable IS
  'Unité de vente (caisse).';
