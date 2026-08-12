-- Profil d’exploitation de l’établissement restauration :
-- BAR = boissons uniquement, KITCHEN = nourriture uniquement, BOTH = les deux.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'establishment_service_scope'
  ) THEN
    CREATE TYPE public.establishment_service_scope AS ENUM ('BOTH', 'BAR', 'KITCHEN');
  END IF;
END
$$;

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS service_scope public.establishment_service_scope NOT NULL DEFAULT 'BOTH';

COMMENT ON COLUMN public.establishments.service_scope IS
  'Espaces ouverts : BAR (boissons), KITCHEN (nourriture) ou BOTH.';
