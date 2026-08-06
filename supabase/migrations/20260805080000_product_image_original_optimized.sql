-- FasoBar: images produit originale + optimisée catalogue
-- Ne pas exécuter automatiquement — appliquer via SQL Editor / supabase db push.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_original_url text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_optimized_url text;

COMMENT ON COLUMN public.products.image_original_url IS
  'URL de l''image originale uploadée par l''admin (non retouchée).';

COMMENT ON COLUMN public.products.image_optimized_url IS
  'URL de l''image catalogue FasoBar (détourage, netteté, fond adapté au type de produit).';

COMMENT ON COLUMN public.products.image_url IS
  'URL d''affichage legacy : préférer image_optimized_url, sinon image_original_url.';

-- Aligne image_url existante vers original si les nouvelles colonnes sont vides.
UPDATE public.products
SET image_original_url = image_url
WHERE image_url IS NOT NULL
  AND btrim(image_url) <> ''
  AND (image_original_url IS NULL OR btrim(image_original_url) = '');
