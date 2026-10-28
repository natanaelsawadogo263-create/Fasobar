-- Frais de livraison retenus par le livreur.
--
-- Le client paie le prix de vente au livreur ; le livreur garde le coût de la
-- course et remet le reste à la caisse. À l'encaissement :
--   * la vente garde son total (chiffre d'affaires juste) ;
--   * le paiement est découpé : « Frais livreur » (mode OTHER, hors tiroir)
--     + ce que la caisse reçoit (espèces…) ;
--   * le fond de caisse attendu ne compte que les espèces réellement remises ;
--   * la dépense « Transport » créée à la fin de la course reste la seule trace
--     du coût (pas de double déduction).
-- Prérequis : 20261027120000_delivery_sale_units.sql et
--             20261028130000_delivery_fee_expense.sql.

-- ---------------------------------------------------------------------------
-- complete_delivery_order_with_fee — frais plafonnés au montant de la commande
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

  SELECT * INTO v_order
  FROM public.delivery_orders
  WHERE id = p_order_id;

  IF FOUND AND p_delivery_fee > v_order.total_amount THEN
    RAISE EXCEPTION 'Les frais de livraison ne peuvent pas dépasser le montant de la commande.';
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

-- ---------------------------------------------------------------------------
-- cash_delivery_order — la caisse n'encaisse que total − frais livreur
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
  v_payment jsonb;
  v_fee integer;
  v_net integer;
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

  v_label := 'Livraison L-' || lpad(v_delivery.order_number::text, 4, '0');
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
  --    compte pas dans les espèces attendues. La dépense « Transport » existe déjà.
  IF v_fee > 0 THEN
    v_payment := public.record_order_payment(
      v_sale_id,
      'OTHER'::public.payment_method,
      v_fee,
      NULL,
      'L-' || lpad(v_delivery.order_number::text, 4, '0'),
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

  UPDATE public.delivery_orders
  SET cashed_at = now(),
      cashed_by = v_actor,
      sale_order_id = v_sale_id
  WHERE id = p_order_id;

  RETURN v_payment || jsonb_build_object(
    'sale_order_id', v_sale_id,
    'sale_order_number', v_sale_number
  );
END;
$$;
