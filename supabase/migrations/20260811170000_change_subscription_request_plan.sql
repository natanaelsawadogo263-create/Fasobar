-- FasoBar: permettre de changer mensuel ↔ annuel sur une demande ouverte
-- (PENDING_PAYMENT / NEEDS_NEW_PROOF). Appliquer manuellement.

CREATE OR REPLACE FUNCTION public.change_open_subscription_request_plan(
  p_request_id uuid,
  p_plan_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req public.subscription_requests%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT * INTO v_req
  FROM public.subscription_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable.';
  END IF;

  IF NOT public.platform_is_org_owner(v_req.organization_id) THEN
    RAISE EXCEPTION 'Seul le OWNER peut modifier la formule.';
  END IF;

  IF v_req.status NOT IN (
    'PENDING_PAYMENT'::public.subscription_request_status,
    'NEEDS_NEW_PROOF'::public.subscription_request_status
  ) THEN
    RAISE EXCEPTION 'La formule ne peut plus être modifiée à ce stade.';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = p_plan_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formule introuvable ou inactive.';
  END IF;

  IF v_req.plan_id = v_plan.id THEN
    RETURN;
  END IF;

  UPDATE public.subscription_requests
  SET
    plan_id = v_plan.id,
    plan_code = v_plan.code,
    plan_name = v_plan.name,
    billing_period = v_plan.billing_period,
    duration_months = v_plan.duration_months,
    currency = v_plan.currency,
    price_xof = v_plan.price_xof,
    max_machines = v_plan.max_machines,
    expected_amount_xof = v_plan.price_xof
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.change_open_subscription_request_plan(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_open_subscription_request_plan(uuid, uuid)
  TO authenticated;
