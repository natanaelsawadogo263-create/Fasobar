-- Limitation anti-brute-force (connexion, inscription, récupération).
--
-- La connexion passe par une Server Action : Supabase Auth voit l'IP du
-- serveur (Vercel), pas celle de l'attaquant, donc sa propre limitation par IP
-- ne protège pas les comptes. Cette table compte les tentatives par « bucket »
-- (ex. `login:id:<identifiant>`, `login:ip:<ip>`) sur une fenêtre glissante.
--
-- Accès réservé au service role : aucune policy, RPC non exposée aux rôles
-- anon / authenticated.

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket text NOT NULL CHECK (char_length(bucket) <= 300),
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_bucket_attempted_at_idx
  ON public.auth_rate_limits (bucket, attempted_at DESC);

CREATE INDEX IF NOT EXISTS auth_rate_limits_attempted_at_idx
  ON public.auth_rate_limits (attempted_at);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_rate_limits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_rate_limits FROM PUBLIC, anon, authenticated;

-- Renvoie true si le bucket a déjà atteint p_max tentatives dans la fenêtre.
-- Si p_record = true, enregistre une tentative supplémentaire.
CREATE OR REPLACE FUNCTION public.auth_rate_limit_check(
  p_bucket text,
  p_max integer,
  p_window_seconds integer,
  p_record boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_bucket IS NULL OR char_length(p_bucket) = 0 OR char_length(p_bucket) > 300 THEN
    RETURN false;
  END IF;

  -- Purge opportuniste des tentatives expirées (borne la taille de la table).
  DELETE FROM public.auth_rate_limits
  WHERE attempted_at < now() - interval '1 day';

  SELECT count(*)
  INTO v_count
  FROM public.auth_rate_limits
  WHERE bucket = p_bucket
    AND attempted_at > now() - make_interval(secs => p_window_seconds);

  IF p_record THEN
    INSERT INTO public.auth_rate_limits (bucket) VALUES (p_bucket);
  END IF;

  RETURN v_count >= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_rate_limit_check(text, integer, integer, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_rate_limit_check(text, integer, integer, boolean)
  TO service_role;
