-- Fournisseurs rattachés au Bar ou à la Cuisine.

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS department_code public.department_code NOT NULL DEFAULT 'BAR'::public.department_code;

COMMENT ON COLUMN public.suppliers.department_code IS
  'Espace d''approvisionnement du fournisseur : BAR ou KITCHEN.';

CREATE INDEX IF NOT EXISTS suppliers_establishment_department_idx
  ON public.suppliers (establishment_id, department_code);
