-- FasoBar: ouverture de relève par ligne carburant (SUPER_1, GAZ_OIL_1…)
-- L'admin configure carburants + cuves ; les pompes sont provisionnées automatiquement.

CREATE OR REPLACE FUNCTION public.gas_station_fuel_line_label(p_fuel_line_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_fuel_line_id
    WHEN 'SUPER_1' THEN 'SUPER 1'
    WHEN 'SUPER_2' THEN 'SUPER 2'
    WHEN 'SUPER_3' THEN 'SUPER 3'
    WHEN 'SUPER_4' THEN 'SUPER 4'
    WHEN 'SUPER_5' THEN 'SUPER 5'
    WHEN 'SUPER_6' THEN 'SUPER 6'
    WHEN 'GAZ_OIL_1' THEN 'GAZ OIL 1'
    WHEN 'GAZ_OIL_2' THEN 'GAZ OIL 2'
    WHEN 'GAZ_OIL_3' THEN 'GAZ OIL 3'
    WHEN 'GAZ_OIL_4' THEN 'GAZ OIL 4'
    WHEN 'GAZ_OIL_5' THEN 'GAZ OIL 5'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.gas_station_fuel_line_kind(p_fuel_line_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_fuel_line_id LIKE 'SUPER\_%' ESCAPE '\' THEN 'SUPER'
    WHEN p_fuel_line_id LIKE 'GAZ_OIL\_%' ESCAPE '\' THEN 'GAZ_OIL'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.gas_station_resolve_fuel_type_for_line(
  p_establishment_id uuid,
  p_fuel_line_id text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_kind text;
  v_fuel_type_id uuid;
BEGIN
  v_kind := public.gas_station_fuel_line_kind(p_fuel_line_id);
  IF v_kind IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ft.id
  INTO v_fuel_type_id
  FROM public.fuel_types ft
  WHERE ft.establishment_id = p_establishment_id
    AND ft.active
    AND (
      (
        v_kind = 'SUPER'
        AND (
          upper(ft.name) LIKE '%SUPER%'
          OR upper(ft.name) LIKE '% SS%'
          OR upper(ft.name) LIKE 'SS%'
          OR upper(ft.name) LIKE '%SP95%'
          OR upper(ft.name) LIKE '%SP98%'
        )
      )
      OR (
        v_kind = 'GAZ_OIL'
        AND (
          upper(ft.name) LIKE '%GAZOIL%'
          OR upper(ft.name) LIKE '%GASOIL%'
          OR upper(ft.name) LIKE '%DIESEL%'
          OR upper(ft.name) LIKE '%GO%'
        )
      )
    )
  ORDER BY ft.sort_order NULLS LAST, ft.name
  LIMIT 1;

  RETURN v_fuel_type_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gas_station_ensure_fuel_pump_for_line(
  p_establishment_id uuid,
  p_fuel_line_id text,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_label text;
  v_fuel_type_id uuid;
  v_fuel_tank_id uuid;
  v_pump_id uuid;
BEGIN
  v_label := public.gas_station_fuel_line_label(p_fuel_line_id);
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'Ligne carburant invalide';
  END IF;

  SELECT e.organization_id
  INTO v_org_id
  FROM public.establishments e
  WHERE e.id = p_establishment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Établissement introuvable';
  END IF;

  v_fuel_type_id := public.gas_station_resolve_fuel_type_for_line(
    p_establishment_id,
    p_fuel_line_id
  );

  IF v_fuel_type_id IS NULL THEN
    RAISE EXCEPTION 'Carburant non configuré pour cette ligne';
  END IF;

  SELECT t.id
  INTO v_fuel_tank_id
  FROM public.fuel_tanks t
  WHERE t.establishment_id = p_establishment_id
    AND t.fuel_type_id = v_fuel_type_id
    AND t.active
  ORDER BY t.name
  LIMIT 1;

  IF v_fuel_tank_id IS NULL THEN
    RAISE EXCEPTION 'Cuve non configurée pour ce carburant';
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

CREATE OR REPLACE FUNCTION public.open_pump_session_by_fuel_line(
  p_establishment_id uuid,
  p_fuel_line_id text,
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
  v_pump_id uuid;
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

  IF public.gas_station_fuel_line_label(p_fuel_line_id) IS NULL THEN
    RAISE EXCEPTION 'Ligne carburant invalide';
  END IF;

  IF NOT public.user_belongs_to_establishment(v_user_id, p_establishment_id) THEN
    RAISE EXCEPTION 'Accès interdit';
  END IF;

  v_pump_id := public.gas_station_ensure_fuel_pump_for_line(
    p_establishment_id,
    p_fuel_line_id,
    v_user_id
  );

  SELECT p.*, ft.selling_price
  INTO v_pump
  FROM public.fuel_pumps p
  JOIN public.fuel_types ft ON ft.id = p.fuel_type_id
  WHERE p.id = v_pump_id AND p.active
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pompe introuvable ou inactive';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pump_sessions
    WHERE establishment_id = p_establishment_id
      AND status = 'OPEN'
      AND active_fuel_line_id = p_fuel_line_id
  ) THEN
    RAISE EXCEPTION 'Une session est déjà ouverte sur cette ligne';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pump_sessions
    WHERE fuel_pump_id = v_pump_id AND status = 'OPEN'
  ) THEN
    RAISE EXCEPTION 'Une session est déjà ouverte sur cette pompe';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pump_sessions
    WHERE opened_by = v_user_id
      AND establishment_id = p_establishment_id
      AND status = 'OPEN'
  ) THEN
    RAISE EXCEPTION 'Vous avez déjà une session ouverte';
  END IF;

  v_price := v_pump.selling_price;

  SELECT index_end INTO v_last_session
  FROM public.pump_sessions
  WHERE establishment_id = p_establishment_id
    AND status = 'CLOSED'
    AND active_fuel_line_id = p_fuel_line_id
  ORDER BY closed_at DESC NULLS LAST
  LIMIT 1;

  IF v_last_session.index_end IS NULL THEN
    SELECT index_end INTO v_last_session
    FROM public.pump_sessions
    WHERE fuel_pump_id = v_pump_id AND status = 'CLOSED'
    ORDER BY closed_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_last_session.index_end IS NOT NULL THEN
    v_index_gap := p_index_start - v_last_session.index_end;
  ELSE
    v_index_gap := NULL;
  END IF;

  INSERT INTO public.pump_sessions (
    organization_id,
    establishment_id,
    fuel_pump_id,
    fuel_type_id,
    fuel_tank_id,
    opened_by,
    status,
    price_per_liter,
    index_start,
    index_gap_from_previous,
    index_gap_reason,
    opening_note,
    active_fuel_line_id
  ) VALUES (
    v_pump.organization_id,
    v_pump.establishment_id,
    v_pump.id,
    v_pump.fuel_type_id,
    v_pump.fuel_tank_id,
    v_user_id,
    'OPEN',
    v_price,
    p_index_start,
    v_index_gap,
    CASE
      WHEN v_index_gap IS NOT NULL AND v_index_gap <> 0 THEN p_index_gap_reason
      ELSE NULL
    END,
    p_note,
    p_fuel_line_id
  )
  RETURNING id INTO v_session_id;

  UPDATE public.fuel_pumps
  SET current_index = p_index_start, updated_at = now()
  WHERE id = v_pump_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'fuel_pump_id', v_pump_id,
    'price_per_liter', v_price,
    'index_gap', v_index_gap,
    'active_fuel_line_id', p_fuel_line_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.open_pump_session_by_fuel_line(uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_pump_session_by_fuel_line(uuid, text, numeric, text, text) TO authenticated;
