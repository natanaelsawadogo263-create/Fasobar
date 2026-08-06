-- FasoBar: durcissement sécurité comptes employés
-- Correctif après 20260806180000_reconcile_employee_accounts.sql
-- À appliquer manuellement. Ne pas exécuter automatiquement.

-- ---------------------------------------------------------------------------
-- 1) Trigger credentials : uniquement bypass RPC (set_config)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_credential_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Seules les RPC SECURITY DEFINER qui appellent
  -- set_config('fasobar.profile_credential_update', 'on', true)
  -- peuvent modifier ces colonnes.
  IF coalesce(current_setting('fasobar.profile_credential_update', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
     OR NEW.credentials_created_at IS DISTINCT FROM OLD.credentials_created_at
     OR NEW.credentials_created_by IS DISTINCT FROM OLD.credentials_created_by
     OR NEW.password_changed_at IS DISTINCT FROM OLD.password_changed_at THEN
    RAISE EXCEPTION
      'Modification directe des champs credentials interdite. Utilisez les RPC FasoBar.';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) write_membership_audit_log : plus d'EXECUTE pour authenticated
--    (appel interne uniquement depuis RPC SECURITY DEFINER, owner = postgres)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.write_membership_audit_log(
  uuid, uuid, uuid, public.audit_action, uuid, jsonb
) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) provision_employee_account : acteur = auth.uid() uniquement ;
--    refus si le user appartient déjà à une autre organisation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.provision_employee_account(
  p_user_id uuid,
  p_organization_id uuid,
  p_establishment_id uuid,
  p_role public.membership_role,
  p_full_name text,
  p_phone text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
BEGIN
  -- p_created_by est ignoré volontairement (compat signature Server Action).
  -- Les permissions reposent uniquement sur la session authentifiée.
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF NOT public.user_is_organization_owner_or_admin(v_actor_id, p_organization_id) THEN
    RAISE EXCEPTION 'Permission insuffisante.';
  END IF;

  IF p_role = 'OWNER'::public.membership_role THEN
    RAISE EXCEPTION 'Impossible de créer un propriétaire via ce formulaire.';
  END IF;

  IF p_role NOT IN (
    'ADMIN'::public.membership_role,
    'CASHIER_KITCHEN'::public.membership_role,
    'BAR_MANAGER'::public.membership_role
  ) THEN
    RAISE EXCEPTION 'Rôle non autorisé pour un compte employé.';
  END IF;

  IF p_full_name IS NULL OR btrim(p_full_name) = '' THEN
    RAISE EXCEPTION 'Le nom complet est obligatoire.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = p_establishment_id
      AND e.organization_id = p_organization_id
      AND e.status = 'ACTIVE'::public.entity_status
  ) THEN
    RAISE EXCEPTION 'Établissement introuvable ou non autorisé.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Cet utilisateur appartient déjà à votre organisation.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = p_user_id
      AND om.organization_id <> p_organization_id
  ) THEN
    RAISE EXCEPTION 'Cet utilisateur appartient déjà à une autre organisation.';
  END IF;

  PERFORM set_config('fasobar.profile_credential_update', 'on', true);

  UPDATE public.profiles
  SET
    full_name = btrim(p_full_name),
    phone = NULLIF(btrim(COALESCE(p_phone, '')), ''),
    status = 'ACTIVE'::public.entity_status,
    must_change_password = true,
    credentials_created_at = now(),
    credentials_created_by = v_actor_id,
    password_changed_at = NULL,
    updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil utilisateur introuvable.';
  END IF;

  INSERT INTO public.organization_memberships (
    organization_id,
    user_id,
    role,
    status
  )
  VALUES (
    p_organization_id,
    p_user_id,
    p_role,
    'ACTIVE'::public.entity_status
  );

  INSERT INTO public.establishment_memberships (
    establishment_id,
    user_id,
    role,
    status
  )
  VALUES (
    p_establishment_id,
    p_user_id,
    p_role,
    'ACTIVE'::public.entity_status
  );

  PERFORM public.write_membership_audit_log(
    p_organization_id,
    p_establishment_id,
    p_user_id,
    'EMPLOYEE_ACCOUNT_CREATED'::public.audit_action,
    v_actor_id,
    jsonb_build_object(
      'role', p_role,
      'full_name', btrim(p_full_name)
    )
  );

  PERFORM public.write_membership_audit_log(
    p_organization_id,
    p_establishment_id,
    p_user_id,
    'EMPLOYEE_MEMBERSHIPS_CREATED'::public.audit_action,
    v_actor_id,
    jsonb_build_object('role', p_role)
  );

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'role', p_role,
    'organization_id', p_organization_id,
    'establishment_id', p_establishment_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Finalisation mot de passe : RPC server-only (service_role)
--    - complete_password_change() : désactivée pour authenticated
--    - finalize_employee_password_change(p_user_id) : appelée uniquement
--      par le Server Action via le client admin, après auth.updateUser réussi
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION
    'RPC désactivée. La finalisation du mot de passe est réservée au serveur FasoBar.';
END;
$$;

REVOKE ALL ON FUNCTION public.complete_password_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finalize_employee_password_change(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_est_id uuid;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Permission insuffisante.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Identifiant utilisateur requis.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.must_change_password = true
  ) THEN
    RAISE EXCEPTION 'Aucun changement de mot de passe requis.';
  END IF;

  PERFORM set_config('fasobar.profile_credential_update', 'on', true);

  UPDATE public.profiles
  SET
    must_change_password = false,
    password_changed_at = now(),
    updated_at = now()
  WHERE id = p_user_id
    AND must_change_password = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucun changement de mot de passe requis.';
  END IF;

  SELECT om.organization_id
  INTO v_org_id
  FROM public.organization_memberships om
  WHERE om.user_id = p_user_id
    AND om.status = 'ACTIVE'::public.entity_status
  LIMIT 1;

  SELECT em.establishment_id
  INTO v_est_id
  FROM public.establishment_memberships em
  WHERE em.user_id = p_user_id
    AND em.status = 'ACTIVE'::public.entity_status
  LIMIT 1;

  PERFORM public.write_membership_audit_log(
    v_org_id,
    v_est_id,
    p_user_id,
    'PERSONAL_PASSWORD_CREATED'::public.audit_action,
    p_user_id,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('user_id', p_user_id, 'must_change_password', false);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_employee_password_change(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_employee_password_change(uuid)
  TO service_role;

-- provision : grants authenticated inchangés
REVOKE ALL ON FUNCTION public.provision_employee_account(
  uuid, uuid, uuid, public.membership_role, text, text, uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.provision_employee_account(
  uuid, uuid, uuid, public.membership_role, text, text, uuid
) TO authenticated;
