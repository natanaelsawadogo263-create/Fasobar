-- Essai gratuit : durée en jours (défaut 7), réglable globalement.
-- Prolongation par client déjà gérée via extend_organization_trial(extra_days).

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS trial_duration_days integer;

UPDATE public.platform_settings
SET trial_duration_days = 7
WHERE id = 1
  AND (trial_duration_days IS NULL OR trial_duration_days <= 0);

ALTER TABLE public.platform_settings
  ALTER COLUMN trial_duration_days SET DEFAULT 7;

ALTER TABLE public.platform_settings
  ALTER COLUMN trial_duration_days SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'platform_settings_trial_duration_days_positive'
  ) THEN
    ALTER TABLE public.platform_settings
      ADD CONSTRAINT platform_settings_trial_duration_days_positive
      CHECK (trial_duration_days > 0);
  END IF;
END $$;

ALTER TABLE public.organization_trials
  ADD COLUMN IF NOT EXISTS initial_duration_days integer;

COMMENT ON COLUMN public.platform_settings.trial_duration_days IS
  'Durée initiale de l''essai gratuit en jours (défaut FasoBar : 7).';

-- ---------------------------------------------------------------------------
-- start_organization_trial : utilise trial_duration_days
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
  v_days integer;
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

  v_days := COALESCE(v_settings.trial_duration_days, 7);
  IF v_days <= 0 THEN
    v_days := 7;
  END IF;
  v_months := GREATEST(1, CEIL(v_days::numeric / 30.0)::integer);
  v_ends := v_starts + make_interval(days => v_days);

  INSERT INTO public.organization_trials (
    organization_id,
    status,
    initial_duration_months,
    initial_duration_days,
    starts_at,
    ends_at,
    initial_ends_at,
    granted_by
  )
  VALUES (
    p_organization_id,
    'ACTIVE'::public.platform_trial_status,
    v_months,
    v_days,
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
      'duration_days', v_days
    ),
    v_actor
  );

  RETURN v_trial_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- update_platform_settings : accepte trial_duration_days
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
    trial_duration_days = COALESCE(
      (p_patch->>'trial_duration_days')::integer,
      trial_duration_days
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
