-- Réouverture d’un approvisionnement validé : ADMIN uniquement.
-- Annule le stock des mouvements PURCHASE liés, repasse le bon en DRAFT.

CREATE OR REPLACE FUNCTION public.reopen_supply_receipt(p_receipt_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_receipt public.supply_receipts%ROWTYPE;
  v_ref text;
  v_movement record;
  v_item public.stock_items%ROWTYPE;
  v_before numeric(14, 3);
  v_after numeric(14, 3);
  v_qty numeric(14, 3);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT *
  INTO v_receipt
  FROM public.supply_receipts
  WHERE id = p_receipt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approvisionnement introuvable.';
  END IF;

  -- Réservé à l’admin (OWNER / ADMIN / MANAGER), pas bar / caisse.
  IF NOT public.user_can_manage_products(v_user_id, v_receipt.establishment_id) THEN
    RAISE EXCEPTION 'Seul l''administrateur peut réouvrir un approvisionnement.';
  END IF;

  IF v_receipt.status <> 'VALIDATED'::public.supply_receipt_status THEN
    RAISE EXCEPTION 'Seuls les approvisionnements validés peuvent être réouverts.';
  END IF;

  v_ref := 'APP-' || left(v_receipt.id::text, 8);

  FOR v_movement IN
    SELECT *
    FROM public.stock_movements
    WHERE establishment_id = v_receipt.establishment_id
      AND organization_id = v_receipt.organization_id
      AND type = 'PURCHASE'::public.stock_movement_type
      AND reference = v_ref
    ORDER BY created_at
    FOR UPDATE
  LOOP
    v_qty := abs(v_movement.quantity);

    SELECT *
    INTO v_item
    FROM public.stock_items
    WHERE id = v_movement.stock_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article de stock introuvable pour la réouverture.';
    END IF;

    v_before := v_item.current_quantity;
    v_after := v_before - v_qty;

    IF v_after < 0 THEN
      RAISE EXCEPTION
        'Stock insuffisant pour réouvrir cet approvisionnement (article déjà vendu ou sorti).';
    END IF;

    UPDATE public.stock_items
    SET current_quantity = v_after, updated_at = now()
    WHERE id = v_item.id;

    INSERT INTO public.stock_movements (
      organization_id,
      establishment_id,
      stock_item_id,
      type,
      quantity,
      quantity_before,
      quantity_after,
      unit_cost,
      total_cost,
      supplier_id,
      reference,
      reason,
      created_by
    )
    VALUES (
      v_item.organization_id,
      v_item.establishment_id,
      v_item.id,
      'INVENTORY_ADJUSTMENT'::public.stock_movement_type,
      -v_qty,
      v_before,
      v_after,
      v_movement.unit_cost,
      CASE
        WHEN v_movement.unit_cost IS NOT NULL THEN v_movement.unit_cost * ceil(v_qty)::integer
        ELSE NULL
      END,
      v_movement.supplier_id,
      v_ref,
      'Réouverture approvisionnement (annulation entrée)',
      v_user_id
    );

    DELETE FROM public.stock_movements
    WHERE id = v_movement.id;
  END LOOP;

  UPDATE public.supply_receipts
  SET
    status = 'DRAFT'::public.supply_receipt_status,
    validated_at = NULL,
    validated_by = NULL,
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = v_receipt.id;

  RETURN v_receipt.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_supply_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_supply_receipt(uuid) TO authenticated;
