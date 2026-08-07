-- FasoBar: control plane complet (Phase 1B — demandes, paiements, abos, licences, machines)
-- À appliquer manuellement. Ne pas exécuter automatiquement.
--
-- Prérequis : 20260806200000_platform_foundation.sql
-- Ne recrée PAS les enums/tables/fonctions déjà fournis par la fondation.
-- Ne modifie PAS organizations.status.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

CREATE TYPE public.subscription_request_status AS ENUM (
  'PENDING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_NEW_PROOF',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE public.organization_subscription_status AS ENUM (
  'ACTIVE',
  'EXPIRED',
  'SUSPENDED',
  'CANCELLED'
);

CREATE TYPE public.platform_machine_status AS ENUM (
  'PENDING',
  'ACTIVE',
  'REVOKED',
  'BLOCKED'
);

CREATE TYPE public.platform_license_status AS ENUM (
  'ACTIVE',
  'GRACE_PERIOD',
  'EXPIRED',
  'REVOKED'
);

CREATE TYPE public.platform_suspension_target AS ENUM (
  'ORGANIZATION',
  'ESTABLISHMENT',
  'EMPLOYEE'
);

CREATE TYPE public.platform_suspension_status AS ENUM (
  'ACTIVE',
  'LIFTED'
);

CREATE TYPE public.platform_payment_channel AS ENUM (
  'ORANGE_MONEY'
);

-- ---------------------------------------------------------------------------
-- 1) platform_settings (singleton)
-- ---------------------------------------------------------------------------

CREATE TABLE public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  orange_money_number text NOT NULL DEFAULT '+22657537299',
  currency text NOT NULL DEFAULT 'XOF',
  trial_duration_months integer NOT NULL DEFAULT 1,
  trial_enabled boolean NOT NULL DEFAULT true,
  warning_days_before_expiry integer NOT NULL DEFAULT 7,
  offline_grace_days integer NOT NULL DEFAULT 3,
  deletion_recovery_days integer NOT NULL DEFAULT 30,
  subscription_reference_prefix text NOT NULL DEFAULT 'FSB',
  payment_instructions text,
  license_min_app_version text,
  license_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT platform_settings_trial_duration_positive CHECK (trial_duration_months > 0),
  CONSTRAINT platform_settings_warning_days_non_negative CHECK (warning_days_before_expiry >= 0),
  CONSTRAINT platform_settings_offline_grace_non_negative CHECK (offline_grace_days >= 0),
  CONSTRAINT platform_settings_deletion_recovery_positive CHECK (deletion_recovery_days > 0),
  CONSTRAINT platform_settings_prefix_not_blank CHECK (btrim(subscription_reference_prefix) <> ''),
  CONSTRAINT platform_settings_currency_xof CHECK (currency = 'XOF'),
  CONSTRAINT platform_settings_om_not_blank CHECK (btrim(orange_money_number) <> ''),
  CONSTRAINT platform_settings_license_settings_object CHECK (jsonb_typeof(license_settings) = 'object')
);

CREATE TRIGGER platform_settings_set_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.platform_settings IS
  'Paramètres globaux FasoBar (singleton id=1).';

-- ---------------------------------------------------------------------------
-- 2) subscription_request_counters
-- ---------------------------------------------------------------------------

CREATE TABLE public.subscription_request_counters (
  year integer PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0,
  CONSTRAINT subscription_request_counters_year_positive CHECK (year >= 2000),
  CONSTRAINT subscription_request_counters_last_value_non_negative CHECK (last_value >= 0)
);

COMMENT ON TABLE public.subscription_request_counters IS
  'Compteurs annuels pour références FSB-YYYY-NNNNNN.';

-- ---------------------------------------------------------------------------
-- 3) subscription_requests
-- ---------------------------------------------------------------------------

CREATE TABLE public.subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans (id) ON DELETE RESTRICT,
  reference_code text NOT NULL,
  status public.subscription_request_status NOT NULL DEFAULT 'PENDING_PAYMENT',
  -- Snapshots formule / tarif au moment de la demande
  plan_code text NOT NULL,
  plan_name text NOT NULL,
  billing_period public.subscription_billing_period NOT NULL,
  duration_months integer NOT NULL,
  currency text NOT NULL DEFAULT 'XOF',
  price_xof integer NOT NULL,
  max_machines integer NOT NULL DEFAULT 1,
  orange_money_number text NOT NULL,
  expected_amount_xof integer NOT NULL,
  declared_amount_xof integer,
  payer_phone text,
  payer_name text,
  transaction_reference text,
  proof_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  review_note text,
  rejection_reason text,
  approved_at timestamptz,
  resulting_subscription_id uuid,
  resulting_payment_id uuid,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT subscription_requests_reference_not_blank CHECK (btrim(reference_code) <> ''),
  CONSTRAINT subscription_requests_plan_code_not_blank CHECK (btrim(plan_code) <> ''),
  CONSTRAINT subscription_requests_plan_name_not_blank CHECK (btrim(plan_name) <> ''),
  CONSTRAINT subscription_requests_duration_positive CHECK (duration_months > 0),
  CONSTRAINT subscription_requests_price_non_negative CHECK (price_xof >= 0),
  CONSTRAINT subscription_requests_expected_non_negative CHECK (expected_amount_xof >= 0),
  CONSTRAINT subscription_requests_max_machines_positive CHECK (max_machines > 0),
  CONSTRAINT subscription_requests_currency_xof CHECK (currency = 'XOF')
);

CREATE UNIQUE INDEX subscription_requests_reference_code_key
  ON public.subscription_requests (reference_code);

-- Une seule demande ouverte par organisation
CREATE UNIQUE INDEX subscription_requests_one_open_per_org
  ON public.subscription_requests (organization_id)
  WHERE status IN (
    'PENDING_PAYMENT'::public.subscription_request_status,
    'PAYMENT_SUBMITTED'::public.subscription_request_status,
    'UNDER_REVIEW'::public.subscription_request_status,
    'NEEDS_NEW_PROOF'::public.subscription_request_status
  );

CREATE INDEX subscription_requests_organization_created_idx
  ON public.subscription_requests (organization_id, created_at DESC);
CREATE INDEX subscription_requests_status_created_idx
  ON public.subscription_requests (status, created_at DESC);
CREATE INDEX subscription_requests_plan_id_idx
  ON public.subscription_requests (plan_id);

COMMENT ON TABLE public.subscription_requests IS
  'Demandes d''abonnement / renouvellement + workflow preuve Orange Money.';

-- ---------------------------------------------------------------------------
-- 4) subscription_payment_proofs
-- ---------------------------------------------------------------------------

CREATE TABLE public.subscription_payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_request_id uuid NOT NULL
    REFERENCES public.subscription_requests (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  screenshot_storage_path text NOT NULL,
  transaction_number text NOT NULL,
  payer_phone text NOT NULL,
  payer_name text,
  declared_amount_xof integer,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  is_current boolean NOT NULL DEFAULT true,
  superseded_at timestamptz,
  CONSTRAINT subscription_payment_proofs_path_not_blank CHECK (btrim(screenshot_storage_path) <> ''),
  CONSTRAINT subscription_payment_proofs_tx_not_blank CHECK (btrim(transaction_number) <> ''),
  CONSTRAINT subscription_payment_proofs_phone_not_blank CHECK (btrim(payer_phone) <> ''),
  CONSTRAINT subscription_payment_proofs_amount_non_negative CHECK (
    declared_amount_xof IS NULL OR declared_amount_xof >= 0
  )
);

CREATE UNIQUE INDEX subscription_payment_proofs_one_current_per_request
  ON public.subscription_payment_proofs (subscription_request_id)
  WHERE is_current = true;

CREATE INDEX subscription_payment_proofs_request_idx
  ON public.subscription_payment_proofs (subscription_request_id, submitted_at DESC);
CREATE INDEX subscription_payment_proofs_organization_idx
  ON public.subscription_payment_proofs (organization_id);

COMMENT ON TABLE public.subscription_payment_proofs IS
  'Preuves de paiement Orange Money ; une seule preuve courante par demande.';

-- ---------------------------------------------------------------------------
-- 5) platform_subscription_payments (historique immuable)
-- ---------------------------------------------------------------------------

CREATE TABLE public.platform_subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  subscription_request_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans (id) ON DELETE RESTRICT,
  amount_xof integer NOT NULL,
  currency text NOT NULL DEFAULT 'XOF',
  channel public.platform_payment_channel NOT NULL DEFAULT 'ORANGE_MONEY',
  payer_phone text,
  transaction_reference text,
  proof_storage_path text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_subscription_payments_amount_non_negative CHECK (amount_xof >= 0),
  CONSTRAINT platform_subscription_payments_currency_xof CHECK (currency = 'XOF')
);

CREATE UNIQUE INDEX platform_subscription_payments_request_key
  ON public.platform_subscription_payments (subscription_request_id);

CREATE UNIQUE INDEX platform_subscription_payments_tx_ref_key
  ON public.platform_subscription_payments (transaction_reference)
  WHERE transaction_reference IS NOT NULL;

CREATE INDEX platform_subscription_payments_organization_idx
  ON public.platform_subscription_payments (organization_id, paid_at DESC);

COMMENT ON TABLE public.platform_subscription_payments IS
  'Paiements abo confirmés (immuables). ≠ public.payments (caisse).';

-- ---------------------------------------------------------------------------
-- 6) organization_subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE public.organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans (id) ON DELETE RESTRICT,
  status public.organization_subscription_status NOT NULL DEFAULT 'ACTIVE',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  billing_period public.subscription_billing_period NOT NULL,
  duration_months integer NOT NULL,
  amount_paid_xof integer NOT NULL DEFAULT 0,
  source_request_id uuid,
  source_payment_id uuid,
  is_current boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  suspended_at timestamptz,
  renewal_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_subscriptions_window_check CHECK (ends_at > starts_at),
  CONSTRAINT organization_subscriptions_duration_positive CHECK (duration_months > 0),
  CONSTRAINT organization_subscriptions_amount_non_negative CHECK (amount_paid_xof >= 0),
  CONSTRAINT organization_subscriptions_renewal_history_is_array CHECK (
    jsonb_typeof(renewal_history) = 'array'
  )
);

CREATE UNIQUE INDEX organization_subscriptions_one_current_per_org
  ON public.organization_subscriptions (organization_id)
  WHERE is_current = true;

CREATE INDEX organization_subscriptions_status_ends_at_idx
  ON public.organization_subscriptions (status, ends_at);
CREATE INDEX organization_subscriptions_organization_starts_idx
  ON public.organization_subscriptions (organization_id, starts_at DESC);

CREATE TRIGGER organization_subscriptions_set_updated_at
  BEFORE UPDATE ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.organization_subscriptions IS
  'Périodes d''abonnement payantes ; une seule période is_current par org.';

-- ---------------------------------------------------------------------------
-- 7) registered_machines
-- ---------------------------------------------------------------------------

CREATE TABLE public.registered_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments (id) ON DELETE CASCADE,
  device_id text NOT NULL,
  display_name text,
  fingerprint text,
  os_name text,
  app_version text,
  status public.platform_machine_status NOT NULL DEFAULT 'PENDING',
  activated_at timestamptz,
  last_seen_at timestamptz,
  last_synced_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  revoke_reason text,
  blocked_at timestamptz,
  blocked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registered_machines_device_id_not_blank CHECK (btrim(device_id) <> '')
);

CREATE UNIQUE INDEX registered_machines_device_id_key
  ON public.registered_machines (device_id);

CREATE INDEX registered_machines_organization_idx
  ON public.registered_machines (organization_id, status);
CREATE INDEX registered_machines_establishment_idx
  ON public.registered_machines (establishment_id);

CREATE TRIGGER registered_machines_set_updated_at
  BEFORE UPDATE ON public.registered_machines
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Vérifie que l'établissement appartient à l'organisation.
CREATE OR REPLACE FUNCTION public.validate_registered_machine_establishment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = NEW.establishment_id
      AND e.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION
      'establishment_id doit appartenir à organization_id.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER registered_machines_validate_establishment
  BEFORE INSERT OR UPDATE OF establishment_id, organization_id
  ON public.registered_machines
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_registered_machine_establishment();

COMMENT ON TABLE public.registered_machines IS
  'Machines enregistrées ; appartiennent à un établissement.';

-- ---------------------------------------------------------------------------
-- 8) organization_licenses
-- ---------------------------------------------------------------------------

CREATE TABLE public.organization_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  establishment_id uuid REFERENCES public.establishments (id) ON DELETE SET NULL,
  machine_id uuid REFERENCES public.registered_machines (id) ON DELETE SET NULL,
  source_subscription_id uuid,
  source_trial_id uuid REFERENCES public.organization_trials (id) ON DELETE SET NULL,
  status public.platform_license_status NOT NULL DEFAULT 'ACTIVE',
  version integer NOT NULL DEFAULT 1,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  offline_grace_days integer NOT NULL DEFAULT 3,
  revoked_at timestamptz,
  license_hash text,
  license_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_machines integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_licenses_version_positive CHECK (version > 0),
  CONSTRAINT organization_licenses_offline_grace_non_negative CHECK (offline_grace_days >= 0),
  CONSTRAINT organization_licenses_max_machines_positive CHECK (max_machines > 0),
  CONSTRAINT organization_licenses_payload_object CHECK (jsonb_typeof(license_payload) = 'object')
);

CREATE UNIQUE INDEX organization_licenses_one_active_per_org
  ON public.organization_licenses (organization_id)
  WHERE status = 'ACTIVE'::public.platform_license_status;

CREATE INDEX organization_licenses_organization_status_idx
  ON public.organization_licenses (organization_id, status);
CREATE INDEX organization_licenses_expires_at_idx
  ON public.organization_licenses (expires_at);

CREATE TRIGGER organization_licenses_set_updated_at
  BEFORE UPDATE ON public.organization_licenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.organization_licenses IS
  'Licences numériques ; une seule licence ACTIVE par organisation.';

-- ---------------------------------------------------------------------------
-- 9) platform_suspensions
-- ---------------------------------------------------------------------------

CREATE TABLE public.platform_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  target_type public.platform_suspension_target NOT NULL DEFAULT 'ORGANIZATION',
  establishment_id uuid REFERENCES public.establishments (id) ON DELETE SET NULL,
  employee_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status public.platform_suspension_status NOT NULL DEFAULT 'ACTIVE',
  reason text NOT NULL,
  previous_platform_status public.organization_platform_status,
  suspended_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  suspended_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  lift_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_suspensions_reason_not_blank CHECK (btrim(reason) <> ''),
  CONSTRAINT platform_suspensions_target_shape CHECK (
    (
      target_type = 'ORGANIZATION'::public.platform_suspension_target
      AND establishment_id IS NULL
      AND employee_user_id IS NULL
    )
    OR (
      target_type = 'ESTABLISHMENT'::public.platform_suspension_target
      AND establishment_id IS NOT NULL
      AND employee_user_id IS NULL
    )
    OR (
      target_type = 'EMPLOYEE'::public.platform_suspension_target
      AND employee_user_id IS NOT NULL
    )
  )
);

CREATE INDEX platform_suspensions_organization_status_idx
  ON public.platform_suspensions (organization_id, status);
CREATE INDEX platform_suspensions_active_idx
  ON public.platform_suspensions (status, suspended_at DESC)
  WHERE status = 'ACTIVE'::public.platform_suspension_status;

COMMENT ON TABLE public.platform_suspensions IS
  'Suspensions exceptionnelles (org / établissement / employé).';

-- ---------------------------------------------------------------------------
-- Clés étrangères différées (dépendances circulaires)
-- ---------------------------------------------------------------------------

ALTER TABLE public.platform_subscription_payments
  ADD CONSTRAINT platform_subscription_payments_request_fkey
  FOREIGN KEY (subscription_request_id)
  REFERENCES public.subscription_requests (id)
  ON DELETE RESTRICT;

ALTER TABLE public.organization_subscriptions
  ADD CONSTRAINT organization_subscriptions_source_request_fkey
  FOREIGN KEY (source_request_id)
  REFERENCES public.subscription_requests (id)
  ON DELETE SET NULL;

ALTER TABLE public.organization_subscriptions
  ADD CONSTRAINT organization_subscriptions_source_payment_fkey
  FOREIGN KEY (source_payment_id)
  REFERENCES public.platform_subscription_payments (id)
  ON DELETE SET NULL;

ALTER TABLE public.subscription_requests
  ADD CONSTRAINT subscription_requests_resulting_subscription_fkey
  FOREIGN KEY (resulting_subscription_id)
  REFERENCES public.organization_subscriptions (id)
  ON DELETE SET NULL;

ALTER TABLE public.subscription_requests
  ADD CONSTRAINT subscription_requests_resulting_payment_fkey
  FOREIGN KEY (resulting_payment_id)
  REFERENCES public.platform_subscription_payments (id)
  ON DELETE SET NULL;

ALTER TABLE public.organization_licenses
  ADD CONSTRAINT organization_licenses_source_subscription_fkey
  FOREIGN KEY (source_subscription_id)
  REFERENCES public.organization_subscriptions (id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Helpers internes d'audit (bypass check Super Admin — appelés depuis RPC DEFINER)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.platform_write_audit_event(
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
  v_id uuid;
BEGIN
  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'Action audit obligatoire.';
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
    COALESCE(p_actor_user_id, auth.uid()),
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

COMMENT ON FUNCTION public.platform_write_audit_event(text, uuid, text, uuid, jsonb, uuid) IS
  'Audit interne control plane (SECURITY DEFINER). Pour RPC métier OWNER + Super Admin.';

-- ---------------------------------------------------------------------------
-- Helper: OWNER actif de l'organisation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.platform_is_org_owner(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'OWNER'::public.membership_role
      AND om.status = 'ACTIVE'::public.entity_status
  );
$$;

COMMENT ON FUNCTION public.platform_is_org_owner(uuid) IS
  'True si auth.uid() est OWNER ACTIVE de l''organisation.';

-- ---------------------------------------------------------------------------
-- Référence FSB-YYYY-NNNNNN
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.next_subscription_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM now())::integer;
  v_prefix text;
  v_next integer;
BEGIN
  SELECT btrim(subscription_reference_prefix)
  INTO v_prefix
  FROM public.platform_settings
  WHERE id = 1;

  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := 'FSB';
  END IF;

  INSERT INTO public.subscription_request_counters (year, last_value)
  VALUES (v_year, 0)
  ON CONFLICT (year) DO NOTHING;

  SELECT last_value
  INTO v_next
  FROM public.subscription_request_counters
  WHERE year = v_year
  FOR UPDATE;

  v_next := v_next + 1;

  UPDATE public.subscription_request_counters
  SET last_value = v_next
  WHERE year = v_year;

  RETURN v_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
END;
$$;

COMMENT ON FUNCTION public.next_subscription_reference() IS
  'Génère FSB-YYYY-NNNNNN via compteur verrouillé FOR UPDATE.';

-- ---------------------------------------------------------------------------
-- Licence helper interne
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.platform_issue_license(
  p_organization_id uuid,
  p_expires_at timestamptz,
  p_max_machines integer,
  p_source_subscription_id uuid DEFAULT NULL,
  p_source_trial_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_grace integer;
  v_version integer;
  v_id uuid;
  v_hash text;
  v_payload jsonb;
BEGIN
  SELECT offline_grace_days INTO v_grace
  FROM public.platform_settings WHERE id = 1;
  v_grace := COALESCE(v_grace, 3);

  -- Révoque la licence ACTIVE courante
  UPDATE public.organization_licenses
  SET
    status = 'REVOKED'::public.platform_license_status,
    revoked_at = now()
  WHERE organization_id = p_organization_id
    AND status = 'ACTIVE'::public.platform_license_status;

  SELECT COALESCE(max(version), 0) + 1
  INTO v_version
  FROM public.organization_licenses
  WHERE organization_id = p_organization_id;

  v_payload := COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object(
    'organization_id', p_organization_id,
    'expires_at', p_expires_at,
    'max_machines', p_max_machines,
    'version', v_version,
    'issued_at', now()
  );

  -- Empreinte stable (md5 natif Postgres ; pas de dépendance pgcrypto)
  v_hash := md5(v_payload::text || ':' || v_version::text || ':' || gen_random_uuid()::text);

  INSERT INTO public.organization_licenses (
    organization_id,
    source_subscription_id,
    source_trial_id,
    status,
    version,
    issued_at,
    expires_at,
    offline_grace_days,
    license_hash,
    license_payload,
    max_machines
  )
  VALUES (
    p_organization_id,
    p_source_subscription_id,
    p_source_trial_id,
    'ACTIVE'::public.platform_license_status,
    v_version,
    now(),
    p_expires_at,
    v_grace,
    v_hash,
    v_payload,
    GREATEST(COALESCE(p_max_machines, 1), 1)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- refresh_organization_platform_access
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_organization_platform_access(
  p_organization_id uuid
)
RETURNS public.organization_platform_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_state public.organization_platform_states%ROWTYPE;
  v_sub public.organization_subscriptions%ROWTYPE;
  v_trial public.organization_trials%ROWTYPE;
  v_new public.organization_platform_status;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id obligatoire.';
  END IF;

  SELECT *
  INTO v_state
  FROM public.organization_platform_states
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'État plateforme introuvable pour l''organisation.';
  END IF;

  -- Ne jamais auto-modifier suspension / suppression
  IF v_state.status IN (
    'SUSPENDED'::public.organization_platform_status,
    'PENDING_DELETION'::public.organization_platform_status
  ) THEN
    RETURN v_state.status;
  END IF;

  -- Expire essai actif dépassé
  UPDATE public.organization_trials
  SET
    status = 'EXPIRED'::public.platform_trial_status,
    updated_at = now()
  WHERE organization_id = p_organization_id
    AND status = 'ACTIVE'::public.platform_trial_status
    AND ends_at < now();

  -- Expire abonnement courant dépassé
  UPDATE public.organization_subscriptions
  SET
    status = 'EXPIRED'::public.organization_subscription_status,
    updated_at = now()
  WHERE organization_id = p_organization_id
    AND is_current = true
    AND status = 'ACTIVE'::public.organization_subscription_status
    AND ends_at < now();

  SELECT * INTO v_sub
  FROM public.organization_subscriptions
  WHERE organization_id = p_organization_id
    AND is_current = true
  ORDER BY starts_at DESC
  LIMIT 1;

  SELECT * INTO v_trial
  FROM public.organization_trials
  WHERE organization_id = p_organization_id;

  IF v_sub.id IS NOT NULL
     AND v_sub.status = 'ACTIVE'::public.organization_subscription_status
     AND v_sub.ends_at >= now() THEN
    v_new := 'ACTIVE'::public.organization_platform_status;
  ELSIF v_trial.id IS NOT NULL
     AND v_trial.status = 'ACTIVE'::public.platform_trial_status
     AND v_trial.ends_at >= now() THEN
    v_new := 'TRIAL'::public.organization_platform_status;
  ELSIF v_sub.id IS NOT NULL THEN
    v_new := 'EXPIRED'::public.organization_platform_status;
  ELSIF v_trial.id IS NOT NULL
     AND v_trial.status IN (
       'EXPIRED'::public.platform_trial_status,
       'CANCELLED'::public.platform_trial_status
     ) THEN
    v_new := 'TRIAL_EXPIRED'::public.organization_platform_status;
  ELSIF v_trial.id IS NOT NULL
     AND v_trial.status = 'CONVERTED'::public.platform_trial_status THEN
    v_new := 'EXPIRED'::public.organization_platform_status;
  ELSE
    v_new := 'PENDING_CHOICE'::public.organization_platform_status;
  END IF;

  IF v_state.status IS DISTINCT FROM v_new THEN
    UPDATE public.organization_platform_states
    SET status = v_new
    WHERE organization_id = p_organization_id;
  END IF;

  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION public.refresh_organization_platform_access(uuid) IS
  'Recalcule l''état SaaS (expire essais/abos). Ignore SUSPENDED / PENDING_DELETION.';

-- ---------------------------------------------------------------------------
-- organization_has_business_access
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.organization_has_business_access(
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.organization_platform_status;
BEGIN
  v_status := public.refresh_organization_platform_access(p_organization_id);
  RETURN v_status IN (
    'TRIAL'::public.organization_platform_status,
    'ACTIVE'::public.organization_platform_status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- start_organization_trial
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_organization_trial(
  p_organization_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_settings public.platform_settings%ROWTYPE;
  v_state public.organization_platform_states%ROWTYPE;
  v_trial_id uuid;
  v_starts timestamptz := now();
  v_ends timestamptz;
  v_months integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF NOT public.platform_is_org_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Seul le OWNER peut démarrer l''essai.';
  END IF;

  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1 FOR UPDATE;
  IF NOT COALESCE(v_settings.trial_enabled, false) THEN
    RAISE EXCEPTION 'Les essais gratuits sont désactivés.';
  END IF;

  SELECT * INTO v_state
  FROM public.organization_platform_states
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'État plateforme introuvable.';
  END IF;

  IF v_state.status IS DISTINCT FROM 'PENDING_CHOICE'::public.organization_platform_status THEN
    RAISE EXCEPTION
      'L''essai ne peut être démarré qu''en PENDING_CHOICE (état actuel: %).',
      v_state.status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_trials WHERE organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Un essai a déjà été accordé à cette organisation.';
  END IF;

  v_months := COALESCE(v_settings.trial_duration_months, 1);
  v_ends := v_starts + make_interval(months => v_months);

  INSERT INTO public.organization_trials (
    organization_id,
    status,
    initial_duration_months,
    starts_at,
    ends_at,
    initial_ends_at,
    granted_by
  )
  VALUES (
    p_organization_id,
    'ACTIVE'::public.platform_trial_status,
    v_months,
    v_starts,
    v_ends,
    v_ends,
    v_actor
  )
  RETURNING id INTO v_trial_id;

  PERFORM public.platform_issue_license(
    p_organization_id,
    v_ends,
    1,
    NULL,
    v_trial_id,
    jsonb_build_object('kind', 'trial')
  );

  UPDATE public.organization_platform_states
  SET
    status = 'TRIAL'::public.organization_platform_status,
    primary_owner_user_id = COALESCE(primary_owner_user_id, v_actor)
  WHERE organization_id = p_organization_id;

  PERFORM public.platform_write_audit_event(
    'start_organization_trial',
    p_organization_id,
    'organization_trials',
    v_trial_id,
    jsonb_build_object(
      'starts_at', v_starts,
      'ends_at', v_ends,
      'duration_months', v_months
    ),
    v_actor
  );

  RETURN v_trial_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- extend_organization_trial
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.extend_organization_trial(
  p_organization_id uuid,
  p_extra_days integer,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_trial public.organization_trials%ROWTYPE;
  v_prev_ends timestamptz;
  v_new_ends timestamptz;
  v_state public.organization_platform_states%ROWTYPE;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  IF p_extra_days IS NULL OR p_extra_days <= 0 THEN
    RAISE EXCEPTION 'p_extra_days doit être > 0.';
  END IF;

  SELECT * INTO v_state
  FROM public.organization_platform_states
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF v_state.status IN (
    'SUSPENDED'::public.organization_platform_status,
    'PENDING_DELETION'::public.organization_platform_status
  ) THEN
    RAISE EXCEPTION 'Impossible de prolonger un essai (org suspendue ou en suppression).';
  END IF;

  SELECT * INTO v_trial
  FROM public.organization_trials
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucun essai pour cette organisation.';
  END IF;

  IF v_trial.status = 'CONVERTED'::public.platform_trial_status THEN
    RAISE EXCEPTION 'Essai déjà converti en abonnement.';
  END IF;

  v_prev_ends := v_trial.ends_at;
  v_new_ends := GREATEST(v_trial.ends_at, now()) + make_interval(days => p_extra_days);

  UPDATE public.organization_trials
  SET
    status = 'ACTIVE'::public.platform_trial_status,
    ends_at = v_new_ends,
    cancelled_at = NULL,
    extension_history = extension_history || jsonb_build_array(
      jsonb_build_object(
        'at', now(),
        'previous_ends_at', v_prev_ends,
        'new_ends_at', v_new_ends,
        'extra_days', p_extra_days,
        'granted_by', v_actor,
        'note', NULLIF(btrim(COALESCE(p_note, '')), '')
      )
    ),
    updated_at = now()
  WHERE id = v_trial.id;

  PERFORM public.platform_issue_license(
    p_organization_id,
    v_new_ends,
    1,
    NULL,
    v_trial.id,
    jsonb_build_object('kind', 'trial_extension')
  );

  IF v_state.status IS DISTINCT FROM 'ACTIVE'::public.organization_platform_status THEN
    UPDATE public.organization_platform_states
    SET status = 'TRIAL'::public.organization_platform_status
    WHERE organization_id = p_organization_id;
  END IF;

  PERFORM public.write_platform_audit_log(
    'extend_organization_trial',
    p_organization_id,
    'organization_trials',
    v_trial.id,
    jsonb_build_object(
      'previous_ends_at', v_prev_ends,
      'new_ends_at', v_new_ends,
      'extra_days', p_extra_days,
      'note', p_note
    )
  );

  RETURN v_trial.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- submit_subscription_request
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_subscription_request(
  p_organization_id uuid,
  p_plan_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_state public.organization_platform_states%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
  v_settings public.platform_settings%ROWTYPE;
  v_request_id uuid;
  v_ref text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF NOT public.platform_is_org_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Seul le OWNER peut créer une demande d''abonnement.';
  END IF;

  SELECT * INTO v_state
  FROM public.organization_platform_states
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'État plateforme introuvable.';
  END IF;

  IF v_state.status IN (
    'SUSPENDED'::public.organization_platform_status,
    'PENDING_DELETION'::public.organization_platform_status
  ) THEN
    RAISE EXCEPTION 'Organisation suspendue ou en suppression : demande impossible.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subscription_requests sr
    WHERE sr.organization_id = p_organization_id
      AND sr.status IN (
        'PENDING_PAYMENT'::public.subscription_request_status,
        'PAYMENT_SUBMITTED'::public.subscription_request_status,
        'UNDER_REVIEW'::public.subscription_request_status,
        'NEEDS_NEW_PROOF'::public.subscription_request_status
      )
  ) THEN
    RAISE EXCEPTION 'Une demande d''abonnement est déjà ouverte pour cette organisation.';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = p_plan_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formule introuvable ou inactive.';
  END IF;

  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1;

  v_ref := public.next_subscription_reference();

  INSERT INTO public.subscription_requests (
    organization_id,
    owner_user_id,
    plan_id,
    reference_code,
    status,
    plan_code,
    plan_name,
    billing_period,
    duration_months,
    currency,
    price_xof,
    max_machines,
    orange_money_number,
    expected_amount_xof,
    created_by
  )
  VALUES (
    p_organization_id,
    v_actor,
    v_plan.id,
    v_ref,
    'PENDING_PAYMENT'::public.subscription_request_status,
    v_plan.code,
    v_plan.name,
    v_plan.billing_period,
    v_plan.duration_months,
    v_plan.currency,
    v_plan.price_xof,
    v_plan.max_machines,
    v_settings.orange_money_number,
    v_plan.price_xof,
    v_actor
  )
  RETURNING id INTO v_request_id;

  PERFORM public.platform_write_audit_event(
    'submit_subscription_request',
    p_organization_id,
    'subscription_requests',
    v_request_id,
    jsonb_build_object(
      'reference_code', v_ref,
      'plan_id', v_plan.id,
      'plan_code', v_plan.code,
      'expected_amount_xof', v_plan.price_xof
    ),
    v_actor
  );

  RETURN v_request_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- submit_subscription_payment_proof
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_subscription_payment_proof(
  p_request_id uuid,
  p_storage_path text,
  p_tx_ref text,
  p_payer_phone text,
  p_payer_name text DEFAULT NULL,
  p_declared_amount integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req public.subscription_requests%ROWTYPE;
  v_proof_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'Chemin de preuve obligatoire.';
  END IF;

  IF p_tx_ref IS NULL OR btrim(p_tx_ref) = '' THEN
    RAISE EXCEPTION 'Référence de transaction obligatoire.';
  END IF;

  IF p_payer_phone IS NULL OR btrim(p_payer_phone) = '' THEN
    RAISE EXCEPTION 'Numéro payeur obligatoire.';
  END IF;

  SELECT * INTO v_req
  FROM public.subscription_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable.';
  END IF;

  IF NOT public.platform_is_org_owner(v_req.organization_id) THEN
    RAISE EXCEPTION 'Seul le OWNER de l''organisation peut envoyer une preuve.';
  END IF;

  IF v_req.status NOT IN (
    'PENDING_PAYMENT'::public.subscription_request_status,
    'NEEDS_NEW_PROOF'::public.subscription_request_status,
    'UNDER_REVIEW'::public.subscription_request_status,
    'PAYMENT_SUBMITTED'::public.subscription_request_status
  ) THEN
    RAISE EXCEPTION
      'Impossible d''envoyer une preuve pour le statut %.',
      v_req.status;
  END IF;

  UPDATE public.subscription_payment_proofs
  SET
    is_current = false,
    superseded_at = now()
  WHERE subscription_request_id = p_request_id
    AND is_current = true;

  INSERT INTO public.subscription_payment_proofs (
    subscription_request_id,
    organization_id,
    submitted_by,
    screenshot_storage_path,
    transaction_number,
    payer_phone,
    payer_name,
    declared_amount_xof,
    is_current
  )
  VALUES (
    p_request_id,
    v_req.organization_id,
    v_actor,
    btrim(p_storage_path),
    btrim(p_tx_ref),
    btrim(p_payer_phone),
    NULLIF(btrim(COALESCE(p_payer_name, '')), ''),
    p_declared_amount,
    true
  )
  RETURNING id INTO v_proof_id;

  UPDATE public.subscription_requests
  SET
    status = 'PAYMENT_SUBMITTED'::public.subscription_request_status,
    submitted_at = now(),
    declared_amount_xof = p_declared_amount,
    payer_phone = btrim(p_payer_phone),
    payer_name = NULLIF(btrim(COALESCE(p_payer_name, '')), ''),
    transaction_reference = btrim(p_tx_ref),
    proof_storage_path = btrim(p_storage_path),
    review_note = NULL,
    rejection_reason = NULL
  WHERE id = p_request_id;

  PERFORM public.platform_write_audit_event(
    'submit_subscription_payment_proof',
    v_req.organization_id,
    'subscription_payment_proofs',
    v_proof_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'transaction_reference', btrim(p_tx_ref)
    ),
    v_actor
  );

  RETURN v_proof_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- review_subscription_request
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.review_subscription_request(
  p_request_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req public.subscription_requests%ROWTYPE;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  SELECT * INTO v_req
  FROM public.subscription_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable.';
  END IF;

  IF v_req.status NOT IN (
    'PAYMENT_SUBMITTED'::public.subscription_request_status,
    'NEEDS_NEW_PROOF'::public.subscription_request_status,
    'UNDER_REVIEW'::public.subscription_request_status
  ) THEN
    RAISE EXCEPTION 'Statut % non éligible à UNDER_REVIEW.', v_req.status;
  END IF;

  UPDATE public.subscription_requests
  SET
    status = 'UNDER_REVIEW'::public.subscription_request_status,
    reviewed_at = now(),
    reviewed_by = v_actor,
    review_note = NULLIF(btrim(COALESCE(p_note, '')), '')
  WHERE id = p_request_id;

  PERFORM public.write_platform_audit_log(
    'review_subscription_request',
    v_req.organization_id,
    'subscription_requests',
    p_request_id,
    jsonb_build_object('note', p_note)
  );

  RETURN p_request_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- request_new_payment_proof
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_new_payment_proof(
  p_request_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req public.subscription_requests%ROWTYPE;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  SELECT * INTO v_req
  FROM public.subscription_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable.';
  END IF;

  IF v_req.status NOT IN (
    'PAYMENT_SUBMITTED'::public.subscription_request_status,
    'UNDER_REVIEW'::public.subscription_request_status,
    'NEEDS_NEW_PROOF'::public.subscription_request_status
  ) THEN
    RAISE EXCEPTION 'Statut % non éligible à NEEDS_NEW_PROOF.', v_req.status;
  END IF;

  UPDATE public.subscription_payment_proofs
  SET
    is_current = false,
    superseded_at = COALESCE(superseded_at, now())
  WHERE subscription_request_id = p_request_id
    AND is_current = true;

  UPDATE public.subscription_requests
  SET
    status = 'NEEDS_NEW_PROOF'::public.subscription_request_status,
    reviewed_at = now(),
    reviewed_by = v_actor,
    review_note = NULLIF(btrim(COALESCE(p_note, '')), '')
  WHERE id = p_request_id;

  PERFORM public.write_platform_audit_log(
    'request_new_payment_proof',
    v_req.organization_id,
    'subscription_requests',
    p_request_id,
    jsonb_build_object('note', p_note)
  );

  RETURN p_request_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- approve_subscription_payment (idempotent)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_subscription_payment(
  p_request_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req public.subscription_requests%ROWTYPE;
  v_proof public.subscription_payment_proofs%ROWTYPE;
  v_current public.organization_subscriptions%ROWTYPE;
  v_state public.organization_platform_states%ROWTYPE;
  v_payment_id uuid;
  v_sub_id uuid;
  v_starts timestamptz;
  v_ends timestamptz;
  v_now timestamptz := now();
  v_tx text;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  SELECT * INTO v_req
  FROM public.subscription_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable.';
  END IF;

  -- Idempotence : déjà APPROVED → retourne le paiement existant
  IF v_req.status = 'APPROVED'::public.subscription_request_status THEN
    IF v_req.resulting_payment_id IS NOT NULL THEN
      RETURN v_req.resulting_payment_id;
    END IF;

    SELECT id INTO v_payment_id
    FROM public.platform_subscription_payments
    WHERE subscription_request_id = p_request_id;

    IF v_payment_id IS NULL THEN
      RAISE EXCEPTION 'Demande APPROVED sans paiement associé.';
    END IF;
    RETURN v_payment_id;
  END IF;

  -- Reprise après crash : paiement déjà créé pour cette demande
  SELECT id INTO v_payment_id
  FROM public.platform_subscription_payments
  WHERE subscription_request_id = p_request_id;

  IF v_payment_id IS NOT NULL THEN
    UPDATE public.subscription_requests
    SET
      status = 'APPROVED'::public.subscription_request_status,
      approved_at = COALESCE(approved_at, now()),
      reviewed_at = COALESCE(reviewed_at, now()),
      reviewed_by = COALESCE(reviewed_by, v_actor),
      resulting_payment_id = COALESCE(resulting_payment_id, v_payment_id),
      review_note = COALESCE(
        NULLIF(btrim(COALESCE(p_note, '')), ''),
        review_note
      )
    WHERE id = p_request_id;

    UPDATE public.organization_platform_states
    SET status = 'ACTIVE'::public.organization_platform_status
    WHERE organization_id = v_req.organization_id
      AND status NOT IN (
        'SUSPENDED'::public.organization_platform_status,
        'PENDING_DELETION'::public.organization_platform_status
      );

    RETURN v_payment_id;
  END IF;

  IF v_req.status NOT IN (
    'PAYMENT_SUBMITTED'::public.subscription_request_status,
    'UNDER_REVIEW'::public.subscription_request_status
  ) THEN
    RAISE EXCEPTION
      'Seules les demandes PAYMENT_SUBMITTED / UNDER_REVIEW peuvent être approuvées (statut: %).',
      v_req.status;
  END IF;

  SELECT * INTO v_state
  FROM public.organization_platform_states
  WHERE organization_id = v_req.organization_id
  FOR UPDATE;

  IF v_state.status IN (
    'SUSPENDED'::public.organization_platform_status,
    'PENDING_DELETION'::public.organization_platform_status
  ) THEN
    RAISE EXCEPTION 'Impossible d''approuver : organisation suspendue ou en suppression.';
  END IF;

  SELECT * INTO v_proof
  FROM public.subscription_payment_proofs
  WHERE subscription_request_id = p_request_id
    AND is_current = true
  ORDER BY submitted_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucune preuve courante pour cette demande.';
  END IF;

  v_tx := COALESCE(
    NULLIF(btrim(COALESCE(v_req.transaction_reference, '')), ''),
    NULLIF(btrim(v_proof.transaction_number), '')
  );

  IF v_tx IS NULL THEN
    RAISE EXCEPTION 'Référence de transaction manquante.';
  END IF;

  -- Paiement immuable (unique sur transaction_reference)
  INSERT INTO public.platform_subscription_payments (
    organization_id,
    subscription_request_id,
    plan_id,
    amount_xof,
    currency,
    channel,
    payer_phone,
    transaction_reference,
    proof_storage_path,
    paid_at,
    verified_at,
    verified_by,
    notes
  )
  VALUES (
    v_req.organization_id,
    p_request_id,
    v_req.plan_id,
    COALESCE(v_req.declared_amount_xof, v_req.expected_amount_xof),
    v_req.currency,
    'ORANGE_MONEY'::public.platform_payment_channel,
    COALESCE(v_req.payer_phone, v_proof.payer_phone),
    v_tx,
    COALESCE(v_req.proof_storage_path, v_proof.screenshot_storage_path),
    COALESCE(v_proof.submitted_at, v_now),
    v_now,
    v_actor,
    NULLIF(btrim(COALESCE(p_note, '')), '')
  )
  RETURNING id INTO v_payment_id;

  -- Dates : renouvellement avant expiration vs nouveau / après expiration
  SELECT * INTO v_current
  FROM public.organization_subscriptions
  WHERE organization_id = v_req.organization_id
    AND is_current = true
  FOR UPDATE;

  IF v_current.id IS NOT NULL
     AND v_current.status = 'ACTIVE'::public.organization_subscription_status
     AND v_current.ends_at > v_now THEN
    v_starts := v_current.ends_at;
  ELSE
    v_starts := v_now;
  END IF;

  v_ends := v_starts + make_interval(months => v_req.duration_months);

  IF v_current.id IS NOT NULL THEN
    UPDATE public.organization_subscriptions
    SET
      is_current = false,
      status = CASE
        WHEN status = 'ACTIVE'::public.organization_subscription_status
          THEN 'EXPIRED'::public.organization_subscription_status
        ELSE status
      END,
      renewal_history = renewal_history || jsonb_build_array(
        jsonb_build_object(
          'at', v_now,
          'action', 'superseded_by_renewal',
          'new_request_id', p_request_id,
          'new_payment_id', v_payment_id
        )
      ),
      updated_at = v_now
    WHERE id = v_current.id;
  END IF;

  INSERT INTO public.organization_subscriptions (
    organization_id,
    plan_id,
    status,
    starts_at,
    ends_at,
    billing_period,
    duration_months,
    amount_paid_xof,
    source_request_id,
    source_payment_id,
    is_current
  )
  VALUES (
    v_req.organization_id,
    v_req.plan_id,
    'ACTIVE'::public.organization_subscription_status,
    v_starts,
    v_ends,
    v_req.billing_period,
    v_req.duration_months,
    COALESCE(v_req.declared_amount_xof, v_req.expected_amount_xof),
    p_request_id,
    v_payment_id,
    true
  )
  RETURNING id INTO v_sub_id;

  PERFORM public.platform_issue_license(
    v_req.organization_id,
    v_ends,
    v_req.max_machines,
    v_sub_id,
    NULL,
    jsonb_build_object(
      'kind', 'subscription',
      'plan_code', v_req.plan_code,
      'reference_code', v_req.reference_code
    )
  );

  -- Convertit l'essai éventuel
  UPDATE public.organization_trials
  SET
    status = 'CONVERTED'::public.platform_trial_status,
    converted_at = v_now,
    updated_at = v_now
  WHERE organization_id = v_req.organization_id
    AND status IN (
      'ACTIVE'::public.platform_trial_status,
      'EXPIRED'::public.platform_trial_status
    );

  UPDATE public.organization_platform_states
  SET
    status = 'ACTIVE'::public.organization_platform_status,
    deletion_requested_at = NULL,
    deletion_purge_after = NULL
  WHERE organization_id = v_req.organization_id;

  UPDATE public.subscription_requests
  SET
    status = 'APPROVED'::public.subscription_request_status,
    approved_at = v_now,
    reviewed_at = v_now,
    reviewed_by = v_actor,
    review_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
    resulting_subscription_id = v_sub_id,
    resulting_payment_id = v_payment_id
  WHERE id = p_request_id;

  PERFORM public.write_platform_audit_log(
    'approve_subscription_payment',
    v_req.organization_id,
    'platform_subscription_payments',
    v_payment_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'subscription_id', v_sub_id,
      'starts_at', v_starts,
      'ends_at', v_ends,
      'transaction_reference', v_tx,
      'note', p_note
    )
  );

  RETURN v_payment_id;
END;
$$;

COMMENT ON FUNCTION public.approve_subscription_payment(uuid, text) IS
  'Approuve un paiement (idempotent si déjà APPROVED). Crée paiement + abo + licence.';

-- ---------------------------------------------------------------------------
-- reject_subscription_payment
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reject_subscription_payment(
  p_request_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req public.subscription_requests%ROWTYPE;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Motif de refus obligatoire.';
  END IF;

  SELECT * INTO v_req
  FROM public.subscription_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable.';
  END IF;

  IF v_req.status = 'APPROVED'::public.subscription_request_status THEN
    RAISE EXCEPTION 'Impossible de refuser une demande déjà APPROVED.';
  END IF;

  IF v_req.status IN (
    'REJECTED'::public.subscription_request_status,
    'CANCELLED'::public.subscription_request_status
  ) THEN
    RETURN p_request_id;
  END IF;

  UPDATE public.subscription_requests
  SET
    status = 'REJECTED'::public.subscription_request_status,
    reviewed_at = now(),
    reviewed_by = v_actor,
    rejection_reason = btrim(p_reason),
    review_note = btrim(p_reason)
  WHERE id = p_request_id;

  PERFORM public.write_platform_audit_log(
    'reject_subscription_payment',
    v_req.organization_id,
    'subscription_requests',
    p_request_id,
    jsonb_build_object('reason', btrim(p_reason))
  );

  RETURN p_request_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- suspend_client_organization
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.suspend_client_organization(
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
  v_state public.organization_platform_states%ROWTYPE;
  v_suspension_id uuid;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Motif de suspension obligatoire.';
  END IF;

  SELECT * INTO v_state
  FROM public.organization_platform_states
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'État plateforme introuvable.';
  END IF;

  IF v_state.status = 'PENDING_DELETION'::public.organization_platform_status THEN
    RAISE EXCEPTION 'Organisation en suppression : suspendre impossible.';
  END IF;

  IF v_state.status = 'SUSPENDED'::public.organization_platform_status THEN
    SELECT id INTO v_suspension_id
    FROM public.platform_suspensions
    WHERE organization_id = p_organization_id
      AND target_type = 'ORGANIZATION'::public.platform_suspension_target
      AND status = 'ACTIVE'::public.platform_suspension_status
    ORDER BY suspended_at DESC
    LIMIT 1;
    RETURN v_suspension_id;
  END IF;

  INSERT INTO public.platform_suspensions (
    organization_id,
    target_type,
    status,
    reason,
    previous_platform_status,
    suspended_by
  )
  VALUES (
    p_organization_id,
    'ORGANIZATION'::public.platform_suspension_target,
    'ACTIVE'::public.platform_suspension_status,
    btrim(p_reason),
    v_state.status,
    v_actor
  )
  RETURNING id INTO v_suspension_id;

  UPDATE public.organization_platform_states
  SET status = 'SUSPENDED'::public.organization_platform_status
  WHERE organization_id = p_organization_id;

  UPDATE public.organization_subscriptions
  SET
    status = 'SUSPENDED'::public.organization_subscription_status,
    suspended_at = now(),
    updated_at = now()
  WHERE organization_id = p_organization_id
    AND is_current = true
    AND status = 'ACTIVE'::public.organization_subscription_status;

  UPDATE public.organization_licenses
  SET
    status = 'REVOKED'::public.platform_license_status,
    revoked_at = now()
  WHERE organization_id = p_organization_id
    AND status = 'ACTIVE'::public.platform_license_status;

  UPDATE public.registered_machines
  SET
    status = 'BLOCKED'::public.platform_machine_status,
    blocked_at = now(),
    blocked_reason = btrim(p_reason)
  WHERE organization_id = p_organization_id
    AND status IN (
      'PENDING'::public.platform_machine_status,
      'ACTIVE'::public.platform_machine_status
    );

  PERFORM public.write_platform_audit_log(
    'suspend_client_organization',
    p_organization_id,
    'platform_suspensions',
    v_suspension_id,
    jsonb_build_object(
      'reason', btrim(p_reason),
      'previous_status', v_state.status
    )
  );

  RETURN v_suspension_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- reactivate_client_organization
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reactivate_client_organization(
  p_organization_id uuid,
  p_comment text DEFAULT NULL
)
RETURNS public.organization_platform_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_state public.organization_platform_states%ROWTYPE;
  v_prev public.organization_platform_status;
  v_sub public.organization_subscriptions%ROWTYPE;
  v_final public.organization_platform_status;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  SELECT * INTO v_state
  FROM public.organization_platform_states
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'État plateforme introuvable.';
  END IF;

  IF v_state.status IS DISTINCT FROM 'SUSPENDED'::public.organization_platform_status THEN
    RAISE EXCEPTION 'Organisation non suspendue (état: %).', v_state.status;
  END IF;

  SELECT previous_platform_status INTO v_prev
  FROM public.platform_suspensions
  WHERE organization_id = p_organization_id
    AND target_type = 'ORGANIZATION'::public.platform_suspension_target
    AND status = 'ACTIVE'::public.platform_suspension_status
  ORDER BY suspended_at DESC
  LIMIT 1
  FOR UPDATE;

  UPDATE public.platform_suspensions
  SET
    status = 'LIFTED'::public.platform_suspension_status,
    lifted_at = now(),
    lifted_by = v_actor,
    lift_comment = NULLIF(btrim(COALESCE(p_comment, '')), '')
  WHERE organization_id = p_organization_id
    AND target_type = 'ORGANIZATION'::public.platform_suspension_target
    AND status = 'ACTIVE'::public.platform_suspension_status;

  -- Restaure temporairement le statut précédent pour permettre le refresh
  UPDATE public.organization_platform_states
  SET status = COALESCE(
    v_prev,
    'EXPIRED'::public.organization_platform_status
  )
  WHERE organization_id = p_organization_id;

  -- Réactive l'abo courant s'il est encore dans sa fenêtre
  SELECT * INTO v_sub
  FROM public.organization_subscriptions
  WHERE organization_id = p_organization_id
    AND is_current = true
  FOR UPDATE;

  IF v_sub.id IS NOT NULL
     AND v_sub.status = 'SUSPENDED'::public.organization_subscription_status
     AND v_sub.ends_at >= now() THEN
    UPDATE public.organization_subscriptions
    SET
      status = 'ACTIVE'::public.organization_subscription_status,
      suspended_at = NULL,
      updated_at = now()
    WHERE id = v_sub.id;

    PERFORM public.platform_issue_license(
      p_organization_id,
      v_sub.ends_at,
      (
        SELECT sp.max_machines
        FROM public.subscription_plans sp
        WHERE sp.id = v_sub.plan_id
      ),
      v_sub.id,
      NULL,
      jsonb_build_object('kind', 'reactivation')
    );
  END IF;

  -- Débloque les machines bloquées par suspension (pas les REVOKED)
  UPDATE public.registered_machines
  SET
    status = 'ACTIVE'::public.platform_machine_status,
    blocked_at = NULL,
    blocked_reason = NULL
  WHERE organization_id = p_organization_id
    AND status = 'BLOCKED'::public.platform_machine_status;

  v_final := public.refresh_organization_platform_access(p_organization_id);

  PERFORM public.write_platform_audit_log(
    'reactivate_client_organization',
    p_organization_id,
    'organization_platform_states',
    p_organization_id,
    jsonb_build_object(
      'comment', p_comment,
      'restored_status', v_final
    )
  );

  RETURN v_final;
END;
$$;

-- ---------------------------------------------------------------------------
-- schedule_client_deletion
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.schedule_client_deletion(
  p_organization_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_state public.organization_platform_states%ROWTYPE;
  v_days integer;
  v_purge_after timestamptz;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  SELECT * INTO v_state
  FROM public.organization_platform_states
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'État plateforme introuvable.';
  END IF;

  IF v_state.status = 'PENDING_DELETION'::public.organization_platform_status THEN
    RETURN v_state.deletion_purge_after;
  END IF;

  SELECT deletion_recovery_days INTO v_days
  FROM public.platform_settings WHERE id = 1;
  v_days := COALESCE(v_days, 30);
  v_purge_after := now() + make_interval(days => v_days);

  UPDATE public.organization_platform_states
  SET
    status = 'PENDING_DELETION'::public.organization_platform_status,
    deletion_requested_at = now(),
    deletion_purge_after = v_purge_after
  WHERE organization_id = p_organization_id;

  UPDATE public.organization_subscriptions
  SET
    status = 'SUSPENDED'::public.organization_subscription_status,
    suspended_at = now(),
    updated_at = now()
  WHERE organization_id = p_organization_id
    AND is_current = true
    AND status IN (
      'ACTIVE'::public.organization_subscription_status,
      'EXPIRED'::public.organization_subscription_status
    );

  UPDATE public.organization_licenses
  SET
    status = 'REVOKED'::public.platform_license_status,
    revoked_at = now()
  WHERE organization_id = p_organization_id
    AND status IN (
      'ACTIVE'::public.platform_license_status,
      'GRACE_PERIOD'::public.platform_license_status
    );

  UPDATE public.registered_machines
  SET
    status = 'REVOKED'::public.platform_machine_status,
    revoked_at = now(),
    revoked_by = v_actor,
    revoke_reason = COALESCE(NULLIF(btrim(COALESCE(p_reason, '')), ''), 'PENDING_DELETION')
  WHERE organization_id = p_organization_id
    AND status IS DISTINCT FROM 'REVOKED'::public.platform_machine_status;

  PERFORM public.write_platform_audit_log(
    'schedule_client_deletion',
    p_organization_id,
    'organization_platform_states',
    p_organization_id,
    jsonb_build_object(
      'reason', p_reason,
      'purge_after', v_purge_after,
      'previous_status', v_state.status
    )
  );

  RETURN v_purge_after;
END;
$$;

-- ---------------------------------------------------------------------------
-- restore_client_before_deletion
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restore_client_before_deletion(
  p_organization_id uuid
)
RETURNS public.organization_platform_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_state public.organization_platform_states%ROWTYPE;
  v_final public.organization_platform_status;
  v_sub public.organization_subscriptions%ROWTYPE;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  SELECT * INTO v_state
  FROM public.organization_platform_states
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'État plateforme introuvable.';
  END IF;

  IF v_state.status IS DISTINCT FROM 'PENDING_DELETION'::public.organization_platform_status THEN
    RAISE EXCEPTION 'Organisation non en PENDING_DELETION.';
  END IF;

  IF v_state.deletion_purge_after IS NOT NULL AND v_state.deletion_purge_after < now() THEN
    RAISE EXCEPTION 'Fenêtre de récupération expirée.';
  END IF;

  -- Sort de PENDING_DELETION vers previous_status (refresh affinera)
  UPDATE public.organization_platform_states
  SET
    status = COALESCE(
      previous_status,
      'EXPIRED'::public.organization_platform_status
    ),
    deletion_requested_at = NULL,
    deletion_purge_after = NULL
  WHERE organization_id = p_organization_id;

  SELECT * INTO v_sub
  FROM public.organization_subscriptions
  WHERE organization_id = p_organization_id
    AND is_current = true
  FOR UPDATE;

  IF v_sub.id IS NOT NULL
     AND v_sub.status = 'SUSPENDED'::public.organization_subscription_status
     AND v_sub.ends_at >= now() THEN
    UPDATE public.organization_subscriptions
    SET
      status = 'ACTIVE'::public.organization_subscription_status,
      suspended_at = NULL,
      updated_at = now()
    WHERE id = v_sub.id;

    PERFORM public.platform_issue_license(
      p_organization_id,
      v_sub.ends_at,
      (
        SELECT sp.max_machines FROM public.subscription_plans sp WHERE sp.id = v_sub.plan_id
      ),
      v_sub.id,
      NULL,
      jsonb_build_object('kind', 'restore_before_deletion')
    );
  END IF;

  v_final := public.refresh_organization_platform_access(p_organization_id);

  PERFORM public.write_platform_audit_log(
    'restore_client_before_deletion',
    p_organization_id,
    'organization_platform_states',
    p_organization_id,
    jsonb_build_object('restored_status', v_final)
  );

  RETURN v_final;
END;
$$;

-- ---------------------------------------------------------------------------
-- revoke_machine / reactivate_machine
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.revoke_machine(
  p_machine_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_machine public.registered_machines%ROWTYPE;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  SELECT * INTO v_machine
  FROM public.registered_machines
  WHERE id = p_machine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Machine introuvable.';
  END IF;

  IF v_machine.status = 'REVOKED'::public.platform_machine_status THEN
    RETURN p_machine_id;
  END IF;

  UPDATE public.registered_machines
  SET
    status = 'REVOKED'::public.platform_machine_status,
    revoked_at = now(),
    revoked_by = v_actor,
    revoke_reason = NULLIF(btrim(COALESCE(p_reason, '')), '')
  WHERE id = p_machine_id;

  PERFORM public.write_platform_audit_log(
    'revoke_machine',
    v_machine.organization_id,
    'registered_machines',
    p_machine_id,
    jsonb_build_object('reason', p_reason, 'device_id', v_machine.device_id)
  );

  RETURN p_machine_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_machine(
  p_machine_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_machine public.registered_machines%ROWTYPE;
  v_status public.organization_platform_status;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  SELECT * INTO v_machine
  FROM public.registered_machines
  WHERE id = p_machine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Machine introuvable.';
  END IF;

  v_status := public.refresh_organization_platform_access(v_machine.organization_id);
  IF v_status IN (
    'SUSPENDED'::public.organization_platform_status,
    'PENDING_DELETION'::public.organization_platform_status
  ) THEN
    RAISE EXCEPTION 'Impossible de réactiver une machine (org %).', v_status;
  END IF;

  UPDATE public.registered_machines
  SET
    status = 'ACTIVE'::public.platform_machine_status,
    revoked_at = NULL,
    revoked_by = NULL,
    revoke_reason = NULL,
    blocked_at = NULL,
    blocked_reason = NULL,
    activated_at = COALESCE(activated_at, now())
  WHERE id = p_machine_id;

  PERFORM public.write_platform_audit_log(
    'reactivate_machine',
    v_machine.organization_id,
    'registered_machines',
    p_machine_id,
    jsonb_build_object('device_id', v_machine.device_id)
  );

  RETURN p_machine_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- update_platform_settings
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_platform_settings(
  p_patch jsonb
)
RETURNS public.platform_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.platform_settings%ROWTYPE;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'p_patch doit être un objet JSON.';
  END IF;

  UPDATE public.platform_settings
  SET
    orange_money_number = COALESCE(
      NULLIF(btrim(p_patch->>'orange_money_number'), ''),
      orange_money_number
    ),
    currency = COALESCE(NULLIF(btrim(p_patch->>'currency'), ''), currency),
    trial_duration_months = COALESCE(
      (p_patch->>'trial_duration_months')::integer,
      trial_duration_months
    ),
    trial_enabled = COALESCE(
      (p_patch->>'trial_enabled')::boolean,
      trial_enabled
    ),
    warning_days_before_expiry = COALESCE(
      (p_patch->>'warning_days_before_expiry')::integer,
      warning_days_before_expiry
    ),
    offline_grace_days = COALESCE(
      (p_patch->>'offline_grace_days')::integer,
      offline_grace_days
    ),
    deletion_recovery_days = COALESCE(
      (p_patch->>'deletion_recovery_days')::integer,
      deletion_recovery_days
    ),
    subscription_reference_prefix = COALESCE(
      NULLIF(btrim(p_patch->>'subscription_reference_prefix'), ''),
      subscription_reference_prefix
    ),
    payment_instructions = CASE
      WHEN p_patch ? 'payment_instructions'
        THEN NULLIF(btrim(p_patch->>'payment_instructions'), '')
      ELSE payment_instructions
    END,
    license_min_app_version = CASE
      WHEN p_patch ? 'license_min_app_version'
        THEN NULLIF(btrim(p_patch->>'license_min_app_version'), '')
      ELSE license_min_app_version
    END,
    license_settings = CASE
      WHEN p_patch ? 'license_settings'
        THEN COALESCE(p_patch->'license_settings', '{}'::jsonb)
      ELSE license_settings
    END,
    updated_by = v_actor
  WHERE id = 1
  RETURNING * INTO v_row;

  PERFORM public.write_platform_audit_log(
    'update_platform_settings',
    NULL,
    'platform_settings',
    NULL,
    p_patch
  );

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- add_platform_admin / set_platform_admin_status
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_platform_admin(p_user_id uuid)
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
    RAISE EXCEPTION 'Auto-promotion Super Admin interdite.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Profil introuvable.';
  END IF;

  INSERT INTO public.platform_admins (user_id, status, created_by)
  VALUES (p_user_id, 'ACTIVE'::public.entity_status, v_actor)
  ON CONFLICT (user_id) DO UPDATE
    SET
      status = 'ACTIVE'::public.entity_status,
      updated_at = now()
  RETURNING id INTO v_id;

  PERFORM public.write_platform_audit_log(
    'add_platform_admin',
    NULL,
    'platform_admins',
    v_id,
    jsonb_build_object('user_id', p_user_id)
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_platform_admin_status(
  p_user_id uuid,
  p_status public.entity_status
)
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

  IF p_user_id = v_actor THEN
    RAISE EXCEPTION 'Un Super Admin ne peut pas modifier son propre statut.';
  END IF;

  IF p_status IS NULL THEN
    RAISE EXCEPTION 'Statut obligatoire.';
  END IF;

  UPDATE public.platform_admins
  SET
    status = p_status,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Super Admin introuvable.';
  END IF;

  PERFORM public.write_platform_audit_log(
    'set_platform_admin_status',
    NULL,
    'platform_admins',
    v_id,
    jsonb_build_object('user_id', p_user_id, 'status', p_status)
  );

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- update_subscription_plan_admin
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_subscription_plan_admin(
  p_plan_id uuid,
  p_patch jsonb
)
RETURNS public.subscription_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.subscription_plans%ROWTYPE;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'p_patch doit être un objet JSON.';
  END IF;

  UPDATE public.subscription_plans
  SET
    name = COALESCE(NULLIF(btrim(p_patch->>'name'), ''), name),
    description = CASE
      WHEN p_patch ? 'description' THEN NULLIF(btrim(p_patch->>'description'), '')
      ELSE description
    END,
    price_xof = COALESCE((p_patch->>'price_xof')::integer, price_xof),
    duration_months = COALESCE((p_patch->>'duration_months')::integer, duration_months),
    max_machines = COALESCE((p_patch->>'max_machines')::integer, max_machines),
    is_active = COALESCE((p_patch->>'is_active')::boolean, is_active),
    sort_order = COALESCE((p_patch->>'sort_order')::integer, sort_order),
    features = CASE
      WHEN p_patch ? 'features' THEN COALESCE(p_patch->'features', '{}'::jsonb)
      ELSE features
    END,
    billing_period = COALESCE(
      (p_patch->>'billing_period')::public.subscription_billing_period,
      billing_period
    )
  WHERE id = p_plan_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formule introuvable.';
  END IF;

  PERFORM public.write_platform_audit_log(
    'update_subscription_plan_admin',
    NULL,
    'subscription_plans',
    p_plan_id,
    p_patch
  );

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- cancel_organization_subscription
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_organization_subscription(
  p_organization_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub public.organization_subscriptions%ROWTYPE;
  v_final public.organization_platform_status;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  SELECT * INTO v_sub
  FROM public.organization_subscriptions
  WHERE organization_id = p_organization_id
    AND is_current = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucun abonnement courant.';
  END IF;

  IF v_sub.status = 'CANCELLED'::public.organization_subscription_status THEN
    RETURN v_sub.id;
  END IF;

  UPDATE public.organization_subscriptions
  SET
    status = 'CANCELLED'::public.organization_subscription_status,
    cancelled_at = now(),
    is_current = true,
    renewal_history = renewal_history || jsonb_build_array(
      jsonb_build_object(
        'at', now(),
        'action', 'cancelled',
        'reason', NULLIF(btrim(COALESCE(p_reason, '')), '')
      )
    ),
    updated_at = now()
  WHERE id = v_sub.id;

  UPDATE public.organization_licenses
  SET
    status = 'REVOKED'::public.platform_license_status,
    revoked_at = now()
  WHERE organization_id = p_organization_id
    AND status = 'ACTIVE'::public.platform_license_status;

  v_final := public.refresh_organization_platform_access(p_organization_id);

  PERFORM public.write_platform_audit_log(
    'cancel_organization_subscription',
    p_organization_id,
    'organization_subscriptions',
    v_sub.id,
    jsonb_build_object('reason', p_reason, 'platform_status', v_final)
  );

  RETURN v_sub.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_request_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registered_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_suspensions ENABLE ROW LEVEL SECURITY;

-- platform_settings --------------------------------------------------------

CREATE POLICY platform_settings_select_authenticated
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY platform_settings_update_super_admin
  ON public.platform_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_active_platform_admin())
  WITH CHECK (public.is_active_platform_admin());

-- counters : aucun accès table pour authenticated (RPC only)
CREATE POLICY subscription_request_counters_super_admin_all
  ON public.subscription_request_counters
  FOR ALL
  TO authenticated
  USING (public.is_active_platform_admin())
  WITH CHECK (public.is_active_platform_admin());

-- subscription_requests ----------------------------------------------------

CREATE POLICY subscription_requests_select_member_or_super_admin
  ON public.subscription_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_platform_admin()
    OR public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  );

CREATE POLICY subscription_requests_insert_super_admin
  ON public.subscription_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_platform_admin());

CREATE POLICY subscription_requests_update_super_admin
  ON public.subscription_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_active_platform_admin())
  WITH CHECK (public.is_active_platform_admin());

-- subscription_payment_proofs (INSERT via RPC uniquement) ------------------

CREATE POLICY subscription_payment_proofs_select_member_or_super_admin
  ON public.subscription_payment_proofs
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_platform_admin()
    OR public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  );

CREATE POLICY subscription_payment_proofs_insert_super_admin
  ON public.subscription_payment_proofs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_platform_admin());

CREATE POLICY subscription_payment_proofs_update_super_admin
  ON public.subscription_payment_proofs
  FOR UPDATE
  TO authenticated
  USING (public.is_active_platform_admin())
  WITH CHECK (public.is_active_platform_admin());

-- platform_subscription_payments -------------------------------------------

CREATE POLICY platform_subscription_payments_select_member_or_super_admin
  ON public.platform_subscription_payments
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_platform_admin()
    OR public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  );

CREATE POLICY platform_subscription_payments_insert_super_admin
  ON public.platform_subscription_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_platform_admin());

-- organization_subscriptions -----------------------------------------------

CREATE POLICY organization_subscriptions_select_member_or_super_admin
  ON public.organization_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_platform_admin()
    OR public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  );

CREATE POLICY organization_subscriptions_insert_super_admin
  ON public.organization_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_platform_admin());

CREATE POLICY organization_subscriptions_update_super_admin
  ON public.organization_subscriptions
  FOR UPDATE
  TO authenticated
  USING (public.is_active_platform_admin())
  WITH CHECK (public.is_active_platform_admin());

-- registered_machines ------------------------------------------------------

CREATE POLICY registered_machines_select_member_or_super_admin
  ON public.registered_machines
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_platform_admin()
    OR public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  );

CREATE POLICY registered_machines_insert_super_admin
  ON public.registered_machines
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_platform_admin());

CREATE POLICY registered_machines_update_super_admin
  ON public.registered_machines
  FOR UPDATE
  TO authenticated
  USING (public.is_active_platform_admin())
  WITH CHECK (public.is_active_platform_admin());

CREATE POLICY registered_machines_delete_super_admin
  ON public.registered_machines
  FOR DELETE
  TO authenticated
  USING (public.is_active_platform_admin());

-- organization_licenses ----------------------------------------------------

CREATE POLICY organization_licenses_select_member_or_super_admin
  ON public.organization_licenses
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_platform_admin()
    OR public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  );

CREATE POLICY organization_licenses_insert_super_admin
  ON public.organization_licenses
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_platform_admin());

CREATE POLICY organization_licenses_update_super_admin
  ON public.organization_licenses
  FOR UPDATE
  TO authenticated
  USING (public.is_active_platform_admin())
  WITH CHECK (public.is_active_platform_admin());

-- platform_suspensions -----------------------------------------------------

CREATE POLICY platform_suspensions_select_super_admin_or_owner
  ON public.platform_suspensions
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_platform_admin()
    OR public.platform_is_org_owner(organization_id)
  );

CREATE POLICY platform_suspensions_insert_super_admin
  ON public.platform_suspensions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_platform_admin());

CREATE POLICY platform_suspensions_update_super_admin
  ON public.platform_suspensions
  FOR UPDATE
  TO authenticated
  USING (public.is_active_platform_admin())
  WITH CHECK (public.is_active_platform_admin());

-- ---------------------------------------------------------------------------
-- GRANT / REVOKE
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.platform_settings FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.subscription_request_counters FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.subscription_requests FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.subscription_payment_proofs FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.platform_subscription_payments FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.organization_subscriptions FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.registered_machines FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.organization_licenses FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.platform_suspensions FROM PUBLIC, anon;

REVOKE ALL ON TYPE public.subscription_request_status FROM PUBLIC, anon;
REVOKE ALL ON TYPE public.organization_subscription_status FROM PUBLIC, anon;
REVOKE ALL ON TYPE public.platform_machine_status FROM PUBLIC, anon;
REVOKE ALL ON TYPE public.platform_license_status FROM PUBLIC, anon;
REVOKE ALL ON TYPE public.platform_suspension_target FROM PUBLIC, anon;
REVOKE ALL ON TYPE public.platform_suspension_status FROM PUBLIC, anon;
REVOKE ALL ON TYPE public.platform_payment_channel FROM PUBLIC, anon;

GRANT SELECT ON TABLE public.platform_settings TO authenticated;
GRANT SELECT ON TABLE public.subscription_request_counters TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.subscription_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.subscription_payment_proofs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.platform_subscription_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.organization_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registered_machines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.organization_licenses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_suspensions TO authenticated;

GRANT USAGE ON TYPE public.subscription_request_status TO authenticated;
GRANT USAGE ON TYPE public.organization_subscription_status TO authenticated;
GRANT USAGE ON TYPE public.platform_machine_status TO authenticated;
GRANT USAGE ON TYPE public.platform_license_status TO authenticated;
GRANT USAGE ON TYPE public.platform_suspension_target TO authenticated;
GRANT USAGE ON TYPE public.platform_suspension_status TO authenticated;
GRANT USAGE ON TYPE public.platform_payment_channel TO authenticated;

-- Fonctions : revoke large puis grant ciblé
REVOKE ALL ON FUNCTION public.platform_write_audit_event(text, uuid, text, uuid, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_registered_machine_establishment()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_issue_license(uuid, timestamptz, integer, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.platform_is_org_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_subscription_reference() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_organization_platform_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.organization_has_business_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_organization_trial(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.extend_organization_trial(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_subscription_request(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_subscription_payment_proof(uuid, text, text, text, text, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_subscription_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_new_payment_proof(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_subscription_payment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_subscription_payment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.suspend_client_organization(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_client_organization(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.schedule_client_deletion(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_client_before_deletion(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_machine(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_machine(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_platform_settings(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_platform_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_platform_admin_status(uuid, public.entity_status) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_subscription_plan_admin(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_organization_subscription(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.platform_is_org_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_subscription_reference() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_organization_platform_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.organization_has_business_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_organization_trial(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_organization_trial(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_subscription_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_subscription_payment_proof(uuid, text, text, text, text, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_subscription_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_new_payment_proof(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_subscription_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_subscription_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_client_organization(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_client_organization(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_client_deletion(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_client_before_deletion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_machine(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_machine(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_platform_settings(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_platform_admin_status(uuid, public.entity_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_subscription_plan_admin(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_organization_subscription(uuid, text) TO authenticated;
