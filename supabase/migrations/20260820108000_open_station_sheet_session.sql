-- FasoBar: ouverture directe de la fiche journalière (sans sélection pompe/ligne)

CREATE OR REPLACE FUNCTION public.gas_station_resolve_default_fuel_refs(
  p_establishment_id uuid
)
RETURNS TABLE (fuel_type_id uuid, fuel_tank_id uuid, selling_price integer)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT ft.id, t.id, ft.selling_price
  FROM public.fuel_types ft
  JOIN public.fuel_tanks t
    ON t.fuel_type_id = ft.id
   AND t.establishment_id = ft.establishment_id
   AND t.active
  WHERE ft.establishment_id = p_establishment_id
    AND ft.active
  ORDER BY ft.sort_order NULLS LAST, ft.name, t.name
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.gas_station_ensure_sheet_pump(
  p_establishment_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_fuel_type_id uuid;
  v_fuel_tank_id uuid;
  v_pump_id uuid;
  v_label constant text := 'FICHE JOURNALIERE';
BEGIN
  SELECT e.organization_id
  INTO v_org_id
  FROM public.establishments e
  WHERE e.id = p_establishment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Établissement introuvable';
  END IF;

  SELECT r.fuel_type_id, r.fuel_tank_id
  INTO v_fuel_type_id, v_fuel_tank_id
  FROM public.gas_station_resolve_default_fuel_refs(p_establishment_id) r;

  IF v_fuel_type_id IS NULL OR v_fuel_tank_id IS NULL THEN
    RAISE EXCEPTION 'Carburant ou cuve non configuré';
  END IF;

  SELECT p.id
  INTO v_pump_id
  FROM public.fuel_pumps p
  WHERE p.establishment_id = p_establishment_id
    AND upper(btrim(p.name)) = upper(v_label)
  LIMIT 1;

  IF v_pump_id IS NULL THEN
    INSERT INTO public.fuel_pumps (
      organization_id,
      establishment_id,
      fuel_type_id,
      fuel_tank_id,
      name,
      created_by,
      active
    ) VALUES (
      v_org_id,
      p_establishment_id,
      v_fuel_type_id,
      v_fuel_tank_id,
      v_label,
      p_user_id,
      true
    )
    RETURNING id INTO v_pump_id;
  END IF;

  RETURN v_pump_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_station_sheet_session(
  p_establishment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_pump_id uuid;
  v_pump record;
  v_price integer;
  v_session_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF NOT public.user_belongs_to_establishment(v_user_id, p_establishment_id) THEN
    RAISE EXCEPTION 'Accès interdit';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pump_sessions
    WHERE opened_by = v_user_id
      AND establishment_id = p_establishment_id
      AND status = 'OPEN'
  ) THEN
    RAISE EXCEPTION 'Vous avez déjà une session ouverte';
  END IF;

  v_pump_id := public.gas_station_ensure_sheet_pump(p_establishment_id, v_user_id);

  SELECT p.*, ft.selling_price
  INTO v_pump
  FROM public.fuel_pumps p
  JOIN public.fuel_types ft ON ft.id = p.fuel_type_id
  WHERE p.id = v_pump_id AND p.active
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session station indisponible';
  END IF;

  v_price := v_pump.selling_price;

  INSERT INTO public.pump_sessions (
    organization_id,
    establishment_id,
    fuel_pump_id,
    fuel_type_id,
    fuel_tank_id,
    opened_by,
    status,
    price_per_liter,
    index_start
  ) VALUES (
    v_pump.organization_id,
    v_pump.establishment_id,
    v_pump.id,
    v_pump.fuel_type_id,
    v_pump.fuel_tank_id,
    v_user_id,
    'OPEN',
    v_price,
    0
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'fuel_pump_id', v_pump_id,
    'price_per_liter', v_price
  );
END;
$$;

REVOKE ALL ON FUNCTION public.open_station_sheet_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_station_sheet_session(uuid) TO authenticated;
