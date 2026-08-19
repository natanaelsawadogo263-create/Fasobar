-- Preuves sans n° Orange Money : le client envoie le joker "PREUVE".
-- L'index unique platform_subscription_payments_tx_ref_key bloquait alors
-- toute 2e approbation. On suffixe les jokers par l'id de la demande.

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

  IF v_ref ~* '^PREUVE'
     AND EXISTS (
       SELECT 1
       FROM public.platform_subscription_payments AS p
       WHERE p.transaction_reference = v_ref
         AND p.id IS DISTINCT FROM NEW.id
     )
  THEN
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
