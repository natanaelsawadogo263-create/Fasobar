-- FasoBar e-commerce : encaissement des livraisons par la caisse.
--
-- Circuit : En attente → En cours (livreur) → Livrée, à encaisser (livreur)
--           → Encaissée (caisse, bouton « Encaisser »).
--
-- À l'encaissement, la livraison devient une vente normale (orders + paiement
-- + reçu) via public.record_order_payment : elle apparaît dans Ventes, Tableau
-- de bord, Rapports et le fond de caisse de la session ouverte.
-- Le stock principal n'est PAS débité une seconde fois (déjà sorti vers le
-- livreur à la remise) : la vente est créée avec stock_posted_at renseigné.
-- Les statuts bar/cuisine restent NULL : rien n'apparaît sur ces écrans.

-- ---------------------------------------------------------------------------
-- delivery_orders : traçabilité de l'encaissement
-- ---------------------------------------------------------------------------

ALTER TABLE public.delivery_orders
  ADD COLUMN IF NOT EXISTS cashed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cashed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS sale_order_id uuid REFERENCES public.orders (id) ON DELETE RESTRICT;

ALTER TABLE public.delivery_orders
  DROP CONSTRAINT IF EXISTS delivery_orders_cashed_only_when_delivered;
ALTER TABLE public.delivery_orders
  ADD CONSTRAINT delivery_orders_cashed_only_when_delivered CHECK (
    cashed_at IS NULL OR status = 'DELIVERED'::public.delivery_order_status
  );

CREATE UNIQUE INDEX IF NOT EXISTS delivery_orders_sale_order_id_key
  ON public.delivery_orders (sale_order_id)
  WHERE sale_order_id IS NOT NULL;

-- Livraisons livrées en attente d'encaissement (vue caisse).
CREATE INDEX IF NOT EXISTS delivery_orders_to_cash_idx
  ON public.delivery_orders (establishment_id, delivered_at)
  WHERE status = 'DELIVERED'::public.delivery_order_status AND cashed_at IS NULL;

-- ---------------------------------------------------------------------------
-- cash_delivery_order — la caisse encaisse une livraison livrée
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
    SELECT i.product_id, i.product_name, i.unit_price, i.quantity, i.line_total
    FROM public.delivery_order_items i
    WHERE i.delivery_order_id = p_order_id
    ORDER BY i.product_id
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
      1,
      v_line.quantity
    );
  END LOOP;

  -- Chemin officiel : paiement, statut PAID, reçu, fond de caisse, journal.
  v_payment := public.record_order_payment(
    v_sale_id,
    p_method,
    v_delivery.total_amount,
    p_amount_received,
    p_transaction_reference,
    p_provider,
    v_label,
    'delivery-' || p_order_id::text
  );

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

REVOKE ALL ON FUNCTION public.cash_delivery_order(uuid, public.payment_method, integer, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_delivery_order(uuid, public.payment_method, integer, text, text)
  TO authenticated;
