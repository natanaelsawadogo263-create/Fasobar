-- FasoBar: autoriser plusieurs pompistes simultanés (une session par pompe / par user)

CREATE OR REPLACE FUNCTION public.open_pump_session(
  p_fuel_pump_id uuid,
  p_index_start numeric,
  p_note text DEFAULT NULL,
  p_index_gap_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_pump record;
  v_last_session record;
  v_price integer;
  v_index_gap numeric;
  v_session_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT p.*, ft.selling_price
  INTO v_pump
  FROM public.fuel_pumps p
  JOIN public.fuel_types ft ON ft.id = p.fuel_type_id
  WHERE p.id = p_fuel_pump_id AND p.active
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pompe introuvable ou inactive';
  END IF;

  IF NOT public.user_belongs_to_establishment(v_user_id, v_pump.establishment_id) THEN
    RAISE EXCEPTION 'Accès interdit';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pump_sessions
    WHERE fuel_pump_id = p_fuel_pump_id AND status = 'OPEN'
  ) THEN
    RAISE EXCEPTION 'Une session est déjà ouverte sur cette pompe';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pump_sessions
    WHERE opened_by = v_user_id
      AND establishment_id = v_pump.establishment_id
      AND status = 'OPEN'
  ) THEN
    RAISE EXCEPTION 'Vous avez déjà une session ouverte';
  END IF;

  v_price := v_pump.selling_price;

  SELECT index_end INTO v_last_session
  FROM public.pump_sessions
  WHERE fuel_pump_id = p_fuel_pump_id AND status = 'CLOSED'
  ORDER BY closed_at DESC NULLS LAST
  LIMIT 1;

  IF v_last_session.index_end IS NOT NULL THEN
    v_index_gap := p_index_start - v_last_session.index_end;
  ELSE
    v_index_gap := NULL;
  END IF;

  INSERT INTO public.pump_sessions (
    organization_id, establishment_id,
    fuel_pump_id, fuel_type_id, fuel_tank_id,
    opened_by, status,
    price_per_liter, index_start,
    index_gap_from_previous,
    index_gap_reason,
    opening_note
  ) VALUES (
    v_pump.organization_id, v_pump.establishment_id,
    v_pump.id, v_pump.fuel_type_id, v_pump.fuel_tank_id,
    v_user_id, 'OPEN',
    v_price, p_index_start,
    v_index_gap,
    CASE
      WHEN v_index_gap IS NOT NULL AND v_index_gap <> 0 THEN p_index_gap_reason
      ELSE NULL
    END,
    p_note
  )
  RETURNING id INTO v_session_id;

  UPDATE public.fuel_pumps
  SET current_index = p_index_start, updated_at = now()
  WHERE id = p_fuel_pump_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'price_per_liter', v_price,
    'index_gap', v_index_gap
  );
END;
$$;

REVOKE ALL ON FUNCTION public.open_pump_session(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_pump_session(uuid, numeric, text, text) TO authenticated;

-- Clôture réservée au pompiste ayant ouvert (ou admin org)

CREATE OR REPLACE FUNCTION public.close_pump_session(
  p_session_id uuid,
  p_index_end numeric,
  p_payments jsonb DEFAULT '[]'::jsonb,
  p_credit_amount integer DEFAULT 0,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_session record;
  v_liters numeric;
  v_expected integer;
  v_total_collected integer := 0;
  v_difference integer;
  v_payment record;
  v_volume_before numeric;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT * INTO v_session
  FROM public.pump_sessions
  WHERE id = p_session_id AND status = 'OPEN'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session introuvable ou déjà clôturée';
  END IF;

  IF NOT public.user_belongs_to_establishment(v_user_id, v_session.establishment_id) THEN
    RAISE EXCEPTION 'Accès interdit';
  END IF;

  IF v_session.opened_by <> v_user_id
     AND NOT public.user_is_organization_owner_or_admin(v_user_id, v_session.organization_id) THEN
    RAISE EXCEPTION 'Seul le pompiste ayant ouvert la session peut la clôturer';
  END IF;

  IF p_index_end < v_session.index_start THEN
    RAISE EXCEPTION 'L''index de fin ne peut pas être inférieur à l''index de début';
  END IF;

  v_liters := p_index_end - v_session.index_start;
  v_expected := ROUND(v_liters * v_session.price_per_liter)::integer;

  FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS x(method text, amount integer)
  LOOP
    IF v_payment.amount > 0 THEN
      INSERT INTO public.pump_session_payments (
        pump_session_id, organization_id, establishment_id, method, amount
      ) VALUES (
        p_session_id, v_session.organization_id, v_session.establishment_id,
        v_payment.method::public.payment_method, v_payment.amount
      );
      v_total_collected := v_total_collected + v_payment.amount;
    END IF;
  END LOOP;

  v_difference := v_total_collected + COALESCE(p_credit_amount, 0) - v_expected;

  UPDATE public.pump_sessions SET
    status = 'CLOSED',
    closed_by = v_user_id,
    index_end = p_index_end,
    liters_sold = v_liters,
    expected_amount = v_expected,
    total_collected = v_total_collected,
    credit_amount = COALESCE(p_credit_amount, 0),
    cash_difference = v_difference,
    closing_note = p_note,
    closed_at = now(),
    updated_at = now()
  WHERE id = p_session_id;

  UPDATE public.fuel_pumps SET current_index = p_index_end, updated_at = now()
  WHERE id = v_session.fuel_pump_id;

  IF v_liters > 0 THEN
    SELECT current_volume INTO v_volume_before
    FROM public.fuel_tanks WHERE id = v_session.fuel_tank_id FOR UPDATE;

    UPDATE public.fuel_tanks SET
      current_volume = GREATEST(current_volume - v_liters, 0),
      updated_at = now()
    WHERE id = v_session.fuel_tank_id;

    INSERT INTO public.fuel_tank_movements (
      organization_id, establishment_id, fuel_tank_id,
      type, quantity, volume_before, volume_after,
      reference_id, created_by
    ) VALUES (
      v_session.organization_id, v_session.establishment_id, v_session.fuel_tank_id,
      'SALE', v_liters, v_volume_before, GREATEST(v_volume_before - v_liters, 0),
      p_session_id, v_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'liters_sold', v_liters,
    'expected_amount', v_expected,
    'total_collected', v_total_collected,
    'credit_amount', COALESCE(p_credit_amount, 0),
    'cash_difference', v_difference
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_pump_session(uuid, numeric, jsonb, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_pump_session(uuid, numeric, jsonb, integer, text) TO authenticated;
