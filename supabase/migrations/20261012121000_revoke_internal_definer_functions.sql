-- Durcissement : fonctions SECURITY DEFINER internes exposées à tous.
--
-- Ces fonctions contournent la RLS et prennent un établissement / une commande
-- en paramètre sans vérifier l'appelant. Sans REVOKE explicite, PostgreSQL
-- (et les privilèges par défaut de Supabase) les rendent exécutables via
-- l'API par `anon` et `authenticated` — ex. créer une pompe dans
-- l'établissement d'un autre client avec la seule clé publique.
--
-- Elles ne sont appelées que par d'autres fonctions SECURITY DEFINER
-- (save_order_items, apply_desktop_outbox_event, open_pump_session_by_fuel_line,
-- trigger trg_orders_apply_sale_stock…), qui s'exécutent avec les droits du
-- propriétaire : le REVOKE ne change rien à leur fonctionnement.
-- Aucun appel direct depuis l'application (vérifié dans src/).

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'apply_order_prep_statuses_from_items',
        'apply_paid_order_stock',
        'desktop_replace_order_items_and_prep',
        'gas_station_ensure_fuel_pump_for_line',
        'gas_station_ensure_sheet_pump',
        'order_department_item_signature',
        -- Exposées à `authenticated` (donc à toute personne qui s'inscrit) :
        -- notifications / journaux d'audit forgés chez un autre client,
        -- totaux ou numéros de commande d'un autre établissement modifiés.
        'insert_admin_notification',
        'mark_order_department_items_prepared',
        'next_order_number',
        'next_payment_number',
        'next_receipt_number',
        'next_subscription_reference',
        'recalculate_order_totals',
        'seed_establishment_departments',
        'write_admin_audit_log',
        'write_bar_session_audit_log',
        'write_order_audit_log',
        'write_payment_audit_log',
        'write_product_audit_log',
        'write_stock_audit_log'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;
