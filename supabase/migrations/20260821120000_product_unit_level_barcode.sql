-- Code-barres par conditionnement (ex. bouteille vs carton de 6) — espace Alimentation.
-- `products.barcode` existe déjà (unicité par établissement) pour l'unité de base ;
-- ce fichier ajoute le même mécanisme sur `product_unit_levels` pour les conditionnements
-- (lots / packs) définis via le système commerce existant. Aucune nouvelle table :
-- réutilise product_unit_levels (déjà RLS + indexé par produit).

ALTER TABLE public.product_unit_levels
  ADD COLUMN IF NOT EXISTS barcode text;

-- Un code-barres de conditionnement doit être unique dans l'établissement, comme pour
-- products.barcode. Index partiel : ne contraint que les lignes avec un code renseigné.
CREATE UNIQUE INDEX IF NOT EXISTS product_unit_levels_establishment_barcode_key
  ON public.product_unit_levels (establishment_id, barcode)
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '';

-- Recherche rapide par code-barres (approvisionnement, inventaire futur, audits).
CREATE INDEX IF NOT EXISTS product_unit_levels_barcode_lookup_idx
  ON public.product_unit_levels (establishment_id, barcode)
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '';

-- Note : products.barcode dispose déjà de l'index unique products_establishment_barcode_key
-- (migration hardware_commerce), qui sert aussi de chemin d'accès rapide en lecture — pas
-- besoin d'un index supplémentaire ici.

COMMENT ON COLUMN public.product_unit_levels.barcode IS
  'Code-barres propre à ce conditionnement (ex. carton de 6) — optionnel, unique par établissement.';
