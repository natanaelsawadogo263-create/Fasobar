-- FasoBar: socle Super Admin / control plane (Phase 1B foundation)
-- À appliquer manuellement. Ne pas exécuter automatiquement.
--
-- Ne modifie PAS organizations.status (entity_status ACTIVE/INACTIVE).
-- bootstrap_organization n'est pas réécrit : un trigger AFTER INSERT
-- crée automatiquement organization_platform_states (PENDING_CHOICE).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

CREATE TYPE public.organization_platform_status AS ENUM (
  'PENDING_CHOICE',
  'TRIAL',
  'TRIAL_EXPIRED',
  'ACTIVE',
  'EXPIRED',
  'SUSPENDED',
  'PENDING_DELETION'
);

CREATE TYPE public.subscription_billing_period AS ENUM (
  'MONTHLY',
  'YEARLY'
);

CREATE TYPE public.platform_trial_status AS ENUM (
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
  'CONVERTED'
);

-- ---------------------------------------------------------------------------
-- 1) platform_admins
-- ---------------------------------------------------------------------------

CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_admins_user_id_key UNIQUE (user_id)
);

CREATE INDEX platform_admins_status_idx ON public.platform_admins (status);

CREATE TRIGGER platform_admins_set_updated_at
  BEFORE UPDATE ON public.platform_admins
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper: Super Admin actif (SECURITY DEFINER, search_path vide)
-- ---------------------------------------------------------------------------

-- Session JWT : ignore p_user_id et ne teste que auth.uid() (pas de sonde UUID).
-- service_role (auth.uid() NULL) : peut passer p_user_id pour un check server-only.
CREATE OR REPLACE FUNCTION public.is_active_platform_admin(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = CASE
      WHEN auth.uid() IS NOT NULL THEN auth.uid()
      ELSE p_user_id
    END
      AND pa.status = 'ACTIVE'::public.entity_status
  );
$$;

COMMENT ON FUNCTION public.is_active_platform_admin(uuid) IS
  'JWT: true si auth.uid() est Super Admin actif (p_user_id ignoré). '
  'service_role: true si p_user_id est Super Admin actif.';

-- Interdit l'auto-promotion et l'auto-modification de statut Super Admin.
CREATE OR REPLACE FUNCTION public.prevent_platform_admin_self_elevation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  -- Sessions JWT : aucun utilisateur ne peut s'ajouter / s'activer lui-même.
  -- auth.uid() NULL (service_role / SQL console) autorise le bootstrap initial.
  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.user_id = v_actor THEN
    RAISE EXCEPTION
      'Auto-promotion Super Admin interdite. Un autre Super Admin ou le service rôle doit créer le compte.';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.user_id = v_actor
     AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
     ) THEN
    RAISE EXCEPTION
      'Un Super Admin ne peut pas modifier son propre statut ou rattachement.';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.user_id = v_actor
     AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION
      'Impossible de se rattacher soi-même comme Super Admin.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER platform_admins_prevent_self_elevation
  BEFORE INSERT OR UPDATE ON public.platform_admins
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_platform_admin_self_elevation();

-- Empêche de supprimer / désactiver le dernier Super Admin actif (y compris concurrence).
CREATE OR REPLACE FUNCTION public.prevent_last_active_platform_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_other_active integer;
BEGIN
  -- Sérialise les changements sur le pool des Super Admins actifs.
  PERFORM 1
  FROM public.platform_admins
  WHERE status = 'ACTIVE'::public.entity_status
  FOR UPDATE;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'ACTIVE'::public.entity_status THEN
      SELECT count(*)::integer
      INTO v_other_active
      FROM public.platform_admins
      WHERE status = 'ACTIVE'::public.entity_status
        AND id IS DISTINCT FROM OLD.id;

      IF v_other_active = 0 THEN
        RAISE EXCEPTION
          'Impossible de supprimer le dernier Super Admin actif.';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'ACTIVE'::public.entity_status
     AND NEW.status IS DISTINCT FROM 'ACTIVE'::public.entity_status THEN
    SELECT count(*)::integer
    INTO v_other_active
    FROM public.platform_admins
    WHERE status = 'ACTIVE'::public.entity_status
      AND id IS DISTINCT FROM OLD.id;

    IF v_other_active = 0 THEN
      RAISE EXCEPTION
        'Impossible de désactiver le dernier Super Admin actif.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER platform_admins_prevent_last_active_removal
  BEFORE UPDATE OR DELETE ON public.platform_admins
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_active_platform_admin_removal();

-- ---------------------------------------------------------------------------
-- 2) organization_platform_states (1–1, jamais sur organizations.status)
-- ---------------------------------------------------------------------------

CREATE TABLE public.organization_platform_states (
  organization_id uuid PRIMARY KEY
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  status public.organization_platform_status NOT NULL DEFAULT 'PENDING_CHOICE',
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  billing_phone text,
  primary_owner_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  previous_status public.organization_platform_status,
  deletion_requested_at timestamptz,
  deletion_purge_after timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_platform_states_deletion_window_check CHECK (
    (
      status <> 'PENDING_DELETION'::public.organization_platform_status
      AND deletion_requested_at IS NULL
      AND deletion_purge_after IS NULL
    )
    OR (
      status = 'PENDING_DELETION'::public.organization_platform_status
      AND deletion_requested_at IS NOT NULL
      AND deletion_purge_after IS NOT NULL
      AND deletion_purge_after >= deletion_requested_at
    )
  )
);

CREATE INDEX organization_platform_states_status_idx
  ON public.organization_platform_states (status);
CREATE INDEX organization_platform_states_primary_owner_user_id_idx
  ON public.organization_platform_states (primary_owner_user_id);
CREATE INDEX organization_platform_states_purge_idx
  ON public.organization_platform_states (deletion_purge_after)
  WHERE status = 'PENDING_DELETION'::public.organization_platform_status;

CREATE TRIGGER organization_platform_states_set_updated_at
  BEFORE UPDATE ON public.organization_platform_states
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_organization_platform_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.previous_status := OLD.status;
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER organization_platform_states_sync_status_transition
  BEFORE UPDATE ON public.organization_platform_states
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_organization_platform_status_transition();

-- primary_owner_user_id doit être OWNER ACTIVE de la même organisation.
CREATE OR REPLACE FUNCTION public.validate_organization_platform_primary_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.primary_owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = NEW.organization_id
      AND om.user_id = NEW.primary_owner_user_id
      AND om.role = 'OWNER'::public.membership_role
      AND om.status = 'ACTIVE'::public.entity_status
  ) THEN
    RAISE EXCEPTION
      'primary_owner_user_id doit référencer un membership OWNER ACTIVE de cette organisation.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER organization_platform_states_validate_primary_owner
  BEFORE INSERT OR UPDATE OF primary_owner_user_id, organization_id
  ON public.organization_platform_states
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_organization_platform_primary_owner();

-- Création auto PENDING_CHOICE (compatible bootstrap_organization SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.create_organization_platform_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.organization_platform_states (organization_id, status)
  VALUES (
    NEW.id,
    'PENDING_CHOICE'::public.organization_platform_status
  )
  ON CONFLICT (organization_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_create_platform_state
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.create_organization_platform_state();

-- Backfill orgs existantes (sans toucher organizations.status)
INSERT INTO public.organization_platform_states (organization_id, status)
SELECT o.id, 'PENDING_CHOICE'::public.organization_platform_status
FROM public.organizations o
ON CONFLICT (organization_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) subscription_plans
-- ---------------------------------------------------------------------------

CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  billing_period public.subscription_billing_period NOT NULL,
  duration_months integer NOT NULL,
  price_xof integer NOT NULL,
  currency text NOT NULL DEFAULT 'XOF',
  max_machines integer NOT NULL DEFAULT 1,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plans_code_not_blank CHECK (btrim(code) <> ''),
  CONSTRAINT subscription_plans_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT subscription_plans_code_format CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT subscription_plans_duration_positive CHECK (duration_months > 0),
  CONSTRAINT subscription_plans_price_non_negative CHECK (price_xof >= 0),
  CONSTRAINT subscription_plans_max_machines_positive CHECK (max_machines > 0),
  CONSTRAINT subscription_plans_currency_xof CHECK (currency = 'XOF')
);

CREATE UNIQUE INDEX subscription_plans_code_key ON public.subscription_plans (code);
CREATE INDEX subscription_plans_active_sort_idx
  ON public.subscription_plans (is_active, sort_order);

CREATE TRIGGER subscription_plans_set_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.subscription_plans (
  code,
  name,
  description,
  billing_period,
  duration_months,
  price_xof,
  max_machines,
  features,
  is_active,
  sort_order
)
VALUES
  (
    'MONTHLY',
    'Mensuel',
    'Abonnement FasoBar — 1 mois',
    'MONTHLY'::public.subscription_billing_period,
    1,
    10000,
    1,
    '{"label":"monthly"}'::jsonb,
    true,
    10
  ),
  (
    'YEARLY',
    'Annuel',
    'Abonnement FasoBar — 12 mois',
    'YEARLY'::public.subscription_billing_period,
    12,
    100000,
    1,
    '{"label":"yearly"}'::jsonb,
    true,
    20
  )
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) organization_trials
-- ---------------------------------------------------------------------------

CREATE TABLE public.organization_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  status public.platform_trial_status NOT NULL DEFAULT 'ACTIVE',
  initial_duration_months integer NOT NULL DEFAULT 1,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  initial_ends_at timestamptz NOT NULL,
  granted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  extension_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  converted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_trials_duration_positive CHECK (initial_duration_months > 0),
  CONSTRAINT organization_trials_window_check CHECK (ends_at > starts_at),
  CONSTRAINT organization_trials_initial_ends_check CHECK (initial_ends_at > starts_at),
  CONSTRAINT organization_trials_extension_history_is_array CHECK (
    jsonb_typeof(extension_history) = 'array'
  )
);

-- Un seul essai « normal » par organisation
CREATE UNIQUE INDEX organization_trials_organization_id_key
  ON public.organization_trials (organization_id);
CREATE INDEX organization_trials_status_ends_at_idx
  ON public.organization_trials (status, ends_at);
CREATE INDEX organization_trials_granted_by_idx
  ON public.organization_trials (granted_by);

CREATE TRIGGER organization_trials_set_updated_at
  BEFORE UPDATE ON public.organization_trials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.organization_trials.extension_history IS
  'Historique JSON des prolongations: [{at, previous_ends_at, new_ends_at, granted_by, note}]';

COMMENT ON COLUMN public.organization_trials.granted_by IS
  'Super Admin (profiles.id) ayant accordé l''essai.';

-- ---------------------------------------------------------------------------
-- 5) platform_audit_logs (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE public.platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_audit_logs_action_not_blank CHECK (btrim(action) <> ''),
  CONSTRAINT platform_audit_logs_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX platform_audit_logs_organization_created_idx
  ON public.platform_audit_logs (organization_id, created_at DESC);
CREATE INDEX platform_audit_logs_actor_created_idx
  ON public.platform_audit_logs (actor_user_id, created_at DESC);
CREATE INDEX platform_audit_logs_action_created_idx
  ON public.platform_audit_logs (action, created_at DESC);

CREATE OR REPLACE FUNCTION public.write_platform_audit_log(
  p_action text,
  p_organization_id uuid DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_id uuid;
BEGIN
  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'Action audit obligatoire.';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    -- Session authentifiée : Super Admin uniquement ; acteur forcé à auth.uid().
    IF NOT public.is_active_platform_admin() THEN
      RAISE EXCEPTION 'Seuls les Super Admins peuvent écrire l''audit plateforme.';
    END IF;

    IF p_actor_user_id IS NOT NULL AND p_actor_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION
        'Pour une session authentifiée, actor_user_id doit être auth.uid().';
    END IF;

    v_actor := auth.uid();
  ELSE
    -- service_role / jobs : acteur personnalisé autorisé (peut être NULL = système).
    v_actor := p_actor_user_id;
  END IF;

  INSERT INTO public.platform_audit_logs (
    actor_user_id,
    action,
    organization_id,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    v_actor,
    btrim(p_action),
    p_organization_id,
    NULLIF(btrim(p_entity_type), ''),
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_platform_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- platform_admins ----------------------------------------------------------

CREATE POLICY platform_admins_select_super_admin
  ON public.platform_admins
  FOR SELECT
  TO authenticated
  USING (public.is_active_platform_admin());

CREATE POLICY platform_admins_insert_super_admin
  ON public.platform_admins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_platform_admin()
    AND user_id <> (SELECT auth.uid())
  );

CREATE POLICY platform_admins_update_super_admin
  ON public.platform_admins
  FOR UPDATE
  TO authenticated
  USING (public.is_active_platform_admin())
  WITH CHECK (
    public.is_active_platform_admin()
    AND user_id <> (SELECT auth.uid())
  );

CREATE POLICY platform_admins_delete_super_admin
  ON public.platform_admins
  FOR DELETE
  TO authenticated
  USING (
    public.is_active_platform_admin()
    AND user_id <> (SELECT auth.uid())
  );

-- organization_platform_states (pas de DELETE : conserver l'historique via statuts)

CREATE POLICY organization_platform_states_select_member_or_super_admin
  ON public.organization_platform_states
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_platform_admin()
    OR public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  );

CREATE POLICY organization_platform_states_insert_super_admin
  ON public.organization_platform_states
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_platform_admin());

CREATE POLICY organization_platform_states_update_super_admin
  ON public.organization_platform_states
  FOR UPDATE
  TO authenticated
  USING (public.is_active_platform_admin())
  WITH CHECK (public.is_active_platform_admin());

-- subscription_plans (pas de DELETE : désactiver via is_active)

CREATE POLICY subscription_plans_select_active_or_super_admin
  ON public.subscription_plans
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR public.is_active_platform_admin()
  );

CREATE POLICY subscription_plans_insert_super_admin
  ON public.subscription_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_platform_admin());

CREATE POLICY subscription_plans_update_super_admin
  ON public.subscription_plans
  FOR UPDATE
  TO authenticated
  USING (public.is_active_platform_admin())
  WITH CHECK (public.is_active_platform_admin());

-- organization_trials (pas de DELETE : conserver via status)

CREATE POLICY organization_trials_select_member_or_super_admin
  ON public.organization_trials
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_platform_admin()
    OR public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  );

CREATE POLICY organization_trials_insert_super_admin
  ON public.organization_trials
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_platform_admin());

CREATE POLICY organization_trials_update_super_admin
  ON public.organization_trials
  FOR UPDATE
  TO authenticated
  USING (public.is_active_platform_admin())
  WITH CHECK (public.is_active_platform_admin());

-- platform_audit_logs : SELECT seul pour authenticated ; INSERT via write_platform_audit_log

CREATE POLICY platform_audit_logs_select_super_admin
  ON public.platform_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_active_platform_admin());

-- ---------------------------------------------------------------------------
-- GRANT / REVOKE
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.platform_admins FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.organization_platform_states FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.subscription_plans FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.organization_trials FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.platform_audit_logs FROM PUBLIC, anon;

REVOKE ALL ON TYPE public.organization_platform_status FROM PUBLIC, anon;
REVOKE ALL ON TYPE public.subscription_billing_period FROM PUBLIC, anon;
REVOKE ALL ON TYPE public.platform_trial_status FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_admins TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.organization_platform_states TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.subscription_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.organization_trials TO authenticated;
GRANT SELECT ON TABLE public.platform_audit_logs TO authenticated;

GRANT USAGE ON TYPE public.organization_platform_status TO authenticated;
GRANT USAGE ON TYPE public.subscription_billing_period TO authenticated;
GRANT USAGE ON TYPE public.platform_trial_status TO authenticated;

REVOKE ALL ON FUNCTION public.is_active_platform_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prevent_platform_admin_self_elevation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_last_active_platform_admin_removal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_organization_platform_status_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_organization_platform_primary_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_organization_platform_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.write_platform_audit_log(text, uuid, text, uuid, jsonb, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_active_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_platform_audit_log(text, uuid, text, uuid, jsonb, uuid)
  TO authenticated;

COMMENT ON TABLE public.platform_admins IS
  'Super Admins FasoBar. Bootstrap du premier compte via service_role uniquement.';
COMMENT ON TABLE public.organization_platform_states IS
  'État SaaS 1–1 par organisation. Ne remplace jamais organizations.status.';
COMMENT ON TABLE public.subscription_plans IS
  'Formules d''abonnement ; tarifs modifiables par Super Admin. Pas de DELETE : is_active.';
COMMENT ON TABLE public.organization_trials IS
  'Essai gratuit unique par organisation + historique de prolongations. Pas de DELETE.';
COMMENT ON TABLE public.platform_audit_logs IS
  'Audit append-only. INSERT uniquement via write_platform_audit_log.';
