# Audit Report — Cafe_Builders vs. Current Authoritative Business Workflow

**Doc audited:** `Cafe_Builders_Current_Authoritative_Business_Workflow.md` v1.0 (2026-09-06) · **Repo:** `/mnt/c/Users/jeric/Documents/GitHub/my-portfolio/Cafe_Builders` · **Mode:** READ-ONLY, no changes made · **Date:** 2026-09-06

## 1. Executive Summary

The transaction core (order lifecycle, authoritative server pricing, snapshots, PayMongo fail-closed webhook, DB-unique `paymentIntentId`, KDS `excludeStatus` gating, DEV/MOCK catalog separation) is largely **COMPLIANT**. The critical failures are **unauthenticated, ungated payment-state bypasses** (simulate endpoints and the public status PATCH), a **broken POS cash path**, and **entirely missing** promotion, milk/base-option, ingredient-availability, system-key, and admin-monitoring functionality. Verdict: **NOT COMPLIANT** as deployed; do not begin a broad rewrite — remediate the prioritized gaps in §18 after business approval (§19).

## 2. Repository Baseline
- Single Express+Next server (`server.ts`, 1289 lines); Prisma/Postgres (Supabase pooler); 3 migrations applied (init_clean_catalog, f11_a_unique_payment_intent, m5_domain_design).
- Database: 4 categories / 41 ingredients / 4 groups / 20 options / 19 products / 59 PI / 38 PCG / 112 PCO / 0 orders / 0 promotions — matches doc §24.
- Validation available: `npm run lint` (= `tsc --noEmit`), `npm run smoke` (`scripts/smoke_test_runner.ts`). No ESLint, no unit-test framework, no CI orchestration.
- Authoritative repo is the Windows path; Bash env uses Windows `npx` shims; dev server on `:3000`.

## 3. Compliance Matrix (Area | Requirement | Current Implementation | Classification | Severity | Evidence)

| # | Area | Requirement (doc) | Current Implementation | Classification | Severity | Evidence |
|---|---|---|---|---|---|---|
| 1 | Lifecycle | `PENDING_PAYMENT→PAID→PREPARING→READY→COMPLETED`; no PENDING_PAYMENT→PREPARING | `ORDER_TRANSITIONS` enforces exactly; COMPLETED→READY "Reopen" noted | COMPLIANT | – | errors.ts:62–68; orderService.ts:521 |
| 2 | Lifecycle | Payment completion is the gate PENDING_PAYMENT→PAID | Enforced server-side, BUT public `PATCH /api/orders/:id/status` lets anyone set PAID | PARTIALLY COMPLIANT | Critical | server.ts:1072–1100; errors.ts:63 |
| 3 | Payment | F11-A1 no silent sim fallback in QR generation | `paymongo.ts` throws, never falls back; sim only when `PAYMONGO_SIMULATION_ENABLED==="true"` | COMPLIANT (QR path) | – | paymongo.ts:47–76 |
| 4 | Payment | Simulation only when explicitly enabled | Simulate **webhook endpoints** unauthenticated & ungated; customer UI button calls it | **CONTRADICTS** | Critical | server.ts:1223–1274; OrderReceiptPage.tsx:75–100,317–334 |
| 5 | Payment | F11-A3 webhook fail-closed; production rejects unsigned | 401/503 on bad/missing signature; dev override flag; production locked | COMPLIANT | – | server.ts:1145–1167 |
| 6 | Payment | `paymentIntentId` nullable + DB-unique | Unique index; duplicate → P2002 caught silently | COMPLIANT | – | schema.prisma:254; migration f11_a:6 |
| 7 | Payment | `paidAt` stamped entering PAID, idempotent | Stamped on PAID entry; preserve prior value | COMPLIANT | – | orderService.ts:533,578 |
| 8 | Payment | Cashier confirm → PAID (no Mark-as-Paid shortcut) | POS cash path broken (no `cashTendered` sent); cashier confirm flow absent; only bypasses exist | **CONTRADICTS/MISSING** | High | PosPage.tsx:197–215; server.ts:886–895 |
| 9 | Pricing | Server authoritative; recalc from DB; ignore client price | `calculateOrderItems` recomputes; STEP 5 proves tamper rejection | COMPLIANT | – | orderService.ts:170–354; smoke:230–324 |
| 10 | Pricing | PCO.surcharge overrides option.priceModifier | Server applies override; **client/catalog serve `priceModifier`** → display ≠ charge | PARTIALLY COMPLIANT | High | orderService.ts:311–314; server.ts:384–388; ItemCustomizationPage.tsx:253–257 |
| 11 | Promotions | Server validates & applies one promo; store promoCode/discount/promotionId | **Not implemented at all**; promo only appended to notes; client hardcoded promos dropped at checkout | **MISSING/CONTRADICTS** | High | server.ts:856–859; orderService.ts:409–447; CartPage.tsx:29–73 |
| 12 | Catalog | Product availability controls ordering | Product-level recompute + order rejection works | COMPLIANT | – | inventoryService.ts:177–189; orderService.ts:221–227 |
| 13 | Catalog | Ingredient availability gates ingredient-based options | **No option-level gate** in catalog or order validation | **MISSING** | High | orderService.ts:282–326; catalogService.ts:21–53 |
| 14 | Customization | Sugar/ice system-defined; admin cannot create/edit via normal mgmt | `systemKey` unique exists; **no admin enforcement** (0 refs in adminService/routes) | **MISSING** | High | schema.prisma:103; adminService.ts (0 refs); server.ts:521,538 |
| 15 | Customization | Milk: base hidden, alternatives per-product, surcharge product-specific | Base-milk hide **not implemented** (isBase unused); UI shows all options with global modifier | **MISSING** | High | grep isBase=0 runtime refs; ItemCustomizationPage.tsx |
| 16 | Customization | Disabled options/ingredients not selectable/offered | Server blocks inactive/archived/not-allowed; **public catalog still returns disabled options** | PARTIALLY COMPLIANT | Medium | orderService.ts:288–306; catalogService.ts:28–37; server.ts:355–410 |
| 17 | Snapshots | Historical orders preserve product/custom/promo/payment info | productName/unitPrice + modifier groupName/optionName/priceAdjustment snapshots; promo fields never populated | PARTIALLY COMPLIANT | High | orderService.ts:423–443; smoke STEP 6 |
| 18 | KDS | Exclusive of PENDING_PAYMENT; PAID+ only; snapshot display | `excludeStatus=PENDING_PAYMENT` + client filter + realtime gate; 3-column PAID/PREPARING/READY/COMPLETED; no payment UI | COMPLIANT | – | KdsPage.tsx:81,84,106–110,442–488; server.ts:1036–1047 |
| 19 | Realtime | order_created must not expose PENDING_PAYMENT as kitchen work | Creation broadcast gated (`status !== PENDING_PAYMENT`); but SSE/channel publish full orders to all | COMPLIANT (gating) / PARTIAL (privacy) | Medium | server.ts:955–963,88–114 |
| 20 | Admin | Order monitoring; distinguish unpaid vs paid | **No admin orders view/routes** (AdminWorkspace has 5 views, none for orders) | **MISSING** | High | AdminWorkspace.tsx:27,42–48; server.ts:423–772 |
| 21 | Dev/Mock | DEV catalog not authoritative; All-category UI-only | 4/41/4/20/19/59/38/112, promos 0; App.tsx prepends All (filters `id==="all"`) | COMPLIANT | – | App.tsx; seed.ts; doc §24 |
| 22 | Out of Scope | Cancellation/refund not required | No such behavior; not treated as missing | COMPLIANT | – | errors.ts transitions |

## 4. Critical Conflicts
1. **Simulate-payment backdoor** — `/api/webhooks/paymongo/simulate`, `/api/simulate-webhook`, `/api/simulate/webhook-payment` (server.ts:1223–1274) are authenticated nowhere and never check `PAYMONGO_SIMULATION_ENABLED` (grep: it appears only in paymongo.ts:48). A bare POST marks the newest PENDING_PAYMENT QRPH order **PAID** and broadcasts it. The customer-facing receipt page exposes this as a button (`OrderReceiptPage.tsx:75–100, 317–334`). Directly contradicts F11-A1 and RNBR 14/15.
2. **Public "Mark as Paid"** — `PATCH /api/orders/:id/status` (server.ts:1072–1100) has no auth and accepts `PAID`, bypassing the cashier/webhook gate; contradicts Sec 15#5–6 and RNBR 18. (Illegal transitions correctly 409 at the service layer but the route re-maps them to HTTP 500.)
3. **POS cash checkout cannot complete** — PosPage sends `paymentStatus:"PAID"` but never `cashTendered` (payload at PosPage.tsx:197–215); server rejects `0 < total` with `INSUFFICIENT_CASH` (server.ts:887). Sec 15 cash path is dead.
4. **No authorized cashier-confirm path** — storefront CASH orders stay PENDING_PAYMENT with no staff screen to confirm payment; the only routes to PAID are the two unauthenticated bypasses above.

## 5. Missing Functionality
- Promotion management end-to-end (admin CRUD, server validation, single-promo application, `promoCode`/`promoDiscount`/`promotionId` on Order) — schema exists, runtime absent (Sec 3.4, 14; RNBR 11–12).
- Cashier payment-confirmation operation (Sec 15 steps 5–7, 17).
- Ingredient-availability gating of ingredient-linked options (Sec 7, 10; RNBR 9).
- Base-milk hiding / enabled-alternative-only presentation / no-Milk-group suppression (Sec 9.3).
- `systemKey` protection in adminService + routes (Sec 9.1, 9.2).
- Admin order monitoring + unpaid/paid distinction (Sec 22) and admin promotion/order views (Sec 3.4).
- Server-side availability-reason accuracy (`availabilityReason` hardcoded `"MANUAL_UNAVAILABLE"`).
- Rate limiting on login, constant-time PIN, logout jti revocation, `middleware.ts` (edge) protection for `/admin`,`/pos`,`/kds`.

## 6. Obsolete / Conflicting Implementation
- **CartPage hardcoded promos** (`COFFEE10/WELCOME10/SAVE10/CAFE20/SAVE20` + catch-all 5%, CartPage.tsx:29–57) — applied visually, **discarded** at checkout (CheckoutPage.tsx:21,69); system effectively charges full price → misleading totals.
- **Static `PRODUCTS` fallbacks** (server.ts:299–310, 362–370) can serve stale in-source data when DB empty — obsolete mock behavior.
- **`PAYMONGO_SIMULATION_ENABLED` notifications**: QR-generation gating correct; simulate endpoints inconsistent with it.
- **`/api/auth/session` returns role `"admin"`** for all roles (server.ts:236) — masks pos/kds roles.
- **`if (!secretKey) return true`** in `verifySignature` (server.ts:1110) — dead-in-practice (only reached when secret set) but confusingly permissive.

## 7. Order Lifecycle Audit
Overall **COMPLIANT** for the canonical machine. `errors.ts:62–68` transition table = exactly `PENDING_PAYMENT→PAID`, `PAID→PREPARING`, `PREPARING→READY`, `READY→COMPLETED` (+ documented `COMPLETED→READY` reopen). `isAllowedTransition` allows idempotent self-transitions. `updateOrderStatus` rejects illegal transitions (409) and stamps `paidAt` idempotently. `recordPayment` is advance-only (late webhooks never move backwards) and always persists payment identifiers. Order numbers serialized via `pg_advisory_xact_lock` with P2002 retry; `/api/orders` enforces an `Idempotency-Key` (in-memory). **Exposure:** status PATCH unauthenticated (§4#2). **Bug:** route converts 409 → 500.

## 8. Customer/POS Audit
- **Customer:** Cart→Checkout; Pay Online (QRPH, default) vs Cash at counter; payload omits client total (good), sends `discount:0`, **no promoCode field**; QRPH → QR + `order_paid`/polling receipt page; cash → PENDING_PAYMENT (two-stage stored correctly).
- **POS:** walk-in CASH default, charge button with client-side tendered check (PosPage.tsx:184–187). `customizations` always `{}` — **POS adds products with no customization UI** (PosPage.tsx:99–127), so walk-in drinks cannot apply sugar/ice/milk/addons. **Cash charge broken** (§4#3). Recent-orders modal shows PENDING_PAYMENT (acceptable for staff).

## 9. Catalog & Customization Audit
Server authorization for options is strong (existence, archived, active, group-linked, allowlist — orderService.ts:282–326). **Gaps:** ingredient availability not consulted (Sec 10); base-milk not hidden (isBase unused); milk selector not suppressed when product has no milk group (legacy `hasGroup` path; ItemCustomizationPage.tsx:215–220 vs authoritative render 405–453); surcharge not surfaced to clients (§10); disabled options still present in public catalog output.

## 10. Pricing & Promotion Audit
**Pricing:** server authoritative, recomputed; PCO.surcharge override applied server-side (orderService.ts:311–314). **Promotion:** entirely unimplemented server-side; the only "discount" is client-side and dropped. Steps orderService creates no promo fields. Stored `promoCode`/`promoDiscount`/`promotionId` columns exist but are never written → snapshots lack promotion values (Sec 14, 21 partial).

## 11. Payment / PayMongo / F11-A Audit
- A1 (QR): COMPLIANT — no silent fallback; explicit `PayMongoNotConfiguredError`; live failure throws. **A1 (simulate webhook): CONTRADICTS** — ungated.
- A2: COMPLIANT — DB-unique, duplicates rejected.
- A3: COMPLIANT — fail-closed; `PAYMONGO_ALLOW_UNSIGNED_WEBHOOKS_DEV==="true"` only in non-production; production always rejects unsigned.
- Webhook handler advances to PAID and broadcasts `order_paid`; matched by `paymentIntentId` or order id; duplicate/repeated events are idempotent-safe (`PAID→PAID` allowed).
- Missing: amount verification against the intent at webhook time (webhook trusts that the event belongs to the order; it stores the intent but does not re-check the paid amount == order.totalAmount).

## 12. KDS Audit
**COMPLIANT.** Loads `/api/orders?excludeStatus=PENDING_PAYMENT` + client-side re-filter + realtime gate (`if order.status==="PENDING_PAYMENT" return`). Buttons only for kitchen transitions (Start Brewing→PREPARING, Ready, Complete, Reopen). No payment controls; shows snapshot data from DTO. Remaining risk is only the upstream identity of order_paid events (bypassable via §4 backdoors).

## 13. Realtime Audit
- Server gate: PENDING_PAYMENT orders never emit `order_created` (server.ts:961).
- **But** `/api/realtime/stream` and Supabase `kitchen-orders` are unauthenticated, broadcast full order objects to every listener; anon Supabase key can publish to/read `kitchen-orders`. Realtime is not an authorization mechanism (doc §20 agrees), but the full-object fan-out leaks other customers' order details to any connected client (tracking page), and anyone can replay/inject events.

## 14. Admin Audit
- CRUD present: products, ingredients, categories, customization groups/options (all `/api/admin/*`, guarded by admin_session cookie).
- **Missing:** promotions management, order monitoring (unpaid vs paid), system-key protection, reports/system settings. Availability recomputation IS correctly invoked on product PATCH and ingredient update/archive (inventoryService.ts:198–213; catalogService.ts:465).

## 15. Database / Prisma / Migration Audit
**COMPLIANT.** Schema covers lifecycle enum, `paidAt`, `paymentIntentId @unique`, `SystemKey @unique`, `ProductCustomizationOption.surcharge`, `ProductIngredient.isBase`, `ProductIngredient`/PCG/PCO joins, `OrderItemModifier` snapshots, Promotion tables. 3 migrations in expected order (smoke STEP 12 verifies). `promotions`/`promotion_products` tables exist but are dead data.

## 16. Security / Authorization Audit
- Unauthenticated: `/api/orders` (full list incl. PENDING_PAYMENT + customer names), `/api/orders/:idOrNumber`, `PATCH /api/orders/:id/status`, simulate endpoints, `/api/realtime/stream`, public `/api/products|/api/catalog` (leak `isAvailable`/`manualAvailability`/`isActive`/`isArchived` internals + disabled options).
- Auth flaws: no `middleware.ts` (edge routing for /admin /pos /kds inert — only `expressAdminAuthMiddleware` guards `/api/admin`); login unratelimited (rateLimit.ts is dead code); PIN compared with `===` (auth.ts:129); logout never revokes jti; session endpoint hardcodes role `admin`.
- Positive: signed HMAC tokens, timing-safe signature verify, 24h expiry, fail-closed secret handling.

## 17. Tests / Validation Coverage
Smoke suite (13 steps) passes 0 errors and covers: auth, catalog wiring, availability propagation, **tampered-price authority (STEP 5)**, snapshot immutability (STEP 6), lifecycle (STEP 7), recordPayment + paidAt (STEP 8), order-number concurrency (STEP 9), error handling (STEP 10), residue cleanup (STEP 11), schema/migrations (STEP 12), F11-A (STEP 11g). `tsc --noEmit` clean.
**NOT covered:** promotions, PCO.surcharge (STEP 5 uses priceModifier), isBase / base-milk hiding, systemKey protection, ingredient-level gating, `excludeStatus` parameter, cash→PAID cashier path, POS cash, simulate-endpoint gating, admin order monitoring.

## 18. Recommended Implementation Order
1. **P0 Payment/security harden** (guardrail 8,10): gate simulate endpoints behind auth + `PAYMONGO_SIMULATION_ENABLED==="true"` (or remove in prod); remove customer simulate button; protect orders/status routes with staff role; forbid `PAID` via generic status PATCH (require dedicated cash-confirm/webhook path); fix 409 mapping.
2. **P1 Cashier confirmation** (Sec 15): implement an authenticated cash-confirm operation (e.g. send `cashTendered` from POS + keep server re-verification, or a POST `/api/orders/:id/pay` using `recordPayment`); add POS customization entries.
3. **P2 Promotions** (Sec 14 / RNBR 11–12): server validate/apply/store promo on Order; admin promo CRUD + UI; wire CartPage→checkout; drop hardcoded client promos.
4. **P3 Catalog/customization** (Sec 7,9,10 / RNBR 5–9): serve authoritative surcharge + hide base milk + suppress empty milk group + ingredient-availability gating of options + systemKey admin protection.
5. **P4 Admin + auth**: admin order monitoring (unpaid vs paid), login rate-limit + constant-time PIN + jti revoke + real `middleware.ts`.
6. **P5 Tests**: add coverage for the P0–P4 gaps in §17.
7. **P6 Cleanup**: remove static catalog fallbacks, dead rateLimit wiring during P4.

## 19. Items Requiring Business Approval
1. Keep or remove the PayMongo simulate webhook endpoints + customer "Simulate Payment" button (recommend: dev-only behind flag; never in production).
2. Whether generic `PATCH /api/orders/:id/status` may ever set `PAID` (recommend: no — dedicated cash-confirm endpoint instead).
3. Promotion scope: confirm single-promo-per-order and the eligible-product model before building admin promo UI.
4. Accept restoring POS `cashTendered` into the payload (cashier must tender ≥ total) vs. converting to a cashier-confirm flow.
5. Expose authoritative per-product surcharge to customer clients (display may then match charged price).
6. Whether staff order/monitoring APIs should require login in the deployed env (recommend yes).
7. Admin order-monitoring screen scope (list/filter only, or KDS-style board as well).

## 20. Final Audit Verdict

**NOT COMPLIANT as currently deployed against the authoritative workflow.**

- **Compliant foundations:** canonical lifecycle machine, server-authoritative pricing + snapshot persistence, QR-payment fail-closed behavior, DB-unique payment intents, KDS gating, DEV/MOCK catalog separation, migration integrity.
- **Blocking defects (do not ship without fix):** unauthenticated simulate-payment backdoor that marks orders PAID; unauthenticated status PATCH with mark-as-paid capability; broken POS cash path; absent cashier-confirmation operation.
- **Missing scope:** promotions end-to-end, milk/base-option rules, ingredient-availability gating, system-key protection, admin order monitoring.
- **Recommended next step:** present §18 priorities (P0 first) and §19 approvals to the owner; then implement per the doc's `WORKFLOW → AUDIT → GAP LIST → APPROVAL → BUILD → VALIDATION → REPORT` process. Do not begin a broad rewrite.