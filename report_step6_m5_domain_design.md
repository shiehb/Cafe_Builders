# Step 6 — m5_domain_design (R1–R5 groundwork): Execution Report

Date: 2026-09-06
Scope: schema + single migration + R1/R2 application changes + validation. No catalog/promotion seeding.

## 1. Schema (`prisma/schema.prisma`) — `npx prisma validate` PASS

- `PromotionDiscountType` enum (`PERCENT`, `FIXED`).
- `Ingredient.options` back-relation.
- `CustomizationGroup.systemKey String? @unique` (reserved for system sugar/ice groups).
- `CustomizationOption.ingredientId` + `ingredient` FK (`onDelete: Restrict`), `@@unique([groupId, ingredientId])`, `@@index([ingredientId])` (shared ingredient, no global unique).
- `Product.category` FK `onDelete: Restrict` (replaces CASCADE).
- `ProductIngredient.isBase Boolean @default(false)` (matrix base milk; no ADD_ON role on `ProductIngredient`).
- `ProductCustomizationOption.surcharge Decimal @default(0)` + `sortOrder Int @default(0)` (per-product authoritative pricing, deterministic ordering).
- `Order.paidAt DateTime?`, `promoCode String?`, `promoDiscount Decimal @default(0)`, `promotionId` FK (`SetNull`).
- New `Promotion` + `PromotionProduct` (+ `Product.promotions` back-relation). Schema created; **no promo rows seeded** (awaiting authoritative catalog).

## 2. Migration — applied and recorded

- Folder `prisma/migrations/20260906000001_m5_domain_design/migration.sql` created.
- DDL generated offline (`prisma migrate diff --from-schema-datamodel`), applied per-statement via Prisma client (`pgbouncer=true`, simple protocol) because `prisma migrate dev` / `migrate status` / `db execute` hang or no-op against the Supabase transaction pooler (environment quirk).
- `_prisma_migrations` now 3 rows (init, f11_a, m5_domain_design), checksums verified; m5 row recorded with explicit UUID id.
- All 8 pieces verified in DB:
  - `promotions`, `promotion_products` tables
  - `PromotionDiscountType` enum (PERCENT, FIXED)
  - `customization_options.ingredientId` + unique `(groupId, ingredientId)` + index
  - `customization_groups.systemKey` unique
  - `product_ingredients.isBase`
  - `product_customization_options.surcharge`, `sortOrder`
  - `orders.paidAt`, `promoCode`, `promoDiscount`, `promotionId`
  - `products.categoryId` FK RESTRICT (`confdeltype = r`)
- `npx prisma generate` PASS (client regenerated; initial EPERM was the running dev server holding the engine DLL — cleared once the server was stopped).

## 3. R1/R2 application changes (implemented)

| File | Change |
|---|---|
| `src/services/errors.ts` | `ORDER_TRANSITIONS.PENDING_PAYMENT = ["PAID"]` — strict lifecycle; removed the former PENDING_PAYMENT→PREPARING staff override; `COMPLETED→READY` reopen kept as documented exception. |
| `src/services/orderService.ts` | `updateOrderStatus`/`recordPayment` stamp `paidAt` entering PAID (idempotent); `recordPayment` default target **PAID**; `listOrders` supports `excludeStatus` (`notIn`); `mapOrderToDto` exposes `paidAt/promoCode/promoDiscount/promotionId`; effective pricing = allowlist `surcharge`, else `priceModifier`. |
| `server.ts` | `GET /api/orders?excludeStatus=PENDING_PAYMENT`; `order_created` broadcast gated to non-PENDING_PAYMENT; PayMongo webhook + simulate land on **PAID** (not PREPARING). |
| `src/legacy-pages/PosPage.tsx` | CASH sends `paymentStatus:"PAID"` → order lands on PAID at checkout; removed the PATCH-to-PREPARING follow-up. **No "Mark as Paid" action added.** |
| `src/legacy-pages/KdsPage.tsx` | fetches `?excludeStatus=PENDING_PAYMENT`; realtime ignores PENDING_PAYMENT; PENDING_PAYMENT kanban column/bucket/actions and "Pending" metric removed (3 columns); dead simulate-webhook code removed. |
| `src/services/types.ts`, `src/types/index.ts` | DTO mirrors for `paidAt`, `promoDiscount`, `promotionId`, `ingredientId`, `surcharge`, `sortOrder`, `isBase`; `ListOrdersOptions.excludeStatus`. |
| `src/services/catalogService.ts` | allowlist create/update seed `surcharge` from the option's `priceModifier` (standard price on enable) and `sortOrder` = input position; ordering of `allowedOptions` by `sortOrder`. |
| `src/services/adminService.ts` | customization-option create/update persist `ingredientId`. |

## 4. Validation results

- `npx prisma validate` — PASS.
- `npm run lint` (`tsc --noEmit`) — PASS, exit 0.
- `npm run smoke` — **ALL steps pass, zero errors** (STEPs 0–12 + 11g), incl. authoritative pricing (380), snapshot immutability, strict status progression, R1 `recordPayment → PAID` + `paidAt` stamp, concurrency, error handling, cleanup, architecture verification. Two intentional test-expectation updates to reflect the approved domain: STEP 8 asserts PAID + paidAt; STEP 12 migration list includes `m5_domain_design`.
- Seed idempotency — `npx prisma db seed` run twice yields a stable catalog: 5 categories / 4 groups / 20 options / 19 products, no duplicates.
- DB final state: 0 orders, test residue cleaned; 3 migrations recorded.

## 5. Not implemented (per directives)

- POS "Mark as Paid" action — strictly deferred (not implemented). QRPH order whose webhook never fires stays `PENDING_PAYMENT` and is **never visible to the KDS**; no manual workaround by design — documented operational limitation.
- No cancellation / refund flow. No F11-B/C/D/E additions. No visual redesign.
- No production seed from `menuData.ts`; the dev seed (`prisma/seed.ts`) remains the mock. **Authoritative catalog source still required** before any real catalog or promotion (SAVE10/SAVE20/TAKE5) data is seeded — the `Promotion` schema is ready but empty.