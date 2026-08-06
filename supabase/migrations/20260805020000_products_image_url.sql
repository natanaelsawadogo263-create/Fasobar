-- FasoBar: URL d'image produit (locale /products/... ou URL internet)
-- Ne pas exécuter automatiquement — appliquer via supabase db push ou SQL Editor.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.products.image_url IS
  'URL image produit (upload admin traité : fond blanc SaaS) ou chemin local /products/...';
