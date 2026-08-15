-- Super Admin : suppression définitive d'un membre d'organisation (hors OWNER).

CREATE OR REPLACE FUNCTION public.purge_org_member_as_platform(
  p_organization_id uuid,
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
  v_target_role public.membership_role;
  v_remaining integer;
BEGIN
  v_actor_id := auth.uid();

  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  IF p_organization_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Organisation ou utilisateur introuvable.';
  END IF;

  IF p_target_user_id = v_actor_id THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte.';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Le motif de suppression est obligatoire.';
  END IF;

  SELECT om.role
  INTO v_target_role
  FROM public.organization_memberships om
  WHERE om.user_id = p_target_user_id
    AND om.organization_id = p_organization_id
  LIMIT 1;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Compte introuvable dans cette organisation.';
  END IF;

  IF v_target_role = 'OWNER'::public.membership_role THEN
    RAISE EXCEPTION 'Impossible de supprimer le propriétaire. Désactivez le compte Admin (OWNER).';
  END IF;

  DELETE FROM public.establishment_memberships em
  USING public.establishments e
  WHERE em.user_id = p_target_user_id
    AND em.establishment_id = e.id
    AND e.organization_id = p_organization_id;

  DELETE FROM public.organization_memberships om
  WHERE om.user_id = p_target_user_id
    AND om.organization_id = p_organization_id;

  SELECT count(*)::integer
  INTO v_remaining
  FROM public.organization_memberships om
  WHERE om.user_id = p_target_user_id;

  IF v_remaining = 0 THEN
    UPDATE public.profiles
    SET
      login_identifier = NULL,
      login_identifier_normalized = NULL,
      status = 'INACTIVE'::public.entity_status,
      must_change_password = true,
      updated_at = now()
    WHERE id = p_target_user_id;
  END IF;

  PERFORM public.write_platform_audit_log(
    'organization_member.purged',
    p_organization_id,
    'profiles',
    p_target_user_id,
    jsonb_build_object(
      'role', v_target_role,
      'reason', btrim(p_reason)
    ),
    v_actor_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'organization_id', p_organization_id,
    'auth_purge', v_remaining = 0,
    'role', v_target_role,
    'reason', btrim(p_reason)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_org_member_as_platform(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_org_member_as_platform(uuid, uuid, text)
  TO authenticated;

COMMENT ON FUNCTION public.purge_org_member_as_platform(uuid, uuid, text) IS
  'Super Admin : retire définitivement un Admin / employé (hors OWNER) d’une organisation.';
