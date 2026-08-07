-- FasoBar: bucket privé preuves de paiement Orange Money
-- À appliquer manuellement. Ne pas exécuter automatiquement.
--
-- Prérequis : 20260806210000_platform_control_plane_complete.sql
--   (platform_is_org_owner, is_active_platform_admin)
--
-- Chemin objet : {organization_id}/{request_id}/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'subscription-payment-proofs',
  'subscription-payment-proofs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lecture : Super Admin uniquement (pas de lecture publique)
DROP POLICY IF EXISTS "subscription_payment_proofs_select_super_admin" ON storage.objects;
CREATE POLICY "subscription_payment_proofs_select_super_admin"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'subscription-payment-proofs'
    AND public.is_active_platform_admin()
  );

-- OWNER : INSERT sur chemins de son organisation
DROP POLICY IF EXISTS "subscription_payment_proofs_insert_owner" ON storage.objects;
CREATE POLICY "subscription_payment_proofs_insert_owner"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'subscription-payment-proofs'
    AND public.platform_is_org_owner(
      NULLIF(split_part(name, '/', 1), '')::uuid
    )
  );

-- OWNER : UPDATE sur chemins de son organisation
DROP POLICY IF EXISTS "subscription_payment_proofs_update_owner" ON storage.objects;
CREATE POLICY "subscription_payment_proofs_update_owner"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'subscription-payment-proofs'
    AND public.platform_is_org_owner(
      NULLIF(split_part(name, '/', 1), '')::uuid
    )
  )
  WITH CHECK (
    bucket_id = 'subscription-payment-proofs'
    AND public.platform_is_org_owner(
      NULLIF(split_part(name, '/', 1), '')::uuid
    )
  );

-- OWNER : DELETE sur chemins de son organisation
DROP POLICY IF EXISTS "subscription_payment_proofs_delete_owner" ON storage.objects;
CREATE POLICY "subscription_payment_proofs_delete_owner"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'subscription-payment-proofs'
    AND public.platform_is_org_owner(
      NULLIF(split_part(name, '/', 1), '')::uuid
    )
  );

-- Super Admin : gestion complète des objets (hors SELECT déjà couvert)
DROP POLICY IF EXISTS "subscription_payment_proofs_insert_super_admin" ON storage.objects;
CREATE POLICY "subscription_payment_proofs_insert_super_admin"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'subscription-payment-proofs'
    AND public.is_active_platform_admin()
  );

DROP POLICY IF EXISTS "subscription_payment_proofs_update_super_admin" ON storage.objects;
CREATE POLICY "subscription_payment_proofs_update_super_admin"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'subscription-payment-proofs'
    AND public.is_active_platform_admin()
  )
  WITH CHECK (
    bucket_id = 'subscription-payment-proofs'
    AND public.is_active_platform_admin()
  );

DROP POLICY IF EXISTS "subscription_payment_proofs_delete_super_admin" ON storage.objects;
CREATE POLICY "subscription_payment_proofs_delete_super_admin"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'subscription-payment-proofs'
    AND public.is_active_platform_admin()
  );
