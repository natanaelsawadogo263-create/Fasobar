-- FasoBar: allow BAR / KITCHEN managers to read suppliers (admin still creates them)

DROP POLICY IF EXISTS suppliers_select_manage ON public.suppliers;

CREATE POLICY suppliers_select_authorized
  ON public.suppliers
  FOR SELECT
  TO authenticated
  USING (
    public.user_can_manage_products((SELECT auth.uid()), establishment_id)
    OR public.user_can_manage_stock(
      (SELECT auth.uid()),
      establishment_id,
      'BAR'::public.department_code
    )
    OR public.user_can_manage_stock(
      (SELECT auth.uid()),
      establishment_id,
      'KITCHEN'::public.department_code
    )
  );

-- Insert / update remain restricted to product managers via
-- user_can_manage_stock(uid, establishment_id) without department
-- (admin / owner / manager only).
