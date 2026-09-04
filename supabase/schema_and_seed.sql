-- Cafe Builders Admin catalog schema and seed data
-- PostgreSQL / Supabase compatible. Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.categories (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('BEVERAGE', 'FOOD')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.customization_groups (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  selection_mode VARCHAR(50) NOT NULL CHECK (selection_mode IN ('SINGLE', 'MULTIPLE')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.customization_options (
  id VARCHAR(255) PRIMARY KEY,
  group_id VARCHAR(255) NOT NULL REFERENCES public.customization_groups(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price_modifier NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.ingredients (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Backward-compatible upgrades for databases created by the older Cafe schema.
-- CREATE TABLE IF NOT EXISTS does not change an existing table's columns.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

UPDATE public.categories
SET type = CASE
  WHEN LOWER(name) LIKE '%pastry%'
    OR LOWER(name) LIKE '%bakery%'
    OR LOWER(name) LIKE '%brunch%'
    OR LOWER(name) LIKE '%food%'
  THEN 'FOOD'
  ELSE 'BEVERAGE'
END
WHERE type IS NULL;

UPDATE public.categories
SET slug = LOWER(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

ALTER TABLE public.categories
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN type SET DEFAULT 'BEVERAGE',
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN sort_order SET DEFAULT 0,
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'categories_type_check'
      AND conrelid = 'public.categories'::regclass
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_type_check CHECK (type IN ('BEVERAGE', 'FOOD'));
  END IF;
END $$;

INSERT INTO public.categories (id, name, slug, type, sort_order, is_active)
VALUES
  ('cat_espresso_classics', 'Espresso Classics', 'espresso-classics', 'BEVERAGE', 1, true),
  ('cat_iced_coffee', 'Iced Coffee', 'iced-coffee', 'BEVERAGE', 2, true),
  ('cat_pastries_bakery', 'Pastries & Bakery', 'pastries-bakery', 'FOOD', 3, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customization_groups (id, name, selection_mode, is_required, sort_order)
VALUES
  ('group_ice_level', 'Ice Level', 'SINGLE', true, 1),
  ('group_sugar_level', 'Sugar Level', 'SINGLE', true, 2),
  ('group_milk_choices', 'Milk Choices', 'SINGLE', false, 3),
  ('group_add_ons', 'Add-ons', 'MULTIPLE', false, 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customization_options (id, group_id, name, price_modifier, is_available, sort_order)
VALUES
  ('option_ice_less', 'group_ice_level', 'Less Ice', 0.00, true, 1),
  ('option_ice_regular', 'group_ice_level', 'Regular Ice', 0.00, true, 2),
  ('option_ice_extra', 'group_ice_level', 'Extra Ice', 0.00, true, 3),
  ('option_sugar_less', 'group_sugar_level', 'Less Sweet', 0.00, true, 1),
  ('option_sugar_regular', 'group_sugar_level', 'Regular Sweet', 0.00, true, 2),
  ('option_sugar_more', 'group_sugar_level', 'More Sweet', 0.00, true, 3),
  ('option_milk_whole', 'group_milk_choices', 'Whole Milk', 0.00, true, 1),
  ('option_milk_oat', 'group_milk_choices', 'Oat Milk', 25.00, true, 2),
  ('option_addon_extra_shot', 'group_add_ons', 'Extra Shot', 30.00, true, 1),
  ('option_addon_coffee_jelly', 'group_add_ons', 'Coffee Jelly', 25.00, true, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ingredients (id, name, is_available)
VALUES
  ('ingredient_espresso_beans', 'Espresso Beans', true),
  ('ingredient_oat_milk', 'Oat Milk', true),
  ('ingredient_whole_milk', 'Whole Milk', true),
  ('ingredient_vanilla_syrup', 'Vanilla Syrup', true)
ON CONFLICT (id) DO NOTHING;
