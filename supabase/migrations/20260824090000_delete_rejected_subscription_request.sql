-- Permet à un Super Admin de supprimer définitivement une demande d'abonnement
-- REFUSÉE (paiement rejeté). Restreint volontairement aux demandes REJECTED :
-- une demande encore ouverte (en attente de paiement, preuve envoyée, en
-- examen…) ou déjà APPROVED ne doit jamais pouvoir être supprimée par ce
-- chemin — seule reject_subscription_payment() peut faire transiter une
-- demande vers REJECTED, et cancel_organization_subscription() gère les
-- résiliations d'abonnements déjà actifs (table distincte).

CREATE OR REPLACE FUNCTION public.delete_subscription_request(
  p_request_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_req public.subscription_requests%ROWTYPE;
BEGIN
  IF NOT public.is_active_platform_admin() THEN
    RAISE EXCEPTION 'Réservé aux Super Admins.';
  END IF;

  SELECT * INTO v_req
  FROM public.subscription_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable.';
  END IF;

  IF v_req.status <> 'REJECTED'::public.subscription_request_status THEN
    RAISE EXCEPTION
      'Seule une demande refusée peut être supprimée (statut actuel : %).',
      v_req.status;
  END IF;

  DELETE FROM public.subscription_requests WHERE id = p_request_id;

  PERFORM public.write_platform_audit_log(
    'delete_subscription_request',
    v_req.organization_id,
    'subscription_requests',
    p_request_id,
    jsonb_build_object(
      'reference_code', v_req.reference_code,
      'rejection_reason', v_req.rejection_reason
    )
  );
END;
$$;

COMMENT ON FUNCTION public.delete_subscription_request(uuid) IS
  'Supprime définitivement une demande d''abonnement REFUSÉE (Super Admin uniquement).';

REVOKE ALL ON FUNCTION public.delete_subscription_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_subscription_request(uuid) TO authenticated;
