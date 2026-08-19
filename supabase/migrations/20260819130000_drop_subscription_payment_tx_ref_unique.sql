-- La preuve d’abonnement n’a pas de n° Orange Money unique :
-- le client envoie souvent le joker "PREUVE", ou le n° de dépôt FasoBar.
-- Un index UNIQUE global bloquait donc la 2e approbation.
-- L’idempotence reste assurée par platform_subscription_payments_request_key
-- (un paiement par demande).

DROP INDEX IF EXISTS public.platform_subscription_payments_tx_ref_key;

CREATE INDEX IF NOT EXISTS platform_subscription_payments_tx_ref_idx
  ON public.platform_subscription_payments (transaction_reference)
  WHERE transaction_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.platform_subscription_payments_uniquify_tx_ref()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_ref text;
BEGIN
  v_ref := NULLIF(btrim(COALESCE(NEW.transaction_reference, '')), '');

  IF v_ref IS NULL OR v_ref ~* '^(PREUVE|N/?A|NA|-)$' THEN
    NEW.transaction_reference :=
      'PREUVE-' || NEW.subscription_request_id::text;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.platform_subscription_payments AS p
    WHERE p.transaction_reference = v_ref
      AND p.id IS DISTINCT FROM NEW.id
  ) THEN
    NEW.transaction_reference :=
      v_ref || '-' || NEW.subscription_request_id::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS platform_subscription_payments_uniquify_tx_ref
  ON public.platform_subscription_payments;

CREATE TRIGGER platform_subscription_payments_uniquify_tx_ref
  BEFORE INSERT OR UPDATE OF transaction_reference
  ON public.platform_subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.platform_subscription_payments_uniquify_tx_ref();
