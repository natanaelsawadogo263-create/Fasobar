-- FasoBar: gas station - support explicit dates for deliveries/losses/gauges

-- DELIVERY with received_on
CREATE OR REPLACE FUNCTION public.record_fuel_delivery(
  p_fuel_tank_id uuid,
  p_quantity numeric,
  p_supplier_id uuid DEFAULT NULL,
  p_purchase_price integer DEFAULT NULL,
  p_total_cost integer DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_received_on date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_tank record;
  v_volume_before numeric;
  v_delivery_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT * INTO v_tank
  FROM public.fuel_tanks WHERE id = p_fuel_tank_id AND active
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuve introuvable ou inactive';
  END IF;

  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_tank.organization_id) THEN
    RAISE EXCEPTION 'Seul un administrateur peut enregistrer une livraison';
  END IF;

  v_volume_before := v_tank.current_volume;

  UPDATE public.fuel_tanks SET
    current_volume = current_volume + p_quantity,
    updated_at = now()
  WHERE id = p_fuel_tank_id;

  INSERT INTO public.fuel_tank_movements (
    organization_id, establishment_id, fuel_tank_id,
    type, quantity, volume_before, volume_after,
    created_by
  ) VALUES (
    v_tank.organization_id, v_tank.establishment_id, p_fuel_tank_id,
    'DELIVERY', p_quantity, v_volume_before, v_volume_before + p_quantity,
    v_user_id
  );

  INSERT INTO public.fuel_deliveries (
    organization_id, establishment_id,
    fuel_type_id, fuel_tank_id, supplier_id,
    quantity, purchase_price_per_liter, total_cost,
    volume_before, volume_after,
    received_on, notes, created_by
  ) VALUES (
    v_tank.organization_id, v_tank.establishment_id,
    v_tank.fuel_type_id, p_fuel_tank_id, p_supplier_id,
    p_quantity, p_purchase_price, p_total_cost,
    v_volume_before, v_volume_before + p_quantity,
    COALESCE(p_received_on, CURRENT_DATE),
    p_notes, v_user_id
  )
  RETURNING id INTO v_delivery_id;

  RETURN v_delivery_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_fuel_delivery(uuid, numeric, uuid, integer, integer, text, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_fuel_delivery(uuid, numeric, uuid, integer, integer, text, date)
  TO authenticated;

-- LOSS with loss_date
CREATE OR REPLACE FUNCTION public.record_fuel_loss(
  p_fuel_tank_id uuid,
  p_quantity numeric,
  p_reason text,
  p_loss_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_tank record;
  v_volume_before numeric;
  v_loss_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT * INTO v_tank
  FROM public.fuel_tanks WHERE id = p_fuel_tank_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuve introuvable';
  END IF;

  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_tank.organization_id) THEN
    RAISE EXCEPTION 'Seul un administrateur peut déclarer une perte';
  END IF;

  v_volume_before := v_tank.current_volume;

  UPDATE public.fuel_tanks SET
    current_volume = GREATEST(current_volume - p_quantity, 0),
    updated_at = now()
  WHERE id = p_fuel_tank_id;

  INSERT INTO public.fuel_tank_movements (
    organization_id, establishment_id, fuel_tank_id,
    type, quantity, volume_before, volume_after,
    reason, created_by
  ) VALUES (
    v_tank.organization_id, v_tank.establishment_id, p_fuel_tank_id,
    'LOSS', p_quantity, v_volume_before, GREATEST(v_volume_before - p_quantity, 0),
    p_reason, v_user_id
  );

  INSERT INTO public.fuel_losses (
    organization_id, establishment_id,
    fuel_type_id, fuel_tank_id,
    quantity, reason, loss_date, created_by
  ) VALUES (
    v_tank.organization_id, v_tank.establishment_id,
    v_tank.fuel_type_id, p_fuel_tank_id,
    p_quantity, p_reason, COALESCE(p_loss_date, CURRENT_DATE), v_user_id
  )
  RETURNING id INTO v_loss_id;

  RETURN v_loss_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_fuel_loss(uuid, numeric, text, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_fuel_loss(uuid, numeric, text, date)
  TO authenticated;

-- GAUGE with gauged_on
CREATE OR REPLACE FUNCTION public.record_fuel_tank_gauge(
  p_fuel_tank_id uuid,
  p_actual_volume numeric,
  p_apply_correction boolean DEFAULT false,
  p_notes text DEFAULT NULL,
  p_gauged_on date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_tank record;
  v_theoretical numeric;
  v_difference numeric;
  v_gauge_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT * INTO v_tank
  FROM public.fuel_tanks WHERE id = p_fuel_tank_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuve introuvable';
  END IF;

  IF NOT public.user_is_organization_owner_or_admin(v_user_id, v_tank.organization_id) THEN
    RAISE EXCEPTION 'Seul un administrateur peut effectuer un jaugeage';
  END IF;

  v_theoretical := v_tank.current_volume;
  v_difference := p_actual_volume - v_theoretical;

  INSERT INTO public.fuel_tank_gauges (
    organization_id, establishment_id, fuel_tank_id,
    theoretical_volume, actual_volume, difference,
    notes, gauged_by, gauged_on
  ) VALUES (
    v_tank.organization_id, v_tank.establishment_id, p_fuel_tank_id,
    v_theoretical, p_actual_volume, v_difference,
    p_notes, v_user_id, COALESCE(p_gauged_on, CURRENT_DATE)
  )
  RETURNING id INTO v_gauge_id;

  IF p_apply_correction AND v_difference <> 0 THEN
    UPDATE public.fuel_tanks SET
      current_volume = p_actual_volume,
      updated_at = now()
    WHERE id = p_fuel_tank_id;

    INSERT INTO public.fuel_tank_movements (
      organization_id, establishment_id, fuel_tank_id,
      type, quantity, volume_before, volume_after,
      reason, created_by
    ) VALUES (
      v_tank.organization_id, v_tank.establishment_id, p_fuel_tank_id,
      'GAUGE_CORRECTION', ABS(v_difference), v_theoretical, p_actual_volume,
      'Correction après jaugeage', v_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'gauge_id', v_gauge_id,
    'theoretical', v_theoretical,
    'actual', p_actual_volume,
    'difference', v_difference,
    'corrected', p_apply_correction AND v_difference <> 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_fuel_tank_gauge(uuid, numeric, boolean, text, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_fuel_tank_gauge(uuid, numeric, boolean, text, date)
  TO authenticated;

