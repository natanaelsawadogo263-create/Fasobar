-- Vérification manuelle du déclencheur d'unicité inter-tables des codes-barres
-- (migration 20260821130000_barcode_cross_table_uniqueness.sql).
--
-- Ce script n'est PAS exécuté automatiquement : il n'y a pas d'instance Postgres
-- disponible dans l'environnement où ce chantier a été développé (pas de Docker /
-- `supabase start` possible ici). À lancer manuellement contre un projet Supabase
-- de test/staging (jamais en production) :
--
--   psql "$DATABASE_URL" -f supabase/tests/barcode_cross_table_uniqueness.sql
--
-- Couvre les scénarios 6, 7 et 8 de la liste de tests demandée :
--   6. collision code produit ↔ code conditionnement → refusée
--   7. collision entre deux conditionnements → refusée
--   8. même code dans deux établissements distincts → autorisé (multi-tenant)

BEGIN;

-- Établissement / organisation de test (adaptez si des lignes existent déjà).
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'Test Org A', 'test-org-a')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-0000000000a2', 'Test Org B', 'test-org-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.establishments (id, organization_id, name, slug)
VALUES ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'Etab A', 'etab-a')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.establishments (id, organization_id, name, slug)
VALUES ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a2', 'Etab B', 'etab-b')
ON CONFLICT (id) DO NOTHING;

-- Un profil "système" pour created_by/updated_by (adaptez à un profil réel si besoin).
-- Ici on suppose qu'un profil existe déjà (auth.users) ; sinon, adaptez cette section.

DO $$
DECLARE
  v_profile uuid;
  v_department uuid;
  v_category uuid;
  v_product_1 uuid;
  v_product_2 uuid;
BEGIN
  SELECT id INTO v_profile FROM public.profiles LIMIT 1;
  IF v_profile IS NULL THEN
    RAISE NOTICE 'Aucun profil trouvé — créez un utilisateur de test avant de lancer ce script.';
    RETURN;
  END IF;

  SELECT id INTO v_department FROM public.departments
    WHERE establishment_id = '00000000-0000-0000-0000-0000000000e1' LIMIT 1;
  SELECT id INTO v_category FROM public.categories
    WHERE establishment_id = '00000000-0000-0000-0000-0000000000e1' LIMIT 1;

  IF v_department IS NULL OR v_category IS NULL THEN
    RAISE NOTICE 'Département/catégorie manquants pour Etab A — bootstrap l''établissement de test d''abord.';
    RETURN;
  END IF;

  -- Produit 1 : code-barres CODE-A.
  INSERT INTO public.products (
    id, organization_id, establishment_id, department_id, category_id,
    name, slug, selling_price, unit, barcode, created_by, updated_by
  ) VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1',
    v_department, v_category, 'Produit test 1', 'produit-test-1', 500, 'PIECE', 'CODE-A',
    v_profile, v_profile
  ) RETURNING id INTO v_product_1;

  -- Produit 2 (même établissement).
  INSERT INTO public.products (
    id, organization_id, establishment_id, department_id, category_id,
    name, slug, selling_price, unit, created_by, updated_by
  ) VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1',
    v_department, v_category, 'Produit test 2', 'produit-test-2', 1000, 'PIECE',
    v_profile, v_profile
  ) RETURNING id INTO v_product_2;

  -- --- Scénario 6 : code produit ↔ code conditionnement (même établissement) ---
  BEGIN
    INSERT INTO public.product_unit_levels (
      id, organization_id, establishment_id, product_id, name, contains_qty, is_base,
      barcode, created_by, updated_by
    ) VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1',
      v_product_2, 'Pack test', 6, false, 'CODE-A', -- même code que produit 1
      v_profile, v_profile
    );
    RAISE EXCEPTION 'ÉCHEC scénario 6 : la collision code produit ↔ conditionnement aurait dû être refusée.';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK scénario 6 : collision produit ↔ conditionnement bien refusée.';
  END;

  -- --- Scénario 7 : collision entre deux conditionnements ---
  INSERT INTO public.product_unit_levels (
    id, organization_id, establishment_id, product_id, name, contains_qty, is_base,
    barcode, created_by, updated_by
  ) VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1',
    v_product_1, 'Pack A', 6, false, 'CODE-PACK', v_profile, v_profile
  );

  BEGIN
    INSERT INTO public.product_unit_levels (
      id, organization_id, establishment_id, product_id, name, contains_qty, is_base,
      barcode, created_by, updated_by
    ) VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1',
      v_product_2, 'Pack B', 12, false, 'CODE-PACK', -- même code que Pack A
      v_profile, v_profile
    );
    RAISE EXCEPTION 'ÉCHEC scénario 7 : la collision entre deux conditionnements aurait dû être refusée.';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK scénario 7 : collision entre deux conditionnements bien refusée.';
  END;

  RAISE NOTICE 'Tous les scénarios de collision (6, 7) sont passés.';
END $$;

ROLLBACK; -- Aucune donnée de test n'est conservée.

-- --- Scénario 8 : même code dans deux établissements distincts → autorisé ---
-- À vérifier séparément (nécessite deux établissements bootstrappés avec département +
-- catégorie) : insérer un produit avec barcode = 'CODE-SHARED' dans Etab A, puis un
-- autre produit avec le MÊME barcode = 'CODE-SHARED' dans Etab B. La seconde insertion
-- doit réussir (establishment_id différent → hors du scope des index uniques et du
-- déclencheur, tous deux bornés par establishment_id).
