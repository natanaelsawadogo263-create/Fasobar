-- Stockage images produits (upload admin, fond blanc SaaS)
-- Ne pas exécuter automatiquement — appliquer via supabase db push ou SQL Editor.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lecture publique (catalogue / caisse)
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

-- Upload / update / delete pour utilisateurs authentifiés (chemin org/établissement)
DROP POLICY IF EXISTS "product_images_authenticated_insert" ON storage.objects;
CREATE POLICY "product_images_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.user_can_manage_products(
      (SELECT auth.uid()),
      NULLIF(split_part(name, '/', 2), '')::uuid
    )
  );

DROP POLICY IF EXISTS "product_images_authenticated_update" ON storage.objects;
CREATE POLICY "product_images_authenticated_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.user_can_manage_products(
      (SELECT auth.uid()),
      NULLIF(split_part(name, '/', 2), '')::uuid
    )
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.user_can_manage_products(
      (SELECT auth.uid()),
      NULLIF(split_part(name, '/', 2), '')::uuid
    )
  );

DROP POLICY IF EXISTS "product_images_authenticated_delete" ON storage.objects;
CREATE POLICY "product_images_authenticated_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.user_can_manage_products(
      (SELECT auth.uid()),
      NULLIF(split_part(name, '/', 2), '')::uuid
    )
  );
