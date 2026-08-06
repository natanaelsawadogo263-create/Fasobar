-- FasoBar Phase 0 — Réconciliation comptes employés
-- Aligne le schéma tracké sur le code applicatif (utilisateurs / première connexion).
-- Idempotente : ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS.
-- À appliquer manuellement. Ne pas exécuter automatiquement.

-- ---------------------------------------------------------------------------
-- Enums d'audit (employés)
-- ---------------------------------------------------------------------------

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'EMPLOYEE_ACCOUNT_CREATED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'EMPLOYEE_MEMBERSHIPS_CREATED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'TEMPORARY_PASSWORD_RESET';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'PERSONAL_PASSWORD_CREATED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'EMPLOYEE_CREATION_COMPENSATED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'USER_DEACTIVATED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'USER_REACTIVATED';

-- Déjà présent via 20260806130000 ; IF NOT EXISTS pour bases partielles.
ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'CASHIER_KITCHEN';

-- ---------------------------------------------------------------------------
-- Colonnes profiles manquantes
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credentials_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS credentials_created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_must_change_password_idx
  ON public.profiles (must_change_password)
  WHERE must_change_password = true;

-- ---------------------------------------------------------------------------
-- Protection des champs credentials (bypass via set_config dans les RPC)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_credential_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(current_setting('fasobar.profile_credential_update', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Un admin qui met à jour un autre profil n'est pas bloqué ici
  -- (les RPC SECURITY DEFINER contrôlent les droits).
  IF NEW.id <> auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    RAISE EXCEPTION 'Modification non autorisée du statut de mot de passe.';
  END IF;

  IF NEW.credentials_created_at IS DISTINCT FROM OLD.credentials_created_at THEN
    RAISE EXCEPTION 'Modification non autorisée des métadonnées de création.';
  END IF;

  IF NEW.credentials_created_by IS DISTINCT FROM OLD.credentials_created_by THEN
    RAISE EXCEPTION 'Modification non autorisée des métadonnées de création.';
  END IF;

  IF NEW.password_changed_at IS DISTINCT FROM OLD.password_changed_at THEN
    RAISE EXCEPTION 'Modification non autorisée de la date de changement de mot de passe.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_credential_fields ON public.profiles;

CREATE TRIGGER profiles_protect_credential_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_credential_fields();

-- ---------------------------------------------------------------------------
-- RLS : les OWNER/ADMIN lisent les profils des membres de leur organisation
-- (y compris inactifs — page Utilisateurs).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS profiles_select_org_admin ON public.profiles;

CREATE POLICY profiles_select_org_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships om_target
      INNER JOIN public.organization_memberships om_actor
        ON om_actor.organization_id = om_target.organization_id
      WHERE om_target.user_id = profiles.id
        AND om_actor.user_id = (SELECT auth.uid())
        AND om_actor.status = 'ACTIVE'::public.entity_status
        AND public.user_is_organization_owner_or_admin(
          (SELECT auth.uid()),
          om_actor.organization_id
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Helper audit membership
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.write_membership_audit_log(
  p_organization_id uuid,
  p_establishment_id uuid,
  p_entity_id uuid,
  p_action public.audit_action,
  p_actor_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_establishment_id uuid := p_establishment_id;
BEGIN
  IF p_organization_id IS NULL OR p_actor_id IS NULL OR p_entity_id IS NULL THEN
    RETURN;
  END IF;

  IF v_establishment_id IS NULL THEN
    SELECT e.id
    INTO v_establishment_id
    FROM public.establishments e
    WHERE e.organization_id = p_organization_id
    ORDER BY e.created_at
    LIMIT 1;
  END IF;

  IF v_establishment_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_logs (
    organization_id,
    establishment_id,
    entity_type,
    entity_id,
    action,
    actor_id,
    metadata
  )
  VALUES (
    p_organization_id,
    v_establishment_id,
    'membership',
    p_entity_id,
    p_action,
    p_actor_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: provision_employee_account
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
  v_actor_id := COALESCE(p_created_by, auth.uid());

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
-- RPC: complete_password_change
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_est_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_user_id
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
  WHERE id = v_user_id;

  SELECT om.organization_id
  INTO v_org_id
  FROM public.organization_memberships om
  WHERE om.user_id = v_user_id
    AND om.status = 'ACTIVE'::public.entity_status
  LIMIT 1;

  SELECT em.establishment_id
  INTO v_est_id
  FROM public.establishment_memberships em
  WHERE em.user_id = v_user_id
    AND em.status = 'ACTIVE'::public.entity_status
  LIMIT 1;

  PERFORM public.write_membership_audit_log(
    v_org_id,
    v_est_id,
    v_user_id,
    'PERSONAL_PASSWORD_CREATED'::public.audit_action,
    v_user_id,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('user_id', v_user_id, 'must_change_password', false);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: mark_temporary_password_reset
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_temporary_password_reset(
  p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_org_id uuid;
  v_est_id uuid;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT om.organization_id
  INTO v_org_id
  FROM public.organization_memberships om
  WHERE om.user_id = p_target_user_id
    AND om.status = 'ACTIVE'::public.entity_status
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable dans votre organisation.';
  END IF;

  IF NOT public.user_is_organization_owner_or_admin(v_actor_id, v_org_id) THEN
    RAISE EXCEPTION 'Permission insuffisante.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = p_target_user_id
      AND om.organization_id = v_org_id
      AND om.role = 'OWNER'::public.membership_role
  ) THEN
    RAISE EXCEPTION 'Impossible de réinitialiser le mot de passe d''un propriétaire.';
  END IF;

  PERFORM set_config('fasobar.profile_credential_update', 'on', true);

  UPDATE public.profiles
  SET
    must_change_password = true,
    credentials_created_at = now(),
    credentials_created_by = v_actor_id,
    password_changed_at = NULL,
    updated_at = now()
  WHERE id = p_target_user_id;

  SELECT em.establishment_id
  INTO v_est_id
  FROM public.establishment_memberships em
  INNER JOIN public.establishments e ON e.id = em.establishment_id
  WHERE em.user_id = p_target_user_id
    AND e.organization_id = v_org_id
  LIMIT 1;

  PERFORM public.write_membership_audit_log(
    v_org_id,
    v_est_id,
    p_target_user_id,
    'TEMPORARY_PASSWORD_RESET'::public.audit_action,
    v_actor_id,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('user_id', p_target_user_id, 'must_change_password', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: log_employee_creation_compensated
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_employee_creation_compensated(
  p_user_id uuid,
  p_organization_id uuid,
  p_establishment_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.user_is_organization_owner_or_admin(v_actor_id, p_organization_id) THEN
    RETURN;
  END IF;

  PERFORM public.write_membership_audit_log(
    p_organization_id,
    p_establishment_id,
    p_user_id,
    'EMPLOYEE_CREATION_COMPENSATED'::public.audit_action,
    v_actor_id,
    jsonb_build_object('reason', NULLIF(btrim(COALESCE(p_reason, '')), ''))
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: set_member_active_status
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_member_active_status(
  p_target_user_id uuid,
  p_active boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_org_id uuid;
  v_est_id uuid;
  v_target_org_role public.membership_role;
  v_active_owner_count integer;
  v_new_status public.entity_status;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT om.organization_id, om.role
  INTO v_org_id, v_target_org_role
  FROM public.organization_memberships om
  WHERE om.user_id = p_target_user_id
    AND om.status = 'ACTIVE'::public.entity_status
  LIMIT 1;

  IF v_org_id IS NULL THEN
    SELECT om.organization_id, om.role
    INTO v_org_id, v_target_org_role
    FROM public.organization_memberships om
    WHERE om.user_id = p_target_user_id
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable dans votre organisation.';
  END IF;

  IF NOT public.user_is_organization_owner_or_admin(v_actor_id, v_org_id) THEN
    RAISE EXCEPTION 'Permission insuffisante.';
  END IF;

  IF p_target_user_id = v_actor_id AND NOT p_active THEN
    SELECT count(*)::integer
    INTO v_active_owner_count
    FROM public.organization_memberships om
    WHERE om.organization_id = v_org_id
      AND om.role = 'OWNER'::public.membership_role
      AND om.status = 'ACTIVE'::public.entity_status;

    IF v_target_org_role = 'OWNER'::public.membership_role AND v_active_owner_count <= 1 THEN
      RAISE EXCEPTION 'Impossible de désactiver le dernier propriétaire actif.';
    END IF;
  END IF;

  IF v_target_org_role = 'OWNER'::public.membership_role AND NOT p_active THEN
    SELECT count(*)::integer
    INTO v_active_owner_count
    FROM public.organization_memberships om
    WHERE om.organization_id = v_org_id
      AND om.role = 'OWNER'::public.membership_role
      AND om.status = 'ACTIVE'::public.entity_status
      AND om.user_id <> p_target_user_id;

    IF v_active_owner_count < 1 THEN
      RAISE EXCEPTION 'Impossible de désactiver le dernier propriétaire actif.';
    END IF;
  END IF;

  v_new_status := CASE
    WHEN p_active THEN 'ACTIVE'::public.entity_status
    ELSE 'INACTIVE'::public.entity_status
  END;

  UPDATE public.profiles
  SET status = v_new_status, updated_at = now()
  WHERE id = p_target_user_id;

  UPDATE public.organization_memberships
  SET status = v_new_status, updated_at = now()
  WHERE organization_id = v_org_id
    AND user_id = p_target_user_id;

  UPDATE public.establishment_memberships em
  SET status = v_new_status, updated_at = now()
  FROM public.establishments e
  WHERE em.establishment_id = e.id
    AND e.organization_id = v_org_id
    AND em.user_id = p_target_user_id;

  SELECT e.id
  INTO v_est_id
  FROM public.establishment_memberships em
  INNER JOIN public.establishments e ON e.id = em.establishment_id
  WHERE em.user_id = p_target_user_id
    AND e.organization_id = v_org_id
  LIMIT 1;

  PERFORM public.write_membership_audit_log(
    v_org_id,
    v_est_id,
    p_target_user_id,
    CASE
      WHEN p_active THEN 'USER_REACTIVATED'::public.audit_action
      ELSE 'USER_DEACTIVATED'::public.audit_action
    END,
    v_actor_id,
    jsonb_build_object('reason', NULLIF(btrim(COALESCE(p_reason, '')), ''))
  );

  RETURN jsonb_build_object('user_id', p_target_user_id, 'active', p_active);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.write_membership_audit_log(uuid, uuid, uuid, public.audit_action, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provision_employee_account(uuid, uuid, uuid, public.membership_role, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_password_change() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_temporary_password_reset(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_employee_creation_compensated(uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_member_active_status(uuid, boolean, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.write_membership_audit_log(uuid, uuid, uuid, public.audit_action, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.provision_employee_account(uuid, uuid, uuid, public.membership_role, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_temporary_password_reset(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_employee_creation_compensated(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_active_status(uuid, boolean, text) TO authenticated;
