-- FasoBar: gas station - store reason for index gap on pump session opening

-- Signature extended with p_index_gap_reason to trace discrepancies between
-- last session index_end and current index_start.

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

  -- Check no open session on this pump
  IF EXISTS (
    SELECT 1 FROM public.pump_sessions
    WHERE fuel_pump_id = p_fuel_pump_id AND status = 'OPEN'
  ) THEN
    RAISE EXCEPTION 'Une session est déjà ouverte sur cette pompe';
  END IF;

  -- Check user has no open session
  IF EXISTS (
    SELECT 1 FROM public.pump_sessions
    WHERE opened_by = v_user_id
      AND establishment_id = v_pump.establishment_id
      AND status = 'OPEN'
  ) THEN
    RAISE EXCEPTION 'Vous avez déjà une session ouverte';
  END IF;

  -- Check establishment has no other open station session
  IF EXISTS (
    SELECT 1 FROM public.pump_sessions
    WHERE organization_id = v_pump.organization_id
      AND establishment_id = v_pump.establishment_id
      AND status = 'OPEN'
  ) THEN
    RAISE EXCEPTION 'Une session station est déjà ouverte pour cet établissement';
  END IF;

  v_price := v_pump.selling_price;

  -- Detect index gap from previous session on this pump
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

  -- Update pump current index
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

