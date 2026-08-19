-- Sac (riz 25/50 kg, farine, sucre) distinct du sachet.

ALTER TYPE public.product_unit ADD VALUE IF NOT EXISTS 'SAC';
