-- FasoBar: colonnes fiche journalière sur pump_sessions (espace pompiste)

ALTER TABLE public.pump_sessions
  ADD COLUMN IF NOT EXISTS is_initial_session boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS active_fuel_line_id text,
  ADD COLUMN IF NOT EXISTS sheet_manual jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sheet_carry_forward jsonb,
  ADD COLUMN IF NOT EXISTS sheet_closed_snapshot jsonb;

COMMENT ON COLUMN public.pump_sessions.is_initial_session IS
  'Première session de l''établissement — stocks CF éditables';
COMMENT ON COLUMN public.pump_sessions.active_fuel_line_id IS
  'Ligne carburant active (SUPER_1, GAZOIL_1, etc.) pour la fiche';
COMMENT ON COLUMN public.pump_sessions.sheet_manual IS
  'Saisies manuelles pompiste (autosave)';
COMMENT ON COLUMN public.pump_sessions.sheet_carry_forward IS
  'Reprise stocks / report veille depuis la session précédente';
COMMENT ON COLUMN public.pump_sessions.sheet_closed_snapshot IS
  'Snapshot calculé à la clôture pour la session suivante';
