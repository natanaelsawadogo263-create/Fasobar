-- FasoBar: valeur d’enum ORDER (fichier séparé — ne pas utiliser la valeur ici).
-- Appliquer manuellement. Ne pas modifier les migrations antérieures.

ALTER TYPE public.admin_notification_kind ADD VALUE IF NOT EXISTS 'ORDER';
