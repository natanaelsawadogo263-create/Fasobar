-- Frais de livraison : le livreur déclare le coût de la course en finalisant ;
-- le montant devient automatiquement une dépense « Transport » de la boutique.

ALTER TABLE public.delivery_orders
  ADD COLUMN IF NOT EXISTS delivery_fee integer,
  ADD COLUMN IF NOT EXISTS delivery_fee_expense_id uuid
    REFERENCES public.expenses (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_orders_delivery_fee_non_negative'
  ) THEN
    ALTER TABLE public.delivery_orders
      ADD CONSTRAINT delivery_orders_delivery_fee_non_negative
      CHECK (delivery_fee IS NULL OR delivery_fee >= 0);
  END IF;
END
$$;

COMMENT ON COLUMN public.delivery_orders.delivery_fee IS
  'Coût de la course déclaré par le livreur à la finalisation (XOF).';
COMMENT ON COLUMN public.delivery_orders.delivery_fee_expense_id IS
  'Dépense « Transport » créée automatiquement pour ces frais.';

-- ---------------------------------------------------------------------------
-- complete_delivery_order_with_fee — finalise puis enregistre les frais en dépense
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_delivery_order_with_fee(
  p_order_id uuid,
  p_delivery_fee integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.delivery_orders%ROWTYPE;
  v_reference text;
  v_expense_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_delivery_fee IS NULL OR p_delivery_fee < 0 THEN
    RAISE EXCEPTION 'Indiquez le coût de la course (0 si gratuite).';
  END IF;

  -- Contrôles (livreur attribué, statut) + débit du stock livreur.
  PERFORM public.complete_delivery_order(p_order_id);

  SELECT * INTO v_order
  FROM public.delivery_orders
  WHERE id = p_order_id
  FOR UPDATE;

  v_reference := 'L-' || lpad(v_order.order_number::text, 4, '0');

  IF p_delivery_fee > 0 AND v_order.delivery_fee_expense_id IS NULL THEN
    INSERT INTO public.expenses (
      organization_id, establishment_id, category, area, label, amount,
      expense_date, reference, note, created_by, updated_by
    )
    VALUES (
      v_order.organization_id, v_order.establishment_id,
      'TRANSPORT'::public.expense_category, 'CAISSE'::public.expense_area,
      'Frais de livraison ' || v_reference, p_delivery_fee,
      CURRENT_DATE, v_reference,
      'Déclaré automatiquement par le livreur à la fin de la course.',
      v_actor, v_actor
    )
    RETURNING id INTO v_expense_id;
  END IF;

  UPDATE public.delivery_orders
  SET delivery_fee = p_delivery_fee,
      delivery_fee_expense_id = COALESCE(v_expense_id, delivery_fee_expense_id)
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_delivery_order_with_fee(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_delivery_order_with_fee(uuid, integer) TO authenticated;
