-- Suppression définitive d'un employé (hors propriétaire) : memberships retirés,
-- identifiant libéré. L'historique (commandes, paiements) est conservé.

CREATE OR REPLACE FUNCTION public.purge_employee_account(
  p_target_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_org_id uuid;
  v_target_role public.membership_role;
  v_remaining integer;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Employé introuvable.';
  END IF;

  IF p_target_user_id = v_actor_id THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte.';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Le motif de suppression est obligatoire.';
  END IF;

  SELECT om.organization_id, om.role
  INTO v_org_id, v_target_role
  FROM public.organization_memberships om
  WHERE om.user_id = p_target_user_id
    AND om.organization_id IN (
      SELECT actor.organization_id
      FROM public.organization_memberships actor
      WHERE actor.user_id = v_actor_id
        AND actor.status = 'ACTIVE'::public.entity_status
        AND actor.role IN (
          'OWNER'::public.membership_role,
          'ADMIN'::public.membership_role
        )
    )
  ORDER BY CASE WHEN om.status = 'ACTIVE'::public.entity_status THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Employé introuvable dans votre organisation.';
  END IF;

  IF NOT public.user_is_organization_owner_or_admin(v_actor_id, v_org_id) THEN
    RAISE EXCEPTION 'Permission insuffisante.';
  END IF;

  IF v_target_role = 'OWNER'::public.membership_role THEN
    RAISE EXCEPTION 'Impossible de supprimer le compte propriétaire.';
  END IF;

  DELETE FROM public.establishment_memberships em
  USING public.establishments e
  WHERE em.user_id = p_target_user_id
    AND em.establishment_id = e.id
    AND e.organization_id = v_org_id;

  DELETE FROM public.organization_memberships om
  WHERE om.user_id = p_target_user_id
    AND om.organization_id = v_org_id;

  SELECT count(*)::integer
  INTO v_remaining
  FROM public.organization_memberships om
  WHERE om.user_id = p_target_user_id;

  IF v_remaining = 0 THEN
    PERFORM set_config('fasobar.profile_credential_update', 'on', true);
    UPDATE public.profiles
    SET
      login_identifier = NULL,
      login_identifier_normalized = NULL,
      status = 'INACTIVE'::public.entity_status,
      must_change_password = true,
      updated_at = now()
    WHERE id = p_target_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'organization_id', v_org_id,
    'auth_purge', v_remaining = 0,
    'reason', btrim(p_reason)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_employee_account(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_employee_account(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.purge_employee_account(uuid, text) IS
  'Retire définitivement un employé de l’organisation et libère son identifiant FasoBar.';
