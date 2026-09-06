# Step 5: Database & Domain Design Audit — Report

## Date: 2026-09-06

---

## 1. Executive Summary

The Step 5 audit validates the database schema, applied migrations, and service layer against the **approved business workflow** for `Cafe_Builders`. The audit is **READ-ONLY**: no code, schema, or migration changes were made during this step.

The order domain is largely sound: order statuses cover all 5 states, snapshots are complete and server-authoritative, and the schema uses normalized explicit join tables with correct uniqueness. However, the audit found **four REQUIRED domain changes** (strict payment-first lifecycle, KDS never seeing unpaid orders, product-specific customization surcharges, server-side promotions, system-defined sugar/ice) and **one BLOCKER**: the production catalog source has not been identified — the database was seeded from mock `menuData.ts`, so no authoritative catalog data exists yet.

**STEP 5 STATUS: COMPLETE (AUDIT)**
**VERDICT: BLOCKED until catalog source provided.**

---

## 2. Scope & Method

- **Target of audit**: `prisma/schema.prisma`, applied migrations, `src/services/*`, `server.ts`, relevant pages (`KdsPage`, `PosPage`, `CartPage`, `ItemCustomizationPage`, `EditCartItemPage`), `src/types/index.ts`, `src/lib/*`.
- **Authority**: the git repository at `/mnt/c/Users/jeric/Documents/GitHub/my-portfolio/Cafe_Builders` (HEAD `24e6b5a`).
- **Approved workflow being validated against** (excerpt):
  - Order lifecycle: `PENDING_PAYMENT -> PAID -> PREPARING -> READY -> COMPLETED`; Pay-at-Cashier = `PENDING_PAYMENT -> PAID` at cashier.
  - **KDS must NEVER receive or display `PENDING_PAYMENT` orders.** KDS is not responsible for payment, promos, or catalog.
  - Cancellation/refund are **out of scope** (no refund/cancel models required).
  - Milk: base milk is a base Ingredient; alternatives are per-product enabled Ingredients with product-specific surcharge; base excluded from alternatives; disabled alternatives hidden.
  - Add-ons: only MULTIPLE-selection with product-specific surcharge; surcharge NOT on the Ingredient.
  - `Ingredient.isAvailable = false` gates customer-facing selection.
  - Sugar (Less/Normal/More Sweet) and Ice (Regular/Less/No Ice) are system-defined, single-select, zero-surcharge, and CANNOT be created/edited by admin.
  - Promotions exist in the workflow (no code specified).

**Note**: The earlier `audit_report_phase1.md` claim of "25 products" was traced to an error; the mock `menuData.ts` never contained more than **19** products (17 at commit `29b49e5`, +2 at `3edccf9`/`f04caca`). Two extra `prod_*` strings (`prod_croissant`, `prod_matcha_latte`) exist only as graceful-fallback IDs in `SeasonalHeroCarousel.tsx` and are never defined.

---

## A. Order Domain

**A1. Exact `OrderStatus` enum** (`schema.prisma:21-27`):
`PENDING_PAYMENT`, `PAID`, `PREPARING`, `READY`, `COMPLETED`. DB default is `PENDING_PAYMENT` (`migration.sql`).

**A2. Does it represent all 5 approved states?** — **YES.** All five states exist and map 1:1 to the approved lifecycle.

**A3. Is a separate `NEW` status needed?** — **NO.** `PAID` is the correct "new / ready for kitchen" gate. A `NEW` enum value would be redundant.

**A4. Is payment state mixed into `OrderStatus`?** — **Yes.** `PENDING_PAYMENT` is a payment state, and payment confirmation is expressed solely as a status transition. Payment identity is stored on the order (`paymentIntentId @unique` via F11-A, `paymentMethodId`, `qrCodeUrl`). There is **no timestamp** recording *when* payment cleared (`paidAt`).

**A5. Is a separate payment model needed?** — **No full model** (cancellation/refund are out of scope), but a minimal `Order.paidAt` field is REQUIRED so "payment confirmed" is an observable fact rather than only an inferred state.

**A6. Pay-at-Cashier transition supported?** — **Partially.** `PENDING_PAYMENT -> PAID` is legal today (`errors.ts:60`), but the shipped flows bypass it:
- PayMongo webhook / simulate → jumps to `PREPARING` (`server.ts`, `orderService.recordPayment` default `status: "PREPARING"`).
- POS cash charge → jumps to `PREPARING` (`PosPage.tsx`).
- On the webhook table, payment methods and `status` PATCH fall back to `PREPARING`.
`PAID` is only reachable by manual PATCH (no current UI control).

**A7. Allowed transitions (current)** — `errors.ts:59-65`:
- `PENDING_PAYMENT -> [PAID, PREPARING]`
- `PAID -> [PREPARING]`
- `PREPARING -> [READY]`
- `READY -> [COMPLETED]`
- `COMPLETED -> [READY]` (KDS "Reopen")
Plus idempotent self-transitions. The `PENDING_PAYMENT -> PREPARING` override is what lets unpaid orders reach the kitchen — **REQUIRED to remove**.

---

## B. Order Snapshots

Snapshots are **strong and server-authoritative** today:

| Data | Persisted? | Where |
|---|---|---|
| product name | ✅ | `order_item.productName` |
| base price | ✅ | `order_item.unitPrice` |
| quantity | ✅ | `order_item.quantity` |
| modifiers (name + price) | ✅ | `order_item_modifier.groupName / optionName / priceAdjustment / quantity` |
| line subtotal | ✅ | `order_item.subtotal` |
| order subtotal / serviceFee / total | ✅ | `order.subtotal / serviceFee / totalAmount` |
| discount | ❌ | **no column** |
| promo code | ❌ | only free-text inside `order.notes` (`server.ts`) |
| paid-at time | ❌ | **no column** |

- **Server price trust**: the server **does NOT trust browser prices/names.** `createOrder -> calculateOrderItems()` recomputes every unit price and modifier from DB and enforces two-level authorization (group membership + allowlist). Client-supplied `unitPrice`, `subtotal`, and `discount` are ignored.
- **Gap**: a customer-facing promo discount (client-side in `CartPage.tsx`) is silently dropped at order creation — the stored total never reflects it, so order snapshots disagree with what the customer saw.

---

## C. Customization Domain

| Approved rule | Current state | Verdict |
|---|---|---|
| Sugar system-defined (Less/Normal/More Sweet) | Must be admin-created options; frontend hardcodes differing values | **REQUIRED (R4)** |
| Ice system-defined (Regular/Less/No Ice) | Same as sugar | **REQUIRED (R4)** |
| Base milk as base Ingredient | `ProductIngredient` exists, but nothing marks a *base* | **REQUIRED (marker)** |
| Alternatives = per-product Ingredients with product-specific surcharge | Alternatives are plain `CustomizationOption`s with a **global** `priceModifier` | **REQUIRED (R3)** |
| Add-ons with product-specific surcharge | Same gap (no per-product surcharge column) | **REQUIRED (R3)** |
| Surcharge NOT on Ingredient | Correct today — `Ingredient` has no price | ✅ |
| `isAvailable=false` gates customization | Only gates *product* availability, not customization visibility | **REQUIRED (logic)** |
| Base milk excluded from alternatives | No base/alternative distinction | **REQUIRED (R3)** |

The schema shape (explicit `ProductCustomizationGroup` / `ProductCustomizationOption` joins) is the correct pattern for relationship-specific metadata, but the join tables lack the metadata the business rules need: per-product surcharge and a base/alternative distinction.

---

## D. Promotions

- **No `Promotion` model exists** anywhere in schema or services.
- The only promo logic is **client-side** in `CartPage.tsx` — three hardcoded codes (`SAVE10`, `SAVE20`, `TAKE5`) reduce the client's displayed total. The server never validates them; `promoCode` is appended to `order.notes`; `discount` is discarded.
- **Result**: the promotions feature is non-functional against the order record and violates the "server-authoritative totals" principle.
- **Required**: a minimal `Promotion` + `PromotionProduct` model and `Order.promoCode` / `Order.promoDiscount`, with single-promo-per-order enforced at the service layer. (Schema created in R5; **no promo/catalog data seeded** — waiting on the authoritative catalog.)

---

## E. Catalog

- Categories/products/ingredients/groups/options/relations are intended to live in the **database**.
- Current DB rows were seeded from mock `menuData.ts` + legacy-page customization constants (Phase 1A). Ingredients/relations are empty.
- `server.ts` still falls back to `menuData.ts` for `/api/products`, `/api/products/:id`, and `/api/catalog` when the DB returns empty, and multiple frontend files import it directly.

**BLOCKER: production catalog source has not yet been identified.** The database schema is the correct target, but the rows are derived from mock data and no authoritative product/ingredient/recipe/pricing data exists in the repository or database.

---

## F. Relationships and Constraints

| Item | Status |
|---|---|
| `categories.slug` unique | ✅ |
| `orders.orderNumber` unique | ✅ |
| `orders.paymentIntentId` unique (F11-A) | ✅ |
| Composite `@@id` on all three join tables (no duplicate product↔X pairs) | ✅ |
| `option -> group` CASCADE | ✅ |
| `product -> category` **CASCADE** | ⚠️ deletes products with the category |
| `ProductIngredient.ingredient` RESTRICT | ✅ (archive, don't delete) |
| `OrderItem.product` / `OrderItemModifier.option` SET NULL | ✅ (history survives) |
| Customization uniqueness `(productId, groupId)` / `(productId, optionId)` | ✅ |
| Option↔group linkage validated service-side | ✅ |
| Relationship-specific metadata (surcharge, base marker, sortOrder) on join tables | ❌ missing |

---

## G. Final Classification

### SAFE — no change needed
- Full `OrderStatus` set; snapshot model (names, prices, modifiers, quantities, subtotals, totals).
- Server-authoritative ordering math (no browser-trusted prices).
- Composite uniqueness on join tables; `SetNull` history preservation.
- F11-A unique `paymentIntentId` binding.

### REQUIRED
- **R1** — Strict `PENDING_PAYMENT -> PAID -> PREPARING`; webhook and POS land on `PAID`; record `paidAt`.
- **R2** — KDS never receives/displays `PENDING_PAYMENT` (server list filter + realtime gate + KDS page).
- **R3** — Ingredient-backed alternative/add-on options with per-product `ProductCustomizationOption.surcharge`; base-milk marker; availability gates customization.
- **R4** — System-defined Sugar/Ice (`CustomizationGroup.systemKey`) with locked admin CRUD.
- **R5** — Server-side `Promotion` / `PromotionProduct` model + `Order.promoCode` / `promoDiscount` (schema; seed deferred).

### RECOMMENDED
- `product -> category` FK `CASCADE -> RESTRICT` (prevent accidental catalog deletion).
- `ProductCustomizationOption.sortOrder` for deterministic option ordering.
- DB-level consistency guard for option↔ingredient linkage.

### BLOCKER
- **Production catalog source unidentified** — DB seeded from mock `menuData.ts`; no authoritative data exists.

---

## 3. Final Domain Summary

- **Statuses**: `PENDING_PAYMENT -> PAID -> PREPARING -> READY -> COMPLETED` (+ `COMPLETED -> READY` reopen).
- **Payments**: no separate model; `paymentIntentId @unique`; webhook & POS currently skip `PAID`; `PENDING_PAYMENT -> PREPARING` override exists and must be removed.
- **Payment method**: `QRPH` / `CASH`. **Order type**: `DINE_IN` / `TAKEAWAY`. **Selection mode**: `SINGLE` / `MULTIPLE`.
- **Pricing**: server-recomputed from DB; product-specific surcharge on `ProductCustomizationOption` (fallback `CustomizationOption.priceModifier`).
- **Customizations**: options belong to groups; products link groups (with `sortOrder`) and allowlist options; product links a base + ingredient-backed alternatives/add-ons; availability gates customization visibility.
- **Promotions**: server-side single-code-per-order with persisted discount snapshot.
- **Snapshots**: `OrderItem` + `OrderItemModifier` fully self-describing; promo & paid-at added in R1/R5.

## 4. Final Verdict

**BLOCKED until catalog source provided.**

The order domain is audited and the four REQUIRED domain changes (R1–R5) are defined with no remaining schema ambiguity. The only hard blocker on production completeness is the absence of an authoritative catalog source to seed the database and promotions.