-- Quincaillerie : l’admin / propriétaire peut ouvrir et fermer sa propre session de caisse.
-- Restaurant : l’admin reste en lecture seule.

CREATE OR REPLACE FUNCTION public.user_is_cash_register_operator(
  p_user_id uuid,
  p_establishment_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (
      EXISTS (
        SELECT 1
        FROM public.establishment_memberships em
        WHERE em.user_id = p_user_id
          AND em.establishment_id = p_establishment_id
          AND em.status = 'ACTIVE'::public.entity_status
          AND em.role IN (
            'CASHIER_KITCHEN'::public.membership_role,
            'CASHIER'::public.membership_role,
            'KITCHEN_MANAGER'::public.membership_role
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_memberships om
        INNER JOIN public.establishments e ON e.organization_id = om.organization_id
        WHERE om.user_id = p_user_id
          AND e.id = p_establishment_id
          AND om.status = 'ACTIVE'::public.entity_status
          AND om.role IN (
            'OWNER'::public.membership_role,
            'ADMIN'::public.membership_role,
            'MANAGER'::public.membership_role
          )
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = p_establishment_id
        AND e.status = 'ACTIVE'::public.entity_status
        AND e.activity_code = 'hardware'
        AND (
          public.user_can_manage_products(p_user_id, p_establishment_id)
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.open_cash_register_session(
  p_opening_cash_amount integer,
  p_opening_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_establishment_id uuid;
  v_organization_id uuid;
  v_session_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_opening_cash_amount IS NULL OR p_opening_cash_amount < 0 THEN
    RAISE EXCEPTION 'Le fond de caisse initial doit être positif ou nul.';
  END IF;

  SELECT em.establishment_id, e.organization_id
  INTO v_establishment_id, v_organization_id
  FROM public.establishment_memberships em
  INNER JOIN public.establishments e ON e.id = em.establishment_id
  WHERE em.user_id = v_user_id
    AND em.status = 'ACTIVE'::public.entity_status
    AND (
      em.role IN (
        'CASHIER_KITCHEN'::public.membership_role,
        'CASHIER'::public.membership_role,
        'KITCHEN_MANAGER'::public.membership_role
      )
      OR (
        e.activity_code = 'hardware'
        AND em.role IN (
          'OWNER'::public.membership_role,
          'ADMIN'::public.membership_role,
          'MANAGER'::public.membership_role
        )
      )
    )
  ORDER BY CASE
    WHEN em.role IN (
      'CASHIER_KITCHEN'::public.membership_role,
      'CASHIER'::public.membership_role,
      'KITCHEN_MANAGER'::public.membership_role
    ) THEN 0
    ELSE 1
  END
  LIMIT 1;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Permission insuffisante pour ouvrir une caisse.';
  END IF;

  IF NOT public.user_is_cash_register_operator(v_user_id, v_establishment_id) THEN
    RAISE EXCEPTION 'Permission insuffisante pour ouvrir une caisse.';
  END IF;

  IF public.get_active_cash_session(v_user_id, v_establishment_id) IS NOT NULL THEN
    RAISE EXCEPTION 'Une session de caisse est déjà ouverte pour cet utilisateur.';
  END IF;

  INSERT INTO public.cash_register_sessions (
    organization_id,
    establishment_id,
    opened_by,
    status,
    opening_cash_amount,
    expected_cash_amount,
    opening_note
  )
  VALUES (
    v_organization_id,
    v_establishment_id,
    v_user_id,
    'OPEN'::public.cash_register_session_status,
    p_opening_cash_amount,
    p_opening_cash_amount,
    NULLIF(btrim(p_opening_note), '')
  )
  RETURNING id INTO v_session_id;

  PERFORM public.write_payment_audit_log(
    v_organization_id,
    v_establishment_id,
    v_session_id,
    'CASH_SESSION_OPENED'::public.audit_action,
    v_user_id,
    jsonb_build_object(
      'opening_cash_amount', p_opening_cash_amount,
      'opening_note', NULLIF(btrim(p_opening_note), '')
    )
  );

  RETURN v_session_id;
END;
$$;
