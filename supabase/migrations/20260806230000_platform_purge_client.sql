-- FasoBar: purge définitive d'un client (après fenêtre de récupération)
-- À appliquer manuellement. Ne pas exécuter automatiquement.
-- Dépend de 20260806210000_platform_control_plane_complete.sql

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
  v_state public.organization_platform_states%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_user_ids uuid[];
  v_uid uuid;
  v_other_orgs integer;
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

  SELECT * INTO v_state
  FROM public.organization_platform_states
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'État plateforme introuvable.';
  END IF;

  IF v_state.status IS DISTINCT FROM 'PENDING_DELETION'::public.organization_platform_status THEN
    RAISE EXCEPTION 'La purge n''est possible qu''en PENDING_DELETION.';
  END IF;

  IF v_state.deletion_purge_after IS NULL OR v_state.deletion_purge_after > now() THEN
    RAISE EXCEPTION 'Le délai de récupération n''est pas écoulé.';
  END IF;

  SELECT coalesce(array_agg(DISTINCT om.user_id), ARRAY[]::uuid[])
  INTO v_user_ids
  FROM public.organization_memberships om
  WHERE om.organization_id = p_organization_id;

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

  -- Cascade data plane + control plane via FK ON DELETE CASCADE sur organizations
  DELETE FROM public.organizations WHERE id = p_organization_id;

  -- Ne jamais supprimer un profil Auth encore membre d'une autre org
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
        -- Soft-disable profil local uniquement (Auth user conservé)
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
  'Purge définitive après PENDING_DELETION + délai. Confirmation nom exact. Super Admin only.';

REVOKE ALL ON FUNCTION public.purge_client_organization(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_client_organization(uuid, text) TO authenticated;
