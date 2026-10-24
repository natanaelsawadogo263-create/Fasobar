-- FasoBar E-commerce : rôle Livreur.
-- Fichier séparé : une valeur d'enum ajoutée ne peut pas être utilisée dans la
-- même transaction (la migration suivante s'en sert dans les fonctions/politiques).

ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'DELIVERY_AGENT';
