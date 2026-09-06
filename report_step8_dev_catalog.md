# Step 8 — Temporary DEV/MOCK Catalog Seed: Execution Report

Date: 2026-09-06
Scope: synthetic DEV/MOCK catalog data to exercise the Step 6 domain model (R3/R4/R5). **Explicitly NOT authoritative** — see `catalog_source_discovery_step7.md` (source = NOT_FOUND). Deterministic, idempotent, no promotions, no orders created.
Predecessors: Step 6 (m5_domain_design, PASS) + Step 7 (catalog source discovery, NOT_FOUND).

## A. Objective

A DEV/MOCK catalog was required so that R3/R4/R5 development has populated
ingredients, product-ingredient joins, customization groups with `systemKey`
SUGAR/ICE, per-product allowlisted options, and surcharge-driven authoritative
pricing — none of which existed because no authoritative catalog source has
ever been found (Step 7). This seed populates that data in a fully
deterministic, idempotent way, clearly marked as temporary and not production.

## B. Deliverable: `prisma/seed.ts` (rewritten, 699 lines)

Data model surfaced to the DB (DEV baseline):

| Entity | Count | Notes |
|---|---|---|
| Category | 4 | `cat_matcha`, `cat_coffee`, `cat_pastries`, `cat_brunch`. "All" pseudo-category removed as persisted row. |
| Ingredient | 41 | espresso, matcha, teas, milks, syrups, pastry/pasta/brunch items, add-on ingredients. |
| CustomizationGroup | 4 | `group_sugar` (**systemKey SUGAR**), `group_ice` (**systemKey ICE**), `group_milk` (null), `group_addons` (null). |
| CustomizationOption | 20 | 4 Sugar (No/Less/Regular/Extra, 0), 4 Ice (No/Less/Regular/Extra, 0), 4 Milk (Whole 0 / Oat 25 / Almond 25 / Soy 20), 8 Add-ons (30/25/25/20/20/20/30/35). |
| Product | 19 | unchanged from `menuData.ts` |
| ProductIngredient | 59 | every product has ≥1 ingredient; base milk marked `isBase` (`prod_oat_flat_white → ing_oat_milk`). |
| ProductCustomizationGroup | 38 | per-product linked groups with sortOrder. |
| ProductCustomizationOption | 112 | allowlisted options with per-product `surcharge` + `sortOrder`. |
| Order | 0 | never touched by the seed. |
| Promotion | 0 | never touched by the seed (awaiting authoritative catalog). |

Key behaviors:
- **Idempotent** — upserts + deterministic delete-then-recreate of join rows;
  verified stable across many consecutive runs.
- **Transactional** — separated into per-section/ per-product transactions
  (with 60s timeouts) because one giant interactive transaction exceeds the
  PgBouncer pooler limit (observed `P2028 Transaction not found`).
- **Stale-data self-healing** — on each run it deletes any non-canonical
  option rows and the persisted `all` category if present, so it converges
  even from the older seed's state.
- **Surcharge-first pricing** — `ProductCustomizationOption.surcharge` set to
  each option's price modifier (except oat milk on the Oat Flat White, whose
  base is `isBase` and remains free at surcharge 0 — the intended surcharge-
  override demonstration). Effective price rule (from Step 6) is: use
  `surcharge` when the PCO row exists, else the option `priceModifier`.

## C. Files Changed

| File | Change |
|---|---|
| `prisma/seed.ts` | Full rewrite → DEV/MOCK catalog seed (above). |
| `src/App.tsx` | Category nav normalization: after `GET /api/categories`, filter any persisted `id==="all"` row and always prepend the `All` pseudo-category first (`[CATEGORIES[0], ...realCategories]`), preserving the public menu's "All" pill without persisting it. |
| `scripts/smoke_test_runner.ts` | STEP 11 cleanup verification narrowed from "entire DB is empty" to "zero `SMOKE_TEST_*` residue" (the DEV catalog is a permanent, populated baseline); added cleanup of the STEP 11g `SMOKE_TEST_F11_DUP` control order so the run ends at exactly 0 orders. |

## D. Steps Taken

1. Verified target DB identity (southeast-1 pooler, `:6543`, 3 migrations) and
   pre-seed counts (5 cats incl stale `all`, 4 groups sys=null, 20 old options,
   19 products, 0 ingredients, 0 orders, 0 promos).
2. Authored canonical groups/options/ingredients + per-product config in seed.
3. Ran seed repeatedly; fixed two data-correctness issues found by verification:
   - Added missing `group_addons` links for `prod_matcha_espresso_fusion` and
     `prod_oat_flat_white` (allowed add-on options were invisible without the
     linked group) → PCG 36→38, PCO group-link violations 0.
   - Extended standard option cleanup to remove stale milk/addon options too
     (duplicate names in milk/addons groups) → options 32→20, duplicates 0.
4. Updated `src/App.tsx` per approved decision (prepend "All"; never persist).
5. Updated smoke STEP 11 per approved decision (SMOKE_TEST_* residue check);
   added STEP 11g control-order cleanup.
6. Validation: `prisma validate`, `tsc --noEmit`, full smoke suite (below).

## E. Validation Results

- `npx prisma validate` — PASS.
- `npx tsc --noEmit` — PASS, exit 0.
- Seed idempotency — run repeatedly; counts identical every time
  (4/41/4/20/19/59/38/112/0/0); "No stale options to remove" on re-runs.
- Post-seed verification script — PASS:
  - no duplicate option names anywhere;
  - every product has ≥1 ingredient; exactly one `isBase` row (oat flat white);
  - PCO surcharge-override behavior correct (only intentional case: oat milk @ 0);
  - every allowed option belongs to a group linked to its product (0 violations);
  - 37 of all milk/addon options carry an `ingredientId`; stale `all` gone;
    orders=0, promotions=0.
- `npm run smoke` — **ALL PHASE 3 SMOKE TESTS COMPLETED SUCCESSFULLY WITH
  ZERO ERRORS.** STEP 11 post-cleanup count shows the DEV baseline persisted
  (4/41/4/20/19 products) and 0 smoke residue; STEP 12 tables + 3 migrations
  verified; STEP 11g F11-A passed and its control order was cleaned up.

## F. Final DB State (post-seed, post-smoke)

```
categories 4 | ingredients 41 | groups 4 | options 20 | products 19
productIngredients 59 | productCustomizationGroups 38 | productCustomizationOptions 112
orders 0 | orderItems 0 | orderItemModifiers 0 | promotions 0
```

## G. Deviations / Notes

- Smoke STEP 11 previously asserted an **empty database** after cleanup. That
  contract is incompatible with a permanently populated DEV catalog. Per the
  approved decision, the assertion now verifies exclusively that
  `SMOKE_TEST_*` / `Concurrent_Customer_*` residue is zero. The DEV baseline
  count is printed for visibility and is intentionally non-zero.
- `src/App.tsx` now guarantees the "All" pill always exists as a client-side
  pseudo-category — the fix for the menu regression that deleting the persisted
  `all` row would otherwise cause.
- The STEP 11g F11-A duplicate-intent test creates a `SMOKE_TEST_F11_DUP`
  control order that STEP 11 cleanup cannot reach (it precedes 11g). The
  smoke suite now removes it at the end so the DB returns to exactly 0 orders.

## H. Not Implemented (unchanged scope)

- No R3/R4/R5 application features, no promotions, no checkout changes, no UI
  redesign, no production claims. Catalog remains DEV/MOCK and
  **NOT authoritative** — an authoritative source is still required before any
  real catalog or promotion data is seeded (Step 7 blocker).
- `prisma/schema.prisma` untouched this step (validated, unchanged).