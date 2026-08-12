-- FasoBar Desktop Phase 3A — login_identifier + credential_version + sync roster
-- Ne pas modifier les migrations déjà appliquées.

-- ---------------------------------------------------------------------------
-- 1) Colonnes profil
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS login_identifier text,
  ADD COLUMN IF NOT EXISTS login_identifier_normalized text,
  ADD COLUMN IF NOT EXISTS credential_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS permissions_version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.profiles.login_identifier IS
  'Identifiant FasoBar personnel (affichage). Auth email interne = {normalized}@users.fasobar.internal pour les nouveaux comptes.';
COMMENT ON COLUMN public.profiles.login_identifier_normalized IS
  'Forme normalisée (minuscules) pour unicité et lookup.';
COMMENT ON COLUMN public.profiles.credential_version IS
  'Incrémenté à chaque changement/reset de mot de passe. Invalide les verifiers offline locaux.';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_login_identifier_normalized_uidx
  ON public.profiles (login_identifier_normalized)
  WHERE login_identifier_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_credential_version_idx
  ON public.profiles (credential_version);

-- ---------------------------------------------------------------------------
-- 2) Helper normalisation (SQL)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_login_identifier(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  -- Ordre critique : lower() AVANT le filtre de caractères.
  -- Sinon [a-z] supprimerait les majuscules (ex. "Awa" → "wa").
  -- Les caractères hors [a-z0-9._-] (accents inclus) sont retirés ;
  -- l’appelant applicatif doit envoyer une forme déjà ASCII quand possible.
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        lower(btrim(COALESCE(p_raw, ''))),
        '\s+',
        '',
        'g'
      ),
      '[^a-z0-9._-]',
      '',
      'g'
    ),
    ''
  );
$$;

REVOKE ALL ON FUNCTION public.normalize_login_identifier(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_login_identifier(text) TO authenticated, service_role;

-- Garantit que la colonne d’unicité ne contient que de l’ASCII autorisé
-- (évite des formes « normalisées » ambiguës / non saisissables).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_login_identifier_normalized_format_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_login_identifier_normalized_format_chk
  CHECK (
    login_identifier_normalized IS NULL
    OR (
      char_length(login_identifier_normalized) BETWEEN 3 AND 64
      AND login_identifier_normalized ~ '^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$'
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Trigger credentials : inclure login_identifier + credential_version
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

  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
     OR NEW.credentials_created_at IS DISTINCT FROM OLD.credentials_created_at
     OR NEW.credentials_created_by IS DISTINCT FROM OLD.credentials_created_by
     OR NEW.password_changed_at IS DISTINCT FROM OLD.password_changed_at
     OR NEW.credential_version IS DISTINCT FROM OLD.credential_version
     OR NEW.permissions_version IS DISTINCT FROM OLD.permissions_version
     OR NEW.login_identifier IS DISTINCT FROM OLD.login_identifier
     OR NEW.login_identifier_normalized IS DISTINCT FROM OLD.login_identifier_normalized THEN
    RAISE EXCEPTION
      'Modification directe des champs credentials interdite. Utilisez les RPC FasoBar.';
  END IF;

  -- Empêche un utilisateur de se réactiver / se désactiver via UPDATE direct
  -- (les RPC admin peuvent toujours modifier le status d'un autre profil).
  IF auth.uid() IS NOT NULL
     AND NEW.id = auth.uid()
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION
      'Modification directe du statut de profil interdite. Utilisez les RPC FasoBar.';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) provision_employee_account — login_identifier requis
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.provision_employee_account(
  p_user_id uuid,
  p_organization_id uuid,
  p_establishment_id uuid,
  p_role public.membership_role,
  p_full_name text,
  p_phone text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_login_identifier text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_login text;
  v_login_norm text;
BEGIN
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

  v_login_norm := public.normalize_login_identifier(p_login_identifier);
  IF v_login_norm IS NULL THEN
    RAISE EXCEPTION 'Identifiant FasoBar obligatoire.';
  END IF;

  IF length(v_login_norm) < 3 OR length(v_login_norm) > 64 THEN
    RAISE EXCEPTION 'Identifiant FasoBar invalide (3–64 caractères).';
  END IF;

  -- Refuse les entrées accentuées / hors charset qui divergeraient de la
  -- normalisation applicative (NFD → ASCII). Exige déjà la forme canonique.
  IF regexp_replace(lower(btrim(COALESCE(p_login_identifier, ''))), '\s+', '', 'g')
     IS DISTINCT FROM v_login_norm THEN
    RAISE EXCEPTION
      'Identifiant FasoBar invalide : utilisez uniquement a-z, 0-9, point, tiret et underscore.';
  END IF;

  IF v_login_norm !~ '^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$' THEN
    RAISE EXCEPTION 'Identifiant FasoBar invalide.';
  END IF;

  v_login := v_login_norm;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.login_identifier_normalized = v_login_norm
      AND p.id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'Cet identifiant FasoBar est déjà utilisé.';
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
    login_identifier = v_login,
    login_identifier_normalized = v_login_norm,
    credential_version = 1,
    permissions_version = 1,
    updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil utilisateur introuvable.';
  END IF;

  INSERT INTO public.organization_memberships (
    organization_id, user_id, role, status
  )
  VALUES (
    p_organization_id, p_user_id, p_role, 'ACTIVE'::public.entity_status
  );

  INSERT INTO public.establishment_memberships (
    establishment_id, user_id, role, status
  )
  VALUES (
    p_establishment_id, p_user_id, p_role, 'ACTIVE'::public.entity_status
  );

  PERFORM public.write_membership_audit_log(
    p_organization_id,
    p_establishment_id,
    p_user_id,
    'EMPLOYEE_ACCOUNT_CREATED'::public.audit_action,
    v_actor_id,
    jsonb_build_object(
      'role', p_role,
      'full_name', btrim(p_full_name),
      'login_identifier', v_login
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
    'establishment_id', p_establishment_id,
    'login_identifier', v_login
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provision_employee_account(
  uuid, uuid, uuid, public.membership_role, text, text, uuid, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.provision_employee_account(
  uuid, uuid, uuid, public.membership_role, text, text, uuid, text
) TO authenticated;

-- Ancienne signature 7 args : redirige vers la nouvelle (login obligatoire via NULL → erreur claire)
DROP FUNCTION IF EXISTS public.provision_employee_account(
  uuid, uuid, uuid, public.membership_role, text, text, uuid
);

-- ---------------------------------------------------------------------------
-- 5) finalize_employee_password_change — incrément credential_version
-- ---------------------------------------------------------------------------

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
  v_version integer;
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
    credential_version = COALESCE(credential_version, 1) + 1,
    updated_at = now()
  WHERE id = p_user_id
    AND must_change_password = true
  RETURNING credential_version INTO v_version;

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
    jsonb_build_object('credential_version', v_version)
  );

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'must_change_password', false,
    'credential_version', v_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_employee_password_change(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_employee_password_change(uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 6) mark_temporary_password_reset — incrément credential_version
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
  v_version integer;
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
    credential_version = COALESCE(credential_version, 1) + 1,
    updated_at = now()
  WHERE id = p_target_user_id
  RETURNING credential_version INTO v_version;

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
    jsonb_build_object('credential_version', v_version)
  );

  RETURN jsonb_build_object(
    'user_id', p_target_user_id,
    'must_change_password', true,
    'credential_version', v_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_temporary_password_reset(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mark_temporary_password_reset(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) Roster sync établissement (authentifié, sans secrets / emails)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_establishment_users_for_sync(
  p_establishment_id uuid
)
RETURNS TABLE (
  user_id uuid,
  organization_id uuid,
  establishment_id uuid,
  login_identifier text,
  display_name text,
  role public.membership_role,
  status public.entity_status,
  credential_version integer,
  permissions_version integer,
  must_change_password boolean,
  organization_name text,
  establishment_name text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_org uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT e.organization_id INTO v_org
  FROM public.establishments e
  WHERE e.id = p_establishment_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Établissement introuvable.';
  END IF;

  -- Acteur doit être membre ACTIVE de cet établissement (ou owner/admin org)
  IF NOT (
    public.user_is_organization_owner_or_admin(v_actor, v_org)
    OR EXISTS (
      SELECT 1
      FROM public.establishment_memberships em
      WHERE em.establishment_id = p_establishment_id
        AND em.user_id = v_actor
        AND em.status = 'ACTIVE'::public.entity_status
    )
  ) THEN
    RAISE EXCEPTION 'Permission insuffisante.';
  END IF;

  RETURN QUERY
  SELECT
    em.user_id,
    e.organization_id,
    em.establishment_id,
    p.login_identifier,
    COALESCE(p.full_name, '')::text AS display_name,
    em.role,
    CASE
      WHEN p.status = 'ACTIVE'::public.entity_status
       AND em.status = 'ACTIVE'::public.entity_status
       AND om.status = 'ACTIVE'::public.entity_status
      THEN 'ACTIVE'::public.entity_status
      ELSE 'INACTIVE'::public.entity_status
    END AS status,
    COALESCE(p.credential_version, 1),
    COALESCE(p.permissions_version, 1),
    COALESCE(p.must_change_password, false),
    o.name::text AS organization_name,
    e.name::text AS establishment_name,
    GREATEST(p.updated_at, em.updated_at, om.updated_at) AS updated_at
  FROM public.establishment_memberships em
  INNER JOIN public.establishments e ON e.id = em.establishment_id
  INNER JOIN public.organizations o ON o.id = e.organization_id
  INNER JOIN public.profiles p ON p.id = em.user_id
  INNER JOIN public.organization_memberships om
    ON om.user_id = em.user_id
   AND om.organization_id = e.organization_id
  WHERE em.establishment_id = p_establishment_id
    AND em.role <> 'OWNER'::public.membership_role
    AND p.login_identifier_normalized IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.list_establishment_users_for_sync(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_establishment_users_for_sync(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) bump_own_credential_version — après changement de mot de passe Auth
--    (reset email / nouveau-mot-de-passe). Pas d'usurpation : auth.uid() only.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bump_own_credential_version()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_version integer;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  PERFORM set_config('fasobar.profile_credential_update', 'on', true);

  UPDATE public.profiles
  SET
    credential_version = COALESCE(credential_version, 1) + 1,
    password_changed_at = now(),
    updated_at = now()
  WHERE id = v_uid
  RETURNING credential_version INTO v_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil utilisateur introuvable.';
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_uid,
    'credential_version', v_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bump_own_credential_version()
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.bump_own_credential_version()
  TO authenticated;

COMMENT ON FUNCTION public.bump_own_credential_version() IS
  'Incrémente credential_version du profil de l''appelant après un changement de mot de passe Auth (hors finalize_employee_password_change).';
