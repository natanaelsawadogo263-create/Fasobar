-- FasoBar: désactivation / réactivation manuelle du compte OWNER (Admin client)
-- + retrait définitif d'un Super Admin
-- À appliquer manuellement. Ne pas exécuter automatiquement.
-- Dépend de platform_foundation + platform_control_plane_complete.

-- ---------------------------------------------------------------------------
-- Désactiver le compte OWNER d'une organisation cliente
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.deactivate_client_owner_account(
  p_organization_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_owner_id uuid;
  v_state public.organization_platform_states%ROWTYPE;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Motif de désactivation obligatoire.';
  END IF;

  SELECT om.user_id
  INTO v_owner_id
  FROM public.organization_memberships om
  WHERE om.organization_id = p_organization_id
    AND om.role = 'OWNER'::public.membership_role
    AND om.status = 'ACTIVE'::public.entity_status
  LIMIT 1
  FOR UPDATE;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'OWNER actif introuvable pour cette organisation.';
  END IF;

  -- Ne pas désactiver un Super Admin via ce parcours
  IF EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = v_owner_id
      AND pa.status = 'ACTIVE'::public.entity_status
  ) THEN
    RAISE EXCEPTION
      'Ce compte est aussi Super Admin. Désactivez-le depuis Super Admins.';
  END IF;

  UPDATE public.profiles
  SET status = 'INACTIVE'::public.entity_status
  WHERE id = v_owner_id
    AND status IS DISTINCT FROM 'INACTIVE'::public.entity_status;

  -- Coupe aussi l'accès SaaS organisation si pas déjà en suppression
  SELECT * INTO v_state
  FROM public.organization_platform_states
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF FOUND
     AND v_state.status IS DISTINCT FROM 'PENDING_DELETION'::public.organization_platform_status
     AND v_state.status IS DISTINCT FROM 'SUSPENDED'::public.organization_platform_status
  THEN
    PERFORM public.suspend_client_organization(
      p_organization_id,
      'Désactivation manuelle du compte OWNER : ' || btrim(p_reason)
    );
  END IF;

  PERFORM public.write_platform_audit_log(
    'client.owner_deactivated',
    p_organization_id,
    'profiles',
    v_owner_id,
    jsonb_build_object('reason', btrim(p_reason)),
    v_actor
  );

  RETURN v_owner_id;
END;
$$;

COMMENT ON FUNCTION public.deactivate_client_owner_account(uuid, text) IS
  'Super Admin : désactive le profil OWNER (INACTIVE) et suspend l''accès SaaS.';

-- ---------------------------------------------------------------------------
-- Réactiver le compte OWNER (profil uniquement ; SaaS via reactivate_client)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reactivate_client_owner_account(
  p_organization_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_owner_id uuid;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  SELECT om.user_id
  INTO v_owner_id
  FROM public.organization_memberships om
  WHERE om.organization_id = p_organization_id
    AND om.role = 'OWNER'::public.membership_role
  ORDER BY
    CASE WHEN om.status = 'ACTIVE'::public.entity_status THEN 0 ELSE 1 END,
    om.created_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'OWNER introuvable pour cette organisation.';
  END IF;

  UPDATE public.profiles
  SET status = 'ACTIVE'::public.entity_status
  WHERE id = v_owner_id;

  PERFORM public.write_platform_audit_log(
    'client.owner_reactivated',
    p_organization_id,
    'profiles',
    v_owner_id,
    jsonb_build_object('note', NULLIF(btrim(coalesce(p_note, '')), '')),
    v_actor
  );

  RETURN v_owner_id;
END;
$$;

COMMENT ON FUNCTION public.reactivate_client_owner_account(uuid, text) IS
  'Super Admin : réactive le profil OWNER. La levée SaaS reste une action séparée.';

-- ---------------------------------------------------------------------------
-- Retirer définitivement un Super Admin (hors dernière active)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.remove_platform_admin(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_id uuid;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id obligatoire.';
  END IF;

  IF p_user_id = v_actor THEN
    RAISE EXCEPTION 'Impossible de se retirer soi-même.';
  END IF;

  SELECT id INTO v_id
  FROM public.platform_admins
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Super Admin introuvable.';
  END IF;

  -- Le trigger prevent_last_active_platform_admin_removal protège le dernier actif
  DELETE FROM public.platform_admins
  WHERE id = v_id;

  PERFORM public.write_platform_audit_log(
    'platform_admin.removed',
    NULL,
    'platform_admins',
    v_id,
    jsonb_build_object('user_id', p_user_id),
    v_actor
  );

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.remove_platform_admin(uuid) IS
  'Super Admin : retire définitivement un autre Super Admin (jamais le dernier actif).';

REVOKE ALL ON FUNCTION public.deactivate_client_owner_account(uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_client_owner_account(uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_platform_admin(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.deactivate_client_owner_account(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_client_owner_account(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_platform_admin(uuid)
  TO authenticated;
