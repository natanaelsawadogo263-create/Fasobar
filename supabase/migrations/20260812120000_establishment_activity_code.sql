-- Activité commerciale choisie à l’inscription (catalogue FasoBar).
-- COMMERCE : type générique pour les métiers hors restauration.

ALTER TYPE public.establishment_type ADD VALUE IF NOT EXISTS 'COMMERCE';

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS activity_code text;

COMMENT ON COLUMN public.establishments.activity_code IS
  'Code activité commerciale choisi à l’inscription (ex. pharmacy, hardware).';
