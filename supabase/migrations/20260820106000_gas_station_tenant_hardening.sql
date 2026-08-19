-- FasoBar: durcissement multi-tenant station + perf index clôtures

CREATE INDEX IF NOT EXISTS pump_sessions_closed_pump_closed_at_idx
  ON public.pump_sessions (establishment_id, fuel_pump_id, closed_at DESC)
  WHERE status = 'CLOSED';

-- Seul le pompiste ayant ouvert (ou admin org) peut modifier une session
DROP POLICY IF EXISTS pump_sessions_update ON public.pump_sessions;

CREATE POLICY pump_sessions_update ON public.pump_sessions
  FOR UPDATE TO authenticated
  USING (
    public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id)
    AND (
      opened_by = (SELECT auth.uid())
      OR public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
    )
  )
  WITH CHECK (
    public.user_belongs_to_establishment((SELECT auth.uid()), establishment_id)
    AND (
      opened_by = (SELECT auth.uid())
      OR public.user_is_organization_owner_or_admin((SELECT auth.uid()), organization_id)
    )
  );
