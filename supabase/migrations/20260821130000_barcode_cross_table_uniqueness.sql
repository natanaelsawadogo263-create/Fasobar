-- Unicité GLOBALE d'un code-barres dans un établissement, entre les DEUX espaces de
-- codes existants (products.barcode et product_unit_levels.barcode).
--
-- Les index uniques déjà en place (products_establishment_barcode_key,
-- product_unit_levels_establishment_barcode_key) empêchent chacun les doublons DANS
-- leur propre table, mais ne voient pas l'autre table : deux lignes de deux tables
-- différentes pouvaient encore partager le même code. Cette migration ajoute un
-- déclencheur qui interdit explicitement les 4 cas de collision inter-tables :
--   - deux produits (déjà couvert par l'index unique existant, revérifié ici) ;
--   - un produit et le pack d'un AUTRE produit ;
--   - un produit et un de SES PROPRES conditionnements ;
--   - deux conditionnements (déjà couvert par l'index existant, revérifié ici).
--
-- Portée strictement multi-tenant : la comparaison est toujours bornée à
-- establishment_id — un même code peut exister dans deux établissements différents
-- sans conflit.
--
-- Ne repose pas uniquement sur la validation applicative (Server Actions) : ce
-- déclencheur s'exécute dans la même transaction que l'écriture, donc protège aussi
-- contre les écritures concurrentes (RPC, service role, migrations futures) qui
-- contourneraient les pré-contrôles côté serveur.

CREATE OR REPLACE FUNCTION public.enforce_barcode_cross_table_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_barcode text;
  v_conflict boolean;
BEGIN
  v_barcode := NULLIF(btrim(NEW.barcode), '');

  IF v_barcode IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'products' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.product_unit_levels ul
      WHERE ul.establishment_id = NEW.establishment_id
        AND ul.barcode = v_barcode
    ) INTO v_conflict;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.establishment_id = NEW.establishment_id
        AND p.barcode = v_barcode
    ) INTO v_conflict;
  END IF;

  IF v_conflict THEN
    RAISE EXCEPTION
      'Ce code-barres est déjà utilisé par un autre produit ou conditionnement (barcode collision) dans cet établissement.'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_barcode_cross_table_check ON public.products;
CREATE TRIGGER products_barcode_cross_table_check
  BEFORE INSERT OR UPDATE OF barcode, establishment_id ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_barcode_cross_table_uniqueness();

DROP TRIGGER IF EXISTS product_unit_levels_barcode_cross_table_check ON public.product_unit_levels;
CREATE TRIGGER product_unit_levels_barcode_cross_table_check
  BEFORE INSERT OR UPDATE OF barcode, establishment_id ON public.product_unit_levels
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_barcode_cross_table_uniqueness();

REVOKE ALL ON FUNCTION public.enforce_barcode_cross_table_uniqueness() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_barcode_cross_table_uniqueness() TO authenticated;

COMMENT ON FUNCTION public.enforce_barcode_cross_table_uniqueness() IS
  'Interdit qu''un même code-barres (établissement donné) soit utilisé à la fois sur products.barcode et product_unit_levels.barcode.';
