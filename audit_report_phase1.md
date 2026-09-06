# Phase 1: Catalog DB Migration — Audit Report

## Date: 2026-09-06

---

## 1. Executive Summary

The catalog normalization migration (in-memory Maps → PostgreSQL as single source of truth) is **partially complete**. The Prisma schema, database migration, and service layer are fully implemented. However, the seed data from `menuData.ts` has never been loaded into the database, and the server still depends on `menuData.ts` as fallback data. The frontend continues to import static product data directly.

**PHASE 1 BUILD READY: NO**

---

## 2. Current State Inventory

### 2.1 Database Schema (COMPLETE ✅)

`prisma/schema.prisma` already contains the full normalized catalog model with 11 models and 4 enums:

| Model | Purpose | Status |
|-------|---------|--------|
| `Category` | Product categories (Matcha, Coffee, Pastries, Pasta & Brunch) | Schema exists |
| `Ingredient` | Ingredient inventory | Schema exists |
| `CustomizationGroup` | Group configs (ice, sugar, milk, addons) | Schema exists |
| `CustomizationOption` | Individual options within groups | Schema exists |
| `Product` | Core product with `manualAvailability`, `isArchived`, join relations | Schema exists |
| `ProductIngredient` | Product ↔ Ingredient join table | Schema exists |
| `ProductCustomizationGroup` | Product ↔ CustomizationGroup join table | Schema exists |
| `ProductCustomizationOption` | Product ↔ CustomizationOption allowlist join table | Schema exists |
| `Order` | Order with Decimal pricing | Schema exists |
| `OrderItem` | Order line items with Decimal pricing | Schema exists |
| `OrderItemModifier` | Structured customization snapshots per order item | Schema exists |

Enums: `OrderStatus`, `PaymentMethod`, `OrderType`, `SelectionMode`

### 2.2 Database Migration (COMPLETE ✅)

`prisma/migrations/20260904000000_init_clean_catalog/migration.sql` has already been applied:
- Creates all tables, enums, indexes, and foreign key constraints
- Includes `order_item_modifiers` table (new for structured customization snapshots)
- Creates `orders_paymentIntentId_key` unique index (F11-A2)
- All foreign key constraints are properly defined (CASCADE, RESTRICT, SET NULL)

### 2.3 Service Layer (COMPLETE ✅)

All services already use Prisma and query the database:

| Service | File | Status |
|---------|------|--------|
| `catalogService.ts` | `src/services/catalogService.ts` | Full CRUD for products, categories |
| `inventoryService.ts` | `src/services/inventoryService.ts` | Full CRUD for ingredients, availability engine |
| `adminService.ts` | `src/services/adminService.ts` | Full CRUD for categories, customization groups/options |
| `orderService.ts` | `src/services/orderService.ts` | Full CRUD for orders with advisory lock |

Key features already implemented:
- **Availability engine**: `recalculateProductAvailability()` computes `isAvailable = manualAvailability && !isArchived && allRequiredIngredientsAvailable`
- **Customization authorization**: Two-level (group membership + explicit allowlist) in `calculateOrderItems()`
- **Advisory lock**: `pg_advisory_xact_lock(748291048)` in `createOrder()` for serialized order number generation
- **Decimal precision**: All monetary fields use `Decimal` in Prisma, serialized via `decimalToNumber()` / `toDecimal()`

### 2.4 Server Endpoints (MOSTLY COMPLETE ⚠️)

`server.ts` has all the API endpoints wired up:

| Endpoint | Method | Uses DB? | Fallback to menuData? |
|----------|--------|----------|----------------------|
| `/api/categories` | GET | Yes | Yes, if DB empty |
| `/api/products` | GET | Yes | Yes, if DB empty |
| `/api/products/:id` | GET | Yes | Yes, if not found |
| `/api/catalog` | GET | Yes | Yes, if DB empty |
| `/api/admin/products` | GET | Yes | No |
| `/api/admin/ingredients` | GET | Yes | No |
| `/api/admin/categories` | GET/POST/PATCH/DELETE | Yes | No |
| `/api/admin/customization-groups` | GET/POST/PATCH/DELETE | Yes | No |
| `/api/admin/customization-options` | GET/POST/PATCH/DELETE | Yes | No |
| `/api/admin/ingredients` | GET/POST/PATCH/DELETE | Yes | No |
| `/api/admin/products` | POST/PATCH/DELETE | Yes | No |
| `/api/checkout` | POST | Yes | No |
| `/api/orders` | GET/POST/PATCH | Yes | No |

**Critical Issue**: `/api/products`, `/api/products/:id`, and `/api/catalog` fall back to `menuData.ts` when DB returns empty results.

### 2.5 Static Data File (PARTIAL ⚠️)

`src/data/menuData.ts` contains:
- 5 categories: `all`, `cat_matcha`, `cat_coffee`, `cat_pastries`, `cat_brunch`
- 25 products with basic fields (id, name, description, price, imageUrl, categoryId, tags, ratings, etc.)
- **MISSING**: No `customizationGroups`, `allowedOptions`, `ingredients`, `ingredientIds` fields

### 2.6 Frontend Dependencies on menuData.ts (INCOMPLETE)

Multiple frontend files still import static data from `menuData.ts`:

| File | What it imports | How it's used |
|------|----------------|---------------|
| `src/App.tsx` | `CATEGORIES, PRODUCTS` | Main rendering of categories/products |
| `src/context/CartContext.tsx` | `PRODUCTS` | Fallback product lookup in cart |
| `src/components/staff/AdminWorkspace.tsx` | `CATEGORIES, PRODUCTS` | Admin state initialization |
| `src/legacy-pages/AdminProductEditPage.tsx` | `CATEGORIES, PRODUCTS` | Product lookup for editing |
| `src/legacy-pages/AdminProductNewPage.tsx` | `CATEGORIES` | Category selection for new products |
| `src/legacy-pages/PosPage.tsx` | `CATEGORIES, PRODUCTS` | POS product listing |
| `src/legacy-pages/ItemCustomizationPage.tsx` | `PRODUCTS` | Legacy customization |
| `src/legacy-pages/EditCartItemPage.tsx` | `PRODUCTS` | Cart item editing |

---

## 3. What's Already Done (Phase 1)

### Completed
1. Prisma schema fully normalized with all 11 models and 4 enums
2. Database migration `20260904000000_init_clean_catalog` applied with all tables, indexes, FK constraints
3. F11-A migration `20260906000000_f11_a_unique_payment_intent` applied with unique index
4. Service layer fully implemented using Prisma (catalogService, inventoryService, adminService, orderService)
5. Product availability engine with `recalculateProductAvailability()` and `recalculateAffectedProducts()`
6. Customization authorization with two-level rules (group membership + allowlist)
7. Advisory lock for order number serialization (`pg_advisory_xact_lock(748291048)`)
8. Decimal precision throughout for all monetary fields
9. OrderItemModifier model for structured customization snapshots
10. F11-A payment integrity hardening (paymongo.ts rewrite, unique payment intent index)
11. STEP 8/9 concurrency fix (advisory lock moved into createOrder transaction)
12. Admin CRUD endpoints for categories, customization groups/options, ingredients, products
13. Checkout/order flow fully wired to DB services

### Partially Done
1. Seed data: `menuData.ts` categories/products exist but are NOT loaded into the database
2. Server fallbacks: `server.ts` still imports `menuData.ts` as fallback when DB returns empty
3. Frontend: Still imports `menuData.ts` directly instead of using API endpoints

---

## 4. What's Pending (Phase 1)

### 1. Seed the Database from menuData.ts
**Problem**: Database tables exist but may be empty. No seed script loads `menuData.ts` data into the database.

**Required**: Create a seed script that:
- Inserts all 5 categories from `CATEGORIES`
- Inserts all 25 products from `PRODUCTS`
- Creates ingredient records and `ProductIngredient` relations
- Creates `CustomizationGroup` and `CustomizationOption` records
- Creates `ProductCustomizationGroup` and `ProductCustomizationOption` relations
- Sets proper `manualAvailability`, `isAvailable` based on ingredient availability

**Challenge**: `menuData.ts` products don't have `ingredients`, `customizationGroups`, `allowedOptions` fields. These need to be added or derived.

### 2. Enrich menuData.ts with Catalog Metadata
**Problem**: Products in `menuData.ts` lack `ingredients`, `customizationGroups`, `allowedOptions`, `ingredientIds` fields that the DB schema expects.

**Required**: Add to each product:
- `ingredients` / `ingredientIds`: Array of ingredient references with `isRequired` flags
- `customizationGroups` / `enabledCustomizationGroups`: Ice/sugar/milk/addon group assignments
- `allowedOptions`: Allowlist of customization option IDs per product
- `productType`: "BEVERAGE" or "FOOD" based on category

### 3. Remove menuData.ts Dependency from server.ts
**Problem**: `server.ts` imports `CATEGORIES` and `PRODUCTS` from `menuData.ts` and uses them as fallback data.

**Required**: Either seed the database properly so fallbacks are never triggered, or restructure to always use the DB.

### 4. Migrate Frontend from menuData.ts to API Calls
**Files to update**:
- `src/App.tsx`: Replace `useState` with `useEffect` + API calls
- `src/context/CartContext.tsx`: Replace `PRODUCTS.find()` with API call
- `src/components/staff/AdminWorkspace.tsx`: Replace `useState` with API call
- `src/legacy-pages/AdminProductEditPage.tsx`: Replace `PRODUCTS.find()` with API call
- `src/legacy-pages/AdminProductNewPage.tsx`: Replace `CATEGORIES` with API call
- `src/legacy-pages/PosPage.tsx`: Replace `useState` with API call
- `src/legacy-pages/ItemCustomizationPage.tsx`: Replace `PRODUCTS` with API call
- `src/legacy-pages/EditCartItemPage.tsx`: Replace `PRODUCTS` with API call

### 5. Update AdminProductEditPage.tsx for DB-Based Ingredients
**Problem**: Uses `PRODUCTS.find()` from `menuData.ts` to look up products, and `product.ingredientIds` which may not match DB structure.

**Required**: Replace `PRODUCTS.find()` with `catalogService.getProductById()` and use `product.ingredients` instead of `product.ingredientIds`.

### 6. Verify Database Population
**Required**: Check if tables have been seeded. If empty, run the seed script.

### 7. Add Seed Script to package.json
**Required**: Add `prisma/seed.ts` and update `package.json` scripts.

---

## 5. Proposed Prisma Model Design

The existing `prisma/schema.prisma` is already optimal. No changes needed.

Key design decisions already made:
- `ProductIngredient.ingredient` uses `onDelete: Restrict` (ingredients must be archived, not deleted)
- `OrderItem.product` uses `onDelete: SetNull` (order items survive product deletion)
- `OrderItemModifier.option` uses `onDelete: SetNull` (modifiers survive option deletion)
- `OrderItemModifier` stores `groupName`, `optionName`, `priceAdjustment` as snapshots
- `Product.manualAvailability` is the admin-controlled toggle; `Product.isAvailable` is server-computed

---

## 6. Migration Plan

### Phase 1A: Seed the Database
1. Create `prisma/seed.ts` that imports `CATEGORIES` and `PRODUCTS` from `menuData.ts`
2. Add ingredient, customization group/option data to `menuData.ts` (or derive from existing product metadata)
3. Run `npx prisma db seed` to populate the database
4. Verify all tables have data

### Phase 1B: Remove Fallback Dependencies
1. After confirming DB is seeded, remove `menuData.ts` imports from `server.ts`
2. Remove fallback logic from `/api/categories`, `/api/products`, `/api/catalog`
3. Verify all endpoints return DB data exclusively

### Phase 1C: Migrate Frontend
1. Update `src/App.tsx` to fetch categories/products from API on mount
2. Update `src/context/CartContext.tsx` to use API for product lookups
3. Update all `src/legacy-pages/*.tsx` files to use API instead of `menuData.ts`
4. Test all pages work without `menuData.ts` imports

### Phase 1D: Cleanup
1. Remove `src/data/menuData.ts` or keep as backup only
2. Remove any remaining `menuData.ts` references
3. Update `src/types/index.ts` if needed
4. Run full test suite

---

## 7. Compatibility Analysis

### 7.1 API Compatibility
- All API endpoints already return the same data shape regardless of source (DB or fallback)
- No breaking changes expected once DB is seeded

### 7.2 Frontend Compatibility
- Frontend components use `Product` type from `src/types/index.ts` which is compatible with both DB and static data
- `formatProductForClient()` in `server.ts` already normalizes DB data to match the static data format

### 7.3 Data Compatibility
- `Product.price`: Changed from `Float` to `Decimal` — services handle via `decimalToNumber()`/`toDecimal()`
- `Order.subtotal`, `Order.totalAmount`, `Order.serviceFee`: Changed from `Float` to `Decimal`
- `OrderItem.unitPrice`, `OrderItem.subtotal`: Changed from `Float` to `Decimal`
- `OrderItemModifier.priceAdjustment`: `Decimal` (new model)
- `CustomizationOption.priceModifier`: `Decimal` (new model)

---

## 8. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| DB empty, server serves stale menuData | High | Seed the database first |
| menuData.ts products lack customization metadata | High | Add ingredients/customizationGroups to menuData.ts |
| Frontend breaks if API unavailable | Medium | Keep menuData.ts as emergency fallback during transition |
| OrderItemModifier migration for existing orders | Low | New model only; existing orders use `customizations` JSON field |
| Decimal precision issues | Low | Services already handle serialization correctly |
| Concurrent admin edits during migration | Low | Advisory locks and transaction isolation in Prisma |

---

## 9. Files Already Modified (F11-A)

- `.env.example` — F11-A configuration
- `prisma/schema.prisma` — F11-A1 + catalog normalization
- `prisma/migrations/20260906000000_f11_a_unique_payment_intent/migration.sql` — F11-A2 unique index
- `src/lib/paymongo.ts` — F11-A1 rewrite
- `src/services/orderService.ts` — STEP 8/9 concurrency fix (advisory lock + generateOrderNumber using tx)
- `scripts/smoke_test_runner.ts` — 7 syntax fixes applied

---

## 10. Conclusion

The **database schema, migration, and service layer** are fully complete and functional. The catalog normalization migration is essentially done at the backend level. The remaining work is:

1. **Seed the database** with `menuData.ts` data (including ingredients and customization metadata)
2. **Remove `menuData.ts` fallback** from server endpoints
3. **Migrate frontend** from static imports to API calls

The backend is ready. The frontend migration is the largest remaining effort.

**PHASE 1 BUILD READY: NO**

*Seed data and frontend migration required before the catalog normalization is complete.*
