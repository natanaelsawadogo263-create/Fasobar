-- FasoBar: notifications push (Web Push) — Super Admin, Admin, Responsable Bar.
-- Appliquer manuellement. Ne pas modifier les migrations antérieures.

-- ---------------------------------------------------------------------------
-- Abonnements push (un par appareil/navigateur)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_not_blank CHECK (btrim(endpoint) <> '')
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions FORCE ROW LEVEL SECURITY;

-- Écriture normale via le serveur (service role, après vérification de la
-- session côté Server Action) — ces policies couvrent un accès direct
-- éventuel depuis le client (ex. suppression d'un abonnement) sans jamais
-- laisser un utilisateur voir/modifier l'abonnement d'un autre.
DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.push_subscriptions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO authenticated;

-- ---------------------------------------------------------------------------
-- admin_notifications : suivi de l'envoi push (dédoublonnage entre deux
-- passages du job de dispatch)
-- ---------------------------------------------------------------------------

ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS pushed_at timestamptz;

-- Ne pas pousser tout l'historique existant au premier passage du job après
-- déploiement : seules les notifications créées après cette migration
-- doivent être considérées comme "à envoyer".
UPDATE public.admin_notifications
  SET pushed_at = created_at
  WHERE pushed_at IS NULL;

CREATE INDEX IF NOT EXISTS admin_notifications_unpushed_idx
  ON public.admin_notifications (created_at)
  WHERE pushed_at IS NULL;

-- Responsable Bar : accès en lecture aux notifications de son établissement,
-- limité aux événements qui le concernent (ouverture/fermeture de session
-- bar). Réutilise le même contrôle de rôle que la gestion de session bar
-- (public.user_is_bar_session_operator, définie dans 20260806120000).
DROP POLICY IF EXISTS admin_notifications_select_bar_manager ON public.admin_notifications;
CREATE POLICY admin_notifications_select_bar_manager
  ON public.admin_notifications
  FOR SELECT
  TO authenticated
  USING (
    kind IN (
      'BAR_SESSION_OPEN'::public.admin_notification_kind,
      'BAR_SESSION_CLOSE'::public.admin_notification_kind
    )
    AND public.user_is_bar_session_operator(auth.uid(), establishment_id)
  );

-- La RPC de "tout marquer lu" n'autorisait que owner/admin — l'étendre au
-- Responsable Bar (elle est SECURITY DEFINER : marquer un id qu'il ne peut
-- pas SELECT ne fuite aucune donnée, juste une ligne (notification_id,
-- user_id) dans admin_notification_reads).
CREATE OR REPLACE FUNCTION public.mark_admin_notifications_read(
  p_establishment_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT e.organization_id INTO v_org_id
  FROM public.establishments e
  WHERE e.id = p_establishment_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Établissement introuvable';
  END IF;

  IF NOT public.user_belongs_to_establishment(v_user_id, p_establishment_id)
     OR NOT (
       public.user_is_organization_owner_or_admin(v_user_id, v_org_id)
       OR public.user_is_bar_session_operator(v_user_id, p_establishment_id)
     ) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;

  INSERT INTO public.admin_notification_reads (notification_id, user_id)
  SELECT n.id, v_user_id
  FROM public.admin_notifications n
  WHERE n.establishment_id = p_establishment_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.admin_notification_reads r
      WHERE r.notification_id = n.id
        AND r.user_id = v_user_id
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_admin_notifications_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_admin_notifications_read(uuid) TO authenticated;

-- Utilisée uniquement par le job de dispatch (service role) : renvoie les
-- utilisateurs autorisés à voir une notification donnée pour un
-- établissement, en reproduisant exactement les deux policies SELECT sur
-- admin_notifications (admin_notifications_select_admin +
-- admin_notifications_select_bar_manager) — le service role contourne la
-- RLS, donc ce filtrage doit être refait explicitement ici.
CREATE OR REPLACE FUNCTION public.push_recipients_for_admin_notification(
  p_establishment_id uuid,
  p_kind public.admin_notification_kind
)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH candidates AS (
    SELECT em.user_id
    FROM public.establishment_memberships em
    WHERE em.establishment_id = p_establishment_id
      AND em.status = 'ACTIVE'::public.entity_status
    UNION
    SELECT om.user_id
    FROM public.organization_memberships om
    INNER JOIN public.establishments e ON e.organization_id = om.organization_id
    WHERE e.id = p_establishment_id
      AND om.status = 'ACTIVE'::public.entity_status
  )
  SELECT DISTINCT c.user_id
  FROM candidates c
  CROSS JOIN public.establishments e
  WHERE e.id = p_establishment_id
    AND public.user_belongs_to_establishment(c.user_id, p_establishment_id)
    AND (
      public.user_is_organization_owner_or_admin(c.user_id, e.organization_id)
      OR (
        p_kind IN (
          'BAR_SESSION_OPEN'::public.admin_notification_kind,
          'BAR_SESSION_CLOSE'::public.admin_notification_kind
        )
        AND public.user_is_bar_session_operator(c.user_id, p_establishment_id)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.push_recipients_for_admin_notification(
  uuid, public.admin_notification_kind
) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Échéances Super Admin : calculées à la volée (pas de table de faits), donc
-- on garde juste la trace de ce qui a déjà été poussé pour ne pas répéter.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_expiry_alert_pushes (
  alert_id text PRIMARY KEY,
  pushed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_expiry_alert_pushes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_expiry_alert_pushes FORCE ROW LEVEL SECURITY;

-- Aucune policy : seul le service role (job de dispatch, qui contourne la
-- RLS) touche cette table.
REVOKE ALL ON TABLE public.platform_expiry_alert_pushes FROM anon, authenticated;

-- Même précaution anti-avalanche que ci-dessus : les échéances déjà dans la
-- fenêtre d'alerte au moment de la migration sont marquées "déjà poussées"
-- pour ne pas toutes notifier d'un coup au premier passage du job. Les
-- essais/abonnements pas encore dans la fenêtre ne sont pas concernés — ils
-- seront poussés normalement quand ils y entreront.
INSERT INTO public.platform_expiry_alert_pushes (alert_id)
SELECT 'trial:' || t.id
FROM public.organization_trials t
WHERE t.status = 'ACTIVE'
  AND t.ends_at >= now()
  AND t.ends_at <= now() + (
    COALESCE(
      (SELECT warning_days_before_expiry FROM public.platform_settings LIMIT 1),
      7
    ) || ' days'
  )::interval
ON CONFLICT DO NOTHING;

INSERT INTO public.platform_expiry_alert_pushes (alert_id)
SELECT 'sub:' || s.id
FROM public.organization_subscriptions s
WHERE s.status = 'ACTIVE'
  AND s.is_current = true
  AND s.ends_at >= now()
  AND s.ends_at <= now() + (
    COALESCE(
      (SELECT warning_days_before_expiry FROM public.platform_settings LIMIT 1),
      7
    ) || ' days'
  )::interval
ON CONFLICT DO NOTHING;
