-- FasoBar: Realtime catalogue produits (+ stock déjà couvert) pour synchro
-- Admin → Caisse–Cuisine / Responsable Bar dès création ou modification.
-- Fichier uniquement — à appliquer manuellement.

DO $$
DECLARE
  tables text[] := ARRAY[
    'products',
    'categories',
    'product_packagings'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = t
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;
