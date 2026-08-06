-- FasoBar: lecture stock_items pour managers + dédoublonnage articles produit
-- Ne pas exécuter automatiquement.

-- 1) Nettoie les doublons (garde le plus récent / plus rempli par product_id)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY establishment_id, product_id
      ORDER BY current_quantity DESC, updated_at DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM public.stock_items
  WHERE product_id IS NOT NULL
)
DELETE FROM public.stock_items si
USING ranked r
WHERE si.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS stock_items_establishment_product_unique
  ON public.stock_items (establishment_id, product_id)
  WHERE product_id IS NOT NULL;

-- 2) Remplace la policy SELECT recursive
DROP POLICY IF EXISTS stock_items_select_authorized ON public.stock_items;

CREATE POLICY stock_items_select_authorized
  ON public.stock_items
  FOR SELECT
  TO authenticated
  USING (
    public.user_can_manage_products((SELECT auth.uid()), establishment_id)
    OR public.user_can_manage_stock((SELECT auth.uid()), establishment_id)
    OR EXISTS (
      SELECT 1
      FROM public.departments d
      WHERE d.id = stock_items.department_id
        AND public.user_can_manage_stock(
          (SELECT auth.uid()),
          stock_items.establishment_id,
          d.code
        )
    )
    OR (
      stock_items.active = true
      AND public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id)
      AND (
        public.user_has_establishment_role(
          (SELECT auth.uid()),
          establishment_id,
          'CASHIER'::public.membership_role
        )
        OR public.user_has_organization_role(
          (SELECT auth.uid()),
          public.establishment_organization_id(establishment_id),
          'CASHIER'::public.membership_role
        )
      )
    )
  );
