# Catalog Source Discovery — Step 7

Date: 2026-09-06 · Authoritative repo: `/mnt/c/Users/jeric/Documents/GitHub/my-portfolio/Cafe_Builders`
Method: READ-ONLY. No files, DB, schema, migrations, seed, code, or UI modified. Inspected working tree, git history (all refs), supabase SQL artifacts, static assets, and docs.

## A — Candidate Sources

| # | Path | Type | Mock/Dev or Authoritative | Products | Categories | Options | Prices? | Ingredients? | Cust. relations? | Imgs authoritative? | Promos? | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `src/data/menuData.ts` | TS module | **Mock/Dev** | 19 | 5 (incl. "All") | 0 | Yes (PHP 135–345) | No | No | **No** (Unsplash, reused) | No | See §B |
| 2 | `prisma/seed.ts` | TS seed | **Mock/Dev** | 19 (from menuData) | 5 | 20 (4 groups) | Yes (option modifiers 0/20/25/30/35) | No | No (join tables empty) | n/a | No | See §C |
| 3 | `supabase/schema_and_seed.sql` | SQL (legacy) | **Legacy manual seed** | **0** (no product INSERT) | 3 | 10 (4 groups) | Yes (modifiers only) | 4 (Espresso Beans, Oat/Whole Milk, Vanilla Syrup) | No | n/a | No | See §C |
| 4 | `supabase/schema.sql` | SQL | Legacy schema only | 0 (0 INSERTs) | – | – | – | – | – | – | – | DDL only |
| 5 | `migration.sql` (root) | SQL | Legacy Prisma DDL | 0 (0 INSERTs) | – | – | – | – | – | – | – | DDL only |
| 6 | `metadata.json` | JSON | App metadata | 0 | – | – | – | – | – | – | – | No catalog |
| 7 | `api/[...path].ts` | Serverless handler | n/a | 0 | – | – | – | – | – | – | – | No product fixtures |
| 8 | `src/legacy-pages/ItemCustomizationPage.tsx` (+ `EditCartItemPage`) | TSX | **Mock/Dev** | 0 | – | hardcoded constants suga/ice/milk/addons | Yes (same as seed) | No | No | n/a | No | Duplicates seed constants exactly |
| 9 | `public/` | Static assets | **Absent** | – | – | – | – | – | – | – | – | Directory does not exist; no local product imagery |
| 10 | Docs (brief, implementation plans, audit reports) | MD | Docs | 0 | – | – | – | – | – | – | – | Describe data as mock/placeholder; no menu provenance |
| 11 | Git history (all refs) | History | No deleted catalog files | – | – | – | – | – | – | – | – | See §D |

**No JSON/CSV/XLSX catalog, no import/export files, no archived menu, no API-response fixtures, no authoritative imagery exist anywhere in the repository.**

## B — menuData.ts Assessment — MOCK (SAFE to exclude as authoritative)

- Contents: `CATEGORIES` (5 incl. pseudo-category "All") + `PRODUCTS` (19), fields incl. `rating`, `reviewCount`, `topPick`, `houseSpecial`, `originalPrice`, `prepTimeMinutes`, `calories`.
- **Imagery not authoritative**: every `imageUrl` is an external `images.unsplash.com` stock photo; identical photos are reused across products (e.g. `prod_matcha_strawberry` reuses the Emerald Mint photo; `prod_croissant_supreme` reuses the Butter Croissant photo).
- **No ingredients**: only `milkOptionsAvailable` booleans; zero ingredient definitions or per-product ingredient links.
- **No customization relationships**: no groups/options/allowlists; only `sweetnessAdjustable`/`milkOptionsAvailable` flags.
- **No promotions**, no codes, no store/brand provenance. The only brand string is fictional: `Artisan Cafe` (`server.ts:916`).
- Marketing-style copy (ratings 4.7–5.0, "Ceremonial grade", "Sicilian pistachio", "Nan...", "Chef Special") and decorative fields indicate a hand-authored demo menu, not an audited physical menu.
- **Lineage** (git): initial commit `29b49e5` had 17 products → `3edccf9` added 2 → `f04caca` finalized field contract. Never re-sourced from any external menu.
- **Verdict: mock/dev; must NOT be adopted as the production catalog.**

## C — Seed/Data Assessment

- **`prisma/seed.ts` (MOCK):**
  - Upsert-only (idempotent); derives categories/products directly from `menuData.ts`; adds 4 groups (ice/sugar/milk/addons) and 20 options: sugar `0/25/50/75/100%`, ice `Less/Regular/Extra`, milk `Whole Fresh Milk 0 / Oat 25 / Almond 25 / Soy 20`, addons `Extra Espresso Shot 30 / Himalayan Sea Salt Foam 25 / Artisan Coffee Jelly 25 / Vanilla Bean Syrup 20 / Extra Whipped Butter 20 / Artisan Honey Drizzle 20 / Crushed Roasted Pistachios 30 / Warm Chocolate Dip 35`.
  - Prints `Ingredients: 0 (BLOCKED - no source data)` and 3 more `(BLOCKED)` rows — the seed itself declares no authoritative ingredient/relationship data.
  - No promotions or promo rows.
- **`supabase/schema_and_seed.sql` (LEGACY/MANUAL, not authoritative):**
  - Pre-Prisma manual schema + partial seed. Different taxonomy and ids than the app: 3 categories (`Espresso Classics`, `Iced Coffee`, `Pastries & Bakery`) with an `categories.type` column **not present** in the current Prisma schema; groups `group_ice_level/group_sugar_level/group_milk_choices/group_add_ons`; 10 options (`Less/Regular/Extra Ice`, `Less/Regular/More Sweet`, `Whole Milk 0 / Oat Milk 25`, `Extra Shot 30 / Coffee Jelly 25`); 4 ingredients (`Espresso Beans`, `Oat Milk`, `Whole Milk`, `Vanilla Syrup`) — the **only ingredient definitions in the repo**.
  - **No products at all** → cannot establish a product catalog.
  - Milk/add-on prices corroborate the mock constants (Oat 25, Extra Shot 30, Coffee Jelly 25) but conflict with the current option names/ids and category set; it is an alternative hand-authored bootstrap, not a reconciled source.
- **`schema.sql`, root `migration.sql`:** DDL only, no data.
- **The entire customization surface** (seed, ItemCustomizationPage, EditCartItemPage) is one duplicated set of hand-written constants — one mock family, no independent provenance.

## D — Git/Repository History Findings

- 40 commits on `main` (29 oneline shown + earlier); no branches/tags beyond `origin/main`.
- Only data-like paths ever tracked: `src/data/menuData.ts`, `supabase/schema_and_seed.sql`, `supabase/schema.sql`, root `migration.sql`, `metadata.json`, plus config/lockfiles.
- `menuData.ts` history: `29b49e5` (17) → `3edccf9` (+2 → 19) → `f04caca` (contract finalize). No rewrite/re-source either existed; all versions are the same hand-authored demo data.
- Deleted files ever in history: `src/components/ProductCard.tsx`, `src/components/ProductDrawer.tsx`, `vercel.json`, `package-lock.json` — **no deleted catalog/seed/data/import files**.
- No commits reference an actual cafe, menu PDF, price list, owner, or external survey.

## E — Catalog Completeness

| Dimension | In-repo coverage |
|---|---|
| Products | 19 mock (no provenance) |
| Categories | 5 mock (vs 3 legacy-manual alternative) |
| Ingredients | 0 in seed; 4 legacy-manual (schema_and_seed.sql) |
| Customization options | 20 mock (sugar/ice/milk/addons), no ingredient-backed linkage, no systemKey pinning |
| Product↔ingredient / allowlist | 0 rows; no authoritative relationships |
| Prices | Present but hand-authored; option prices consistent across copies but unverified |
| Images | Remote stock (Unsplash), reused — not the store's |
| Promotions | None defined |
| Reconciliation proof | None (no owner/store confirmation anywhere) |

## F — Authority Assessment — BLOCKER

- **Every repository artifact traces to a single hand-authored mock family** (`menuData.ts` + duplicated customization constants). Nothing is independently sourced from the cafe's actual menu, price list, recipes, or imagery.
- `supabase/schema_and_seed.sql` contains plausible prices and the only ingredient definitions, but has no products, contradicts current categories, and predates the Prisma schema — partial and unreconciled.
- No JSON/CSV/XLSX import, no fixtures, no docs stating provenance.
- Per the Step 6 audit (`audit_completion_step6.md` §A) and Step 5 audit (§E), the DB was explicitly classified mock/dev. This discovery confirms there is **no authoritative source in the repository**.

## G — Recommended Next Step

- **REQUIRED**: obtain an authoritative catalog source from the owner/store, e.g. physical menu (photo), POS/back-office export (CSV/XLSX), or owner-confirmed price list covering products, categories, ingredients, per-product customization allowances, and promo definitions. Only the owner can establish authority.
- **RECOMMENDED (once source is provided)**: reconcile menuData/mock against the source, then perform R3/R4/R5 data loading (ingredients, ingredient-backed milk alternatives with per-product `ProductCustomizationOption.surcharge`, `systemKey` sugar/ice groups, allowlists, promotions).
- **SAFE**: keep current mock rows unchanged until reconciliation.
- **NOT_IMPLEMENTED_GUARD**: external web search was not performed (out of scope per instructions); no data was invented, seeded, or cleaned.

### Final Classification

**NOT_FOUND** — no authoritative catalog source exists in the repository. All product/category/option/ingredient/promo data traces to hand-authored mock (`menuData.ts` + duplicated constants + legacy manual SQL); there is no owner/store-provided source to establish the production catalog.