-- Frais de livraison : la dépense « Transport » naît à l'encaissement.
--
-- Avant : la dépense était créée quand le livreur finalisait la course, et la
-- vente quand la caisse encaissait. Si l'encaissement avait lieu un autre jour,
-- la vente et son coût tombaient sur deux journées différentes (bénéfice du jour
-- faussé), et une livraison jamais encaissée laissait une dépense sans vente.
--
-- Maintenant :
--   * le livreur déclare seulement le montant (delivery_fee) en finalisant ;
--   * cash_delivery_order crée la dépense le jour de l'encaissement, dans la
--     même transaction que la vente ;
--   * livraisons finalisées avant cette migration (dépense déjà créée, pas
--     encore encaissées) : la dépense existante est redatée au jour de
--     l'encaissement, sans doublon.
-- Prérequis : 20261028140000_delivery_fee_retained.sql.

-- ---------------------------------------------------------------------------
-- complete_delivery_order_with_fee — note les frais, sans créer de dépense
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
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_delivery_fee IS NULL OR p_delivery_fee < 0 THEN
    RAISE EXCEPTION 'Indiquez le coût de la course (0 si gratuite).';
  END IF;

  SELECT * INTO v_order
  FROM public.delivery_orders
  WHERE id = p_order_id;

  IF FOUND AND p_delivery_fee > v_order.total_amount THEN
    RAISE EXCEPTION 'Les frais de livraison ne peuvent pas dépasser le montant de la commande.';
  END IF;

  -- Contrôles (livreur attribué, statut) + débit du stock livreur.
  PERFORM public.complete_delivery_order(p_order_id);

  -- La dépense « Transport » sera créée à l'encaissement (cash_delivery_order).
  UPDATE public.delivery_orders
  SET delivery_fee = p_delivery_fee
  WHERE id = p_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- cash_delivery_order — vente + dépense « Transport » le même jour
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cash_delivery_order(
  p_order_id uuid,
  p_method public.payment_method,
  p_amount_received integer DEFAULT NULL,
  p_transaction_reference text DEFAULT NULL,
  p_provider text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_delivery public.delivery_orders%ROWTYPE;
  v_line record;
  v_sale_id uuid;
  v_sale_number integer;
  v_department_id uuid;
  v_label text;
  v_reference text;
  v_payment jsonb;
  v_fee integer;
  v_net integer;
  v_expense_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  IF p_method IS NULL THEN
    RAISE EXCEPTION 'Choisissez un mode de paiement.';
  END IF;

  SELECT * INTO v_delivery
  FROM public.delivery_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  PERFORM public.delivery_require_ecommerce(v_delivery.establishment_id);

  IF NOT (
    public.delivery_user_is_manager(v_actor, v_delivery.establishment_id)
    OR public.user_has_establishment_role(v_actor, v_delivery.establishment_id, 'CASHIER_KITCHEN'::public.membership_role)
    OR public.user_has_establishment_role(v_actor, v_delivery.establishment_id, 'CASHIER'::public.membership_role)
  ) THEN
    RAISE EXCEPTION 'Permission insuffisante pour encaisser cette commande.';
  END IF;

  IF v_delivery.cashed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cette commande a déjà été encaissée.';
  END IF;

  IF v_delivery.status <> 'DELIVERED'::public.delivery_order_status THEN
    RAISE EXCEPTION 'Seule une commande livrée peut être encaissée.';
  END IF;

  IF v_delivery.total_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de commande invalide.';
  END IF;

  -- Frais de course retenus par le livreur sur l'argent du client :
  -- la caisse ne reçoit que le reste.
  v_fee := LEAST(GREATEST(COALESCE(v_delivery.delivery_fee, 0), 0), v_delivery.total_amount);
  v_net := v_delivery.total_amount - v_fee;

  -- Encaissement uniquement dans une session de caisse ouverte (tous modes).
  IF public.get_active_cash_session(v_actor, v_delivery.establishment_id) IS NULL THEN
    RAISE EXCEPTION 'Ouvrez votre session de caisse avant d''encaisser.';
  END IF;

  v_reference := 'L-' || lpad(v_delivery.order_number::text, 4, '0');
  v_label := 'Livraison ' || v_reference;
  v_sale_number := public.next_order_number(v_delivery.establishment_id);

  INSERT INTO public.orders (
    organization_id,
    establishment_id,
    order_number,
    customer_reference,
    order_type,
    status,
    payment_status,
    subtotal,
    discount_amount,
    total_amount,
    notes,
    created_by,
    updated_by,
    stock_posted_at
  )
  VALUES (
    v_delivery.organization_id,
    v_delivery.establishment_id,
    v_sale_number,
    COALESCE(v_delivery.customer_name, v_label),
    'TAKEAWAY'::public.order_type,
    'OPEN'::public.order_status,
    'UNPAID'::public.order_payment_status,
    v_delivery.total_amount,
    0,
    v_delivery.total_amount,
    v_label,
    v_actor,
    v_actor,
    -- Stock déjà sorti vers le livreur : empêche un second débit au paiement.
    now()
  )
  RETURNING id INTO v_sale_id;

  FOR v_line IN
    SELECT i.product_id, i.product_name, i.unit_price, i.quantity, i.line_total,
           i.unit_level_id, i.sale_unit_name, i.sale_unit_factor, i.stock_quantity
    FROM public.delivery_order_items i
    WHERE i.delivery_order_id = p_order_id
    ORDER BY i.product_id, i.sale_unit_factor
  LOOP
    SELECT p.department_id INTO v_department_id
    FROM public.products p
    WHERE p.id = v_line.product_id;

    IF v_department_id IS NULL THEN
      RAISE EXCEPTION 'Article « % » introuvable dans le catalogue.', v_line.product_name;
    END IF;

    INSERT INTO public.order_items (
      organization_id,
      establishment_id,
      order_id,
      product_id,
      department_id,
      product_name_snapshot,
      unit_price_snapshot,
      quantity,
      line_total,
      unit_level_id,
      sale_unit_name,
      sale_unit_factor,
      stock_quantity
    )
    VALUES (
      v_delivery.organization_id,
      v_delivery.establishment_id,
      v_sale_id,
      v_line.product_id,
      v_department_id,
      v_line.product_name,
      v_line.unit_price,
      v_line.quantity,
      v_line.line_total,
      v_line.unit_level_id,
      v_line.sale_unit_name,
      v_line.sale_unit_factor,
      v_line.stock_quantity
    );
  END LOOP;

  -- Chemin officiel : paiement, statut PAID, reçu, fond de caisse, journal.
  -- 1) Part retenue par le livreur : réglée hors tiroir (mode OTHER), elle ne
  --    compte pas dans les espèces attendues.
  IF v_fee > 0 THEN
    v_payment := public.record_order_payment(
      v_sale_id,
      'OTHER'::public.payment_method,
      v_fee,
      NULL,
      v_reference,
      'Frais livreur',
      'Frais de livraison retenus par le livreur',
      'delivery-' || p_order_id::text || '-fee'
    );
  END IF;

  -- 2) Ce que la caisse reçoit réellement.
  IF v_net > 0 THEN
    v_payment := public.record_order_payment(
      v_sale_id,
      p_method,
      v_net,
      p_amount_received,
      p_transaction_reference,
      p_provider,
      v_label,
      'delivery-' || p_order_id::text
    );
  END IF;

  -- 3) Coût de la course : dépense « Transport » datée du jour de la vente.
  v_expense_id := v_delivery.delivery_fee_expense_id;

  IF v_expense_id IS NOT NULL THEN
    -- Livraison finalisée avant 20261029120000 : dépense déjà créée, on la redate.
    UPDATE public.expenses
    SET expense_date = CURRENT_DATE,
        updated_by = v_actor
    WHERE id = v_expense_id;
  ELSIF v_fee > 0 THEN
    INSERT INTO public.expenses (
      organization_id, establishment_id, category, area, label, amount,
      expense_date, reference, note, created_by, updated_by
    )
    VALUES (
      v_delivery.organization_id, v_delivery.establishment_id,
      'TRANSPORT'::public.expense_category, 'CAISSE'::public.expense_area,
      'Frais de livraison ' || v_reference, v_fee,
      CURRENT_DATE, v_reference,
      'Frais de course retenus par le livreur, enregistrés à l''encaissement.',
      COALESCE(v_delivery.courier_id, v_actor), v_actor
    )
    RETURNING id INTO v_expense_id;
  END IF;

  UPDATE public.delivery_orders
  SET cashed_at = now(),
      cashed_by = v_actor,
      sale_order_id = v_sale_id,
      delivery_fee_expense_id = v_expense_id
  WHERE id = p_order_id;

  RETURN v_payment || jsonb_build_object(
    'sale_order_id', v_sale_id,
    'sale_order_number', v_sale_number
  );
END;
$$;
