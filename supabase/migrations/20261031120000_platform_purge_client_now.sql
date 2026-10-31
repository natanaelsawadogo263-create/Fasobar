-- Super Admin : suppression définitive d'un client, immédiate et qui aboutit.
--
-- Avant :
--   * la purge n'était possible qu'en PENDING_DELETION, après le délai de
--     récupération ;
--   * un simple DELETE FROM organizations échouait dès que le client avait des
--     données : certaines liaisons internes sont en ON DELETE RESTRICT (ex.
--     payments.order_id → orders, delivery_orders.sale_order_id → orders),
--     et l'ordre des suppressions en cascade n'est pas garanti. Toute la purge
--     était annulée et le client restait visible.
--
-- Maintenant :
--   * le Super Admin peut purger à tout moment (nom exact obligatoire) ;
--   * les lignes du client sont supprimées table par table, en plusieurs passes,
--     jusqu'à ce que plus aucune liaison ne bloque. Seules les tables déjà
--     supprimées en cascade avec l'organisation (ON DELETE CASCADE) sont
--     concernées : rien d'autre n'est effacé qu'avant.
--   * la suppression des comptes de connexion (Auth) est faite par l'app.

CREATE OR REPLACE FUNCTION public.purge_client_organization(
  p_organization_id uuid,
  p_confirmation_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org public.organizations%ROWTYPE;
  v_user_ids uuid[];
  v_establishment_ids uuid[];
  v_uid uuid;
  v_other_orgs integer;
  v_fk record;
  v_count integer;
  v_blocked boolean;
  v_progress boolean;
  v_pass integer;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  IF p_confirmation_name IS NULL OR btrim(p_confirmation_name) = '' THEN
    RAISE EXCEPTION 'Confirmation du nom exact de l''organisation obligatoire.';
  END IF;

  SELECT * INTO v_org
  FROM public.organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organisation introuvable.';
  END IF;

  IF btrim(p_confirmation_name) IS DISTINCT FROM btrim(v_org.name) THEN
    RAISE EXCEPTION 'Le nom saisi ne correspond pas à l''organisation.';
  END IF;

  SELECT coalesce(array_agg(DISTINCT om.user_id), ARRAY[]::uuid[])
  INTO v_user_ids
  FROM public.organization_memberships om
  WHERE om.organization_id = p_organization_id;

  SELECT coalesce(array_agg(e.id), ARRAY[]::uuid[])
  INTO v_establishment_ids
  FROM public.establishments e
  WHERE e.organization_id = p_organization_id;

  PERFORM public.write_platform_audit_log(
    'client.purged',
    p_organization_id,
    'organizations',
    p_organization_id,
    jsonb_build_object(
      'organization_name', v_org.name,
      'confirmed_name', p_confirmation_name,
      'member_count', coalesce(array_length(v_user_ids, 1), 0)
    ),
    v_actor
  );

  -- Passes successives : une table bloquée (RESTRICT) sera vidée au tour
  -- suivant, une fois les lignes qui la référencent supprimées.
  FOR v_pass IN 1..30 LOOP
    v_blocked := false;
    v_progress := false;

    FOR v_fk IN
      SELECT c.conrelid::pg_catalog.regclass AS tbl,
             a.attname AS col,
             c.confrelid = 'public.organizations'::pg_catalog.regclass AS by_org
      FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_attribute a
        ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f'
        AND c.confdeltype = 'c'
        AND pg_catalog.array_length(c.conkey, 1) = 1
        AND c.confrelid IN (
          'public.organizations'::pg_catalog.regclass,
          'public.establishments'::pg_catalog.regclass
        )
      ORDER BY c.conrelid::pg_catalog.regclass::text, a.attname
    LOOP
      BEGIN
        IF v_fk.by_org THEN
          EXECUTE pg_catalog.format('DELETE FROM %s WHERE %I = $1', v_fk.tbl, v_fk.col)
            USING p_organization_id;
        ELSE
          EXECUTE pg_catalog.format('DELETE FROM %s WHERE %I = ANY($1)', v_fk.tbl, v_fk.col)
            USING v_establishment_ids;
        END IF;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count > 0 THEN
          v_progress := true;
        END IF;
      EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN
        v_blocked := true;
      END;
    END LOOP;

    EXIT WHEN NOT v_blocked OR NOT v_progress;
  END LOOP;

  -- S'il reste une liaison bloquante, l'erreur remonte ici et tout est annulé.
  DELETE FROM public.organizations WHERE id = p_organization_id;

  -- Ne jamais désactiver un profil encore membre d'une autre org
  IF v_user_ids IS NOT NULL THEN
    FOREACH v_uid IN ARRAY v_user_ids LOOP
      SELECT count(*)::integer
      INTO v_other_orgs
      FROM public.organization_memberships om
      WHERE om.user_id = v_uid
        AND om.status = 'ACTIVE'::public.entity_status;

      IF v_other_orgs = 0
         AND NOT EXISTS (
           SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = v_uid
         ) THEN
        UPDATE public.profiles
        SET status = 'INACTIVE'::public.entity_status
        WHERE id = v_uid;
      END IF;
    END LOOP;
  END IF;

  RETURN p_organization_id;
END;
$$;

COMMENT ON FUNCTION public.purge_client_organization(uuid, text) IS
  'Purge définitive immédiate (Super Admin, nom exact). Supprime toutes les données du client.';

REVOKE ALL ON FUNCTION public.purge_client_organization(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_client_organization(uuid, text) TO authenticated;
