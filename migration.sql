-- ============================================================
-- Migration: catalog_normalization
-- Purpose:   Move in-memory Maps -> PostgreSQL as single source
--            of truth. No existing data dropped.
-- Safe to apply on a database that:
--   - Has categories, products, orders, order_items tables
--   - May have existing rows in all four tables
--   - Does NOT have the new tables yet
-- ============================================================

-- ============================================================
-- 1. NEW ENUM: SelectionMode
-- ============================================================
CREATE TYPE "SelectionMode" AS ENUM ('SINGLE', 'MULTIPLE');

-- ============================================================
-- 2. NEW TABLE: ingredients
-- Stable string IDs (slugs) used as PK, e.g. "ingredient_matcha"
-- ============================================================
CREATE TABLE "ingredients" (
    "id"          TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "isAvailable" BOOLEAN      NOT NULL DEFAULT true,
    "isArchived"  BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 3. NEW TABLE: customization_groups
-- Stable string IDs, e.g. "group_ice"
-- ============================================================
CREATE TABLE "customization_groups" (
    "id"            TEXT           NOT NULL,
    "name"          TEXT           NOT NULL,
    "selectionMode" "SelectionMode" NOT NULL DEFAULT 'SINGLE',
    "isRequired"    BOOLEAN        NOT NULL DEFAULT false,
    "sortOrder"     INTEGER        NOT NULL DEFAULT 0,
    "isActive"      BOOLEAN        NOT NULL DEFAULT true,
    "isArchived"    BOOLEAN        NOT NULL DEFAULT false,
    "createdAt"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "customization_groups_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 4. NEW TABLE: customization_options
-- Stable string IDs, e.g. "option_ice_less"
-- ============================================================
CREATE TABLE "customization_options" (
    "id"            TEXT         NOT NULL,
    "groupId"       TEXT         NOT NULL,
    "name"          TEXT         NOT NULL,
    "priceModifier" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive"      BOOLEAN      NOT NULL DEFAULT true,
    "isArchived"    BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customization_options_pkey" PRIMARY KEY ("id")
);

-- FK: customization_options.groupId -> customization_groups.id
ALTER TABLE "customization_options"
    ADD CONSTRAINT "customization_options_groupId_fkey"
    FOREIGN KEY ("groupId")
    REFERENCES "customization_groups"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 5. ALTER TABLE: products
--    a) Float -> DECIMAL(10,2) for price
--    b) Add manualAvailability (admin-controlled toggle)
--    c) Add isArchived
-- ============================================================

-- 5a. Cast price from float8 to DECIMAL(10,2)
--     USING clause ensures safe conversion of existing rows
ALTER TABLE "products"
    ALTER COLUMN "price" TYPE DECIMAL(10,2)
    USING "price"::DECIMAL(10,2);

-- 5b. Add manualAvailability column (default true = all existing products stay available)
ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "manualAvailability" BOOLEAN NOT NULL DEFAULT true;

-- Back-fill: set manualAvailability = isAvailable for all existing products
--            so their current admin intent is preserved
UPDATE "products" SET "manualAvailability" = "isAvailable";

-- 5c. Add isArchived column
ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 6. NEW TABLE: product_ingredients  (Product <-> Ingredient)
-- Composite PK. onDelete Cascade for product, Restrict for ingredient.
-- ============================================================
CREATE TABLE "product_ingredients" (
    "productId"    TEXT    NOT NULL,
    "ingredientId" TEXT    NOT NULL,
    "isRequired"   BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_ingredients_pkey" PRIMARY KEY ("productId", "ingredientId")
);

ALTER TABLE "product_ingredients"
    ADD CONSTRAINT "product_ingredients_productId_fkey"
    FOREIGN KEY ("productId")
    REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_ingredients"
    ADD CONSTRAINT "product_ingredients_ingredientId_fkey"
    FOREIGN KEY ("ingredientId")
    REFERENCES "ingredients"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 7. NEW TABLE: product_customization_groups  (Product <-> Group)
-- ============================================================
CREATE TABLE "product_customization_groups" (
    "productId" TEXT    NOT NULL,
    "groupId"   TEXT    NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_customization_groups_pkey" PRIMARY KEY ("productId", "groupId")
);

ALTER TABLE "product_customization_groups"
    ADD CONSTRAINT "product_customization_groups_productId_fkey"
    FOREIGN KEY ("productId")
    REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_customization_groups"
    ADD CONSTRAINT "product_customization_groups_groupId_fkey"
    FOREIGN KEY ("groupId")
    REFERENCES "customization_groups"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 8. NEW TABLE: product_customization_options  (Product <-> Option allowlist)
-- ============================================================
CREATE TABLE "product_customization_options" (
    "productId" TEXT NOT NULL,
    "optionId"  TEXT NOT NULL,

    CONSTRAINT "product_customization_options_pkey" PRIMARY KEY ("productId", "optionId")
);

ALTER TABLE "product_customization_options"
    ADD CONSTRAINT "product_customization_options_productId_fkey"
    FOREIGN KEY ("productId")
    REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_customization_options"
    ADD CONSTRAINT "product_customization_options_optionId_fkey"
    FOREIGN KEY ("optionId")
    REFERENCES "customization_options"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 9. ALTER TABLE: orders
--    Float -> DECIMAL(10,2) for monetary columns
-- ============================================================
ALTER TABLE "orders"
    ALTER COLUMN "subtotal"    TYPE DECIMAL(10,2) USING "subtotal"::DECIMAL(10,2),
    ALTER COLUMN "serviceFee"  TYPE DECIMAL(10,2) USING "serviceFee"::DECIMAL(10,2),
    ALTER COLUMN "totalAmount" TYPE DECIMAL(10,2) USING "totalAmount"::DECIMAL(10,2);

-- ============================================================
-- 10. ALTER TABLE: order_items
--     Float -> DECIMAL(10,2) for monetary columns
-- ============================================================
ALTER TABLE "order_items"
    ALTER COLUMN "unitPrice" TYPE DECIMAL(10,2) USING "unitPrice"::DECIMAL(10,2),
    ALTER COLUMN "subtotal"  TYPE DECIMAL(10,2) USING "subtotal"::DECIMAL(10,2);

-- ============================================================
-- 11. NEW TABLE: order_item_modifiers
--     Structured snapshot of selected options per order item.
--     optionId is nullable: option may be deleted/archived after order.
-- ============================================================
CREATE TABLE "order_item_modifiers" (
    "id"              TEXT         NOT NULL,
    "orderItemId"     TEXT         NOT NULL,
    "optionId"        TEXT,
    "groupName"       TEXT         NOT NULL,
    "optionName"      TEXT         NOT NULL,
    "priceAdjustment" DECIMAL(10,2) NOT NULL,
    "quantity"        INTEGER      NOT NULL DEFAULT 1,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_modifiers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "order_item_modifiers"
    ADD CONSTRAINT "order_item_modifiers_orderItemId_fkey"
    FOREIGN KEY ("orderItemId")
    REFERENCES "order_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_item_modifiers"
    ADD CONSTRAINT "order_item_modifiers_optionId_fkey"
    FOREIGN KEY ("optionId")
    REFERENCES "customization_options"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
