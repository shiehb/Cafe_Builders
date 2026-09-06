# Cafe_Builders — Current Authoritative Business Workflow

Version: 1.0
Date: 2026-09-06
Status: AUTHORITATIVE BUSINESS WORKFLOW

## 1. Purpose and Authority

This document defines the current approved business workflow for Cafe_Builders.
It is the source of truth for future implementation decisions unless a newer approved workflow explicitly replaces it.

Do not infer business behavior from obsolete implementation plans, old audit notes, stale mock flows, or existing code when they conflict with this document.

The system should be implemented around the approved business workflow first, then the technical implementation should conform to it.

---

## 2. System Scope

Cafe_Builders is a cafe ordering, POS, payment, kitchen display, catalog, promotion, and administration system.

Primary areas:

- Customer ordering
- POS / walk-in ordering
- Cart and checkout
- Cashier payment collection
- Online payment through PayMongo
- Product customization
- Server-side pricing
- Promotion validation
- Order lifecycle management
- Kitchen Display System (KDS)
- Admin catalog management
- Admin customization management
- Admin promotion management
- Admin order monitoring
- Realtime order updates

Cancellation and refund workflows are explicitly OUT OF SCOPE for the current implementation unless separately approved later.

---

## 3. Actors and Responsibilities

### 3.1 Customer

The customer can:

- Browse available products
- Select products
- Select allowed customizations
- Adjust quantities
- View cart totals
- Apply eligible promotion codes
- Choose Pay Online or Pay at Cashier
- Submit an order
- Receive order status updates

The customer must never control authoritative pricing or payment state.

### 3.2 POS / Cashier

The POS supports walk-in ordering and cashier operations.

The cashier can:

- Create walk-in orders
- Add products and customizations
- Review the calculated order total
- Select payment method
- Collect cash for Pay-at-Cashier orders
- Confirm payment
- Cause the order to enter PAID state
- Monitor relevant orders

The cashier must not bypass the central order lifecycle.

### 3.3 Kitchen / KDS

The KDS is kitchen-only.

The KDS:

- Receives paid orders
- Shows finalized order/customization snapshots
- Does not handle payment
- Does not validate promotions
- Does not manage catalog data
- Does not calculate authoritative customer pricing
- Does not show PENDING_PAYMENT orders

KDS workflow is:

NEW -> PREPARING -> READY -> COMPLETED

NEW is a UI queue concept. It does not require a separate database OrderStatus. A PAID order that has not yet started preparation represents the NEW queue state.

### 3.4 Admin

Admin is the management layer of the system.

Admin responsibilities include:

- Dashboard / monitoring
- Product management
- Category management
- Ingredient management
- Customization group management
- Customization option management
- Product customization configuration
- Promotion management
- Order monitoring
- KDS / operational monitoring where applicable
- Reports / operational views
- System settings

Admin configuration controls what can be ordered, but existing completed orders must retain their finalized historical snapshots.

---

## 4. Master Business Flow

ADMIN CONFIGURATION
        |
        v
CATALOG + CUSTOMIZATION + PROMOTIONS
        |
        v
CUSTOMER / POS BROWSE
        |
        v
SELECT PRODUCT
        |
        v
SELECT ALLOWED CUSTOMIZATIONS
        |
        v
CART
        |
        v
CHECKOUT
        |
        +----------------------------+
        |                            |
        v                            v
PAY AT CASHIER                  PAY ONLINE
        |                            |
        v                            v
PENDING_PAYMENT              PAYMENT INTENT / PAYMONGO
        |                            |
        |                       successful payment
        |                            |
        +-------------+--------------+
                      |
                      v
                    PAID
                      |
                      v
                 KDS / NEW QUEUE
                      |
                      v
                  PREPARING
                      |
                      v
                    READY
                      |
                      v
                  COMPLETED

Admin can monitor the order lifecycle throughout the applicable stages.

---

## 5. Canonical Order Lifecycle

The canonical database lifecycle is:

PENDING_PAYMENT -> PAID -> PREPARING -> READY -> COMPLETED

Important rule:

PENDING_PAYMENT MUST NOT transition directly to PREPARING.

Only PAID orders may enter the kitchen workflow.

Payment completion is the gate between PENDING_PAYMENT and PAID.

---

## 6. Customer / POS Ordering Flow

1. User opens the ordering/POS interface.
2. Available categories and products are displayed.
3. User selects a product.
4. System displays the product's allowed customizations.
5. User selects valid customization values.
6. User sets quantity.
7. Product is added to cart.
8. Cart displays the current calculated subtotal and applicable promotion information.
9. User proceeds to checkout.
10. Server validates the submitted product/customization configuration.
11. Server calculates authoritative pricing.
12. Server validates any promotion code.
13. Server creates the order using the approved payment workflow.

Client-side totals are informational only. The server is authoritative.

---

## 7. Catalog Rules

The catalog consists of:

- Categories
- Products
- Ingredients
- Customization groups
- Customization options
- Product-to-ingredient relationships
- Product-to-customization-group relationships
- Product-to-customization-option relationships

Products can have base ingredients and optional/customizable ingredients.

Product availability must control whether a product can be ordered.

Ingredient availability must control whether customer-selectable ingredient-based options can be selected.

The current catalog created during Step 8 is DEV/MOCK data only. It is NOT authoritative production catalog data.

The Step 7 catalog-source discovery result remains NOT_FOUND.

---

## 8. Product Ingredient Rules

`ProductIngredient.isBase` identifies base ingredients.

Base ingredients define the normal product composition.

Ingredient records should not be used as a hidden substitute for product-specific customization pricing.

Historical orders must retain their finalized ingredient/customization information even if the current catalog changes later.

---

## 9. Customization Rules

### 9.1 Sugar

Sugar is a system-defined ordering preference.

Rules:

- Sugar uses a system-defined customization group.
- The customer may select the allowed sugar option.
- Sugar has no surcharge.
- Admin cannot create arbitrary additional sugar system options through normal catalog management.
- Sugar is an ordering preference, not an ingredient substitution.

### 9.2 Ice

Ice is a system-defined ordering preference.

Rules:

- Ice uses a system-defined customization group.
- The customer may select the allowed ice option.
- Ice has no surcharge.
- Admin cannot create arbitrary additional ice system options through normal catalog management.
- Ice is an ordering preference, not an ingredient substitution.

### 9.3 Milk

Milk is handled differently from sugar and ice.

Rules:

- The base milk is an ingredient in the product recipe.
- Alternative milk choices are enabled per product.
- Each enabled alternative can have a product-specific surcharge.
- The base milk should be hidden as a selectable alternative when it is already the product's base ingredient.
- Disabled alternatives must not appear to customers.
- If the product has no milk customization, the Milk selector must not be shown.
- Milk alternatives are ingredient substitutions and must be modeled accordingly.

### 9.4 Add-ons

Add-ons are selectable optional items.

Rules:

- Add-ons use MULTIPLE selection behavior.
- Add-on surcharge is product-specific.
- Surcharge is NOT stored on the Ingredient as the authoritative product-specific price.
- Product-specific surcharge is represented through the product-option relationship.

---

## 10. Customization Availability

`Ingredient.isAvailable = false` must prevent the related customer-facing ingredient selection from being offered.

Disabled product customization options must not be selectable.

The server must validate customization selections even if the client UI attempts to submit invalid or stale options.

---

## 11. Effective Customization Surcharge Rule

For a product customization option:

1. If a ProductCustomizationOption row exists, use its product-specific surcharge.
2. Otherwise, use the underlying CustomizationOption.priceModifier.

The product-specific surcharge takes precedence.

This rule must be applied consistently by server-side pricing and order creation.

---

## 12. Pricing Rules

Pricing is authoritative on the server.

The server must calculate:

- Product base price
- Customization surcharges
- Quantity extensions
- Subtotal
- Promotion discount
- Final total

The client must not be trusted to submit a final price.

A submitted order must be recalculated from authoritative catalog data before persistence.

---

## 13. Cart and Checkout

The cart may be managed client-side for user experience, but checkout must revalidate everything server-side.

At checkout, the server must verify:

- Product exists
- Product is available
- Requested quantity is valid
- Customization group is valid for the product
- Selected customization option is valid for the product/group
- Selected ingredient-based option is still available
- Surcharge is calculated from authoritative data
- Promotion is valid
- Final total is calculated server-side

The persisted order must contain finalized historical pricing and customization information.

---

## 14. Promotions

The system supports promotions with:

- Percentage discounts
- Fixed discounts
- Promotion/product eligibility relationships
- Promotion codes

A promotion may apply to eligible products according to the promotion configuration.

Only one promotion is applied to an order under the current approved scope.

Promotion validation and discount calculation are server-side.

No promotion data is currently seeded in the DEV/MOCK catalog.

The order stores promotion-related historical values such as:

- promoCode
- promoDiscount
- promotionId when applicable

The stored order values must preserve what was actually applied at purchase time.

---

## 15. Pay at Cashier Flow

Pay at Cashier is an intentional two-stage process.

1. Customer/POS creates the order.
2. Order is stored as PENDING_PAYMENT.
3. Order is NOT sent to KDS.
4. Cashier receives/locates the pending order.
5. Cashier collects payment.
6. Cashier confirms successful payment.
7. Order transitions to PAID.
8. `paidAt` is stamped when entering PAID.
9. The paid order becomes visible to KDS.
10. KDS processes the order.

There is no separate "Mark as Paid" shortcut that bypasses the approved cashier/payment operation.

---

## 16. Pay Online / PayMongo Flow

Pay Online uses PayMongo payment processing.

The order must not become PAID merely because a payment request was initiated.

The order becomes PAID only after the approved successful payment confirmation path.

### F11-A Payment Integrity Rules

The following rules are mandatory:

A1 — No silent simulated PayMongo fallback.

- Production/payment behavior must fail explicitly if real PayMongo processing is unavailable.
- Simulation is allowed only when `PAYMONGO_SIMULATION_ENABLED` explicitly enables it.
- Simulation must never silently replace a failed real payment integration.

A2 — Unique payment intent.

- `Order.paymentIntentId` is nullable.
- When present, it must be database-unique.
- Duplicate payment intent IDs must be rejected by the database.

A3 — Fail-closed webhook secret policy.

- Webhook verification must fail closed.
- Unsigned webhook handling requires an explicit development override.
- The default unsigned behavior is OFF.
- Production must always reject unsigned webhook requests.

Successful online payment follows:

PAYMENT INITIATED
        |
        v
PAYMONGO PAYMENT
        |
        v
SUCCESSFUL PAYMENT CONFIRMATION
        |
        v
PAID
        |
        v
KDS

---

## 17. Payment State Rules

The following are mandatory:

- Cash payment can move the order from PENDING_PAYMENT to PAID.
- Successful online payment can move the order from PENDING_PAYMENT to PAID.
- `paidAt` is stamped when the order enters PAID.
- PENDING_PAYMENT must never be visible in KDS.
- PENDING_PAYMENT must never transition directly to PREPARING.
- Payment completion must be idempotent where applicable.
- Duplicate payment intent identifiers must not create multiple authoritative payment states.

Cancellation and refund behavior remains outside the current scope.

---

## 18. KDS Workflow

The KDS is a kitchen execution interface.

Only paid orders enter the KDS.

KDS queue concept:

PAID / NEW
   |
   v
PREPARING
   |
   v
READY
   |
   v
COMPLETED

The KDS should present:

- Order identifier
- Products
- Quantities
- Finalized customizations
- Relevant order details required for preparation

The KDS must use the order's finalized snapshot, not the current catalog state.

If a product's current customization configuration changes after an order is placed, that must not rewrite what the kitchen sees for the historical order.

---

## 19. KDS Visibility Rule

KDS must exclude:

PENDING_PAYMENT

KDS should receive/order-display only orders that are PAID or already in the kitchen workflow.

The approved API behavior includes support for:

GET /api/orders?excludeStatus=PENDING_PAYMENT

Realtime order-created events must not broadcast newly created PENDING_PAYMENT orders to the KDS as kitchen work.

---

## 20. Realtime Behavior

Realtime updates are intended to keep operational screens synchronized.

Important rule:

An `order_created` event for kitchen workflow must not expose a newly created PENDING_PAYMENT order as kitchen work.

When an order becomes PAID, it may enter the KDS queue and realtime operational views.

Realtime is a delivery mechanism; it does not replace server-side authorization or state validation.

---

## 21. Historical Order Snapshots

Orders must preserve the state of the transaction at purchase time.

The historical order must not depend on the current catalog configuration to reconstruct what the customer bought.

Snapshots should preserve finalized information such as:

- Product name
- Product price used
- Selected customization names/values
- Applied customization surcharge
- Quantity
- Promotion information
- Discount amount
- Final totals
- Relevant payment information/state

Changing an ingredient, product price, customization option, surcharge, or promotion later must not retroactively alter completed/historical orders.

---

## 22. Admin Monitoring

Admin should be able to monitor the operational state of the system.

Relevant order states include:

- PENDING_PAYMENT
- PAID
- PREPARING
- READY
- COMPLETED

Admin views should clearly distinguish unpaid orders from paid/kitchen orders.

Admin management screens must not create alternative business rules that conflict with the central order lifecycle.

---

## 23. Responsibility Boundaries

### Customer/POS owns

- Product browsing
- Selection
- Customization input
- Cart interaction
- Checkout initiation
- Payment-method selection

### Server owns

- Validation
- Pricing
- Promotion validation
- Order creation
- Payment state transitions
- Payment verification
- Historical snapshots
- Authorization

### Cashier owns

- Cash collection
- Confirmation of cashier payment

### KDS owns

- Kitchen queue
- Preparation status
- Ready/completed workflow

### Admin owns

- Catalog configuration
- Customization configuration
- Promotion configuration
- Operational monitoring
- Administrative management

No layer should silently take over another layer's business responsibility.

---

## 24. Current DEV/MOCK Catalog Status

The currently seeded catalog is temporary development data.

Current validated DEV/MOCK counts:

- Categories: 4 real database categories
- Ingredients: 41
- Customization groups: 4
- Canonical customization options: 20
- Products: 19
- Product-ingredient joins: 59
- Product-group joins: 38
- Product-option joins: 112
- Orders: 0 after smoke-test cleanup
- Promotions: 0

The UI may display an "All" category as a UI-only pseudo-category. It is not required as a database category.

The DEV/MOCK catalog must not be presented as authoritative production cafe data.

---

## 25. Explicitly Out of Scope

Do NOT implement or expand into these areas without separate approval:

- Cancellation workflow
- Refund workflow
- Complex refund accounting
- Advanced inventory depletion
- Supplier/procurement management
- Loyalty program
- Multi-store operations
- Delivery logistics
- Accounting integration
- Production catalog import unless separately approved
- Additional payment providers unless separately approved
- New business workflows not defined here

---

## 26. Implementation Guardrails

Before changing code:

1. Compare the existing implementation against this workflow.
2. Identify violations, missing pieces, and obsolete behavior.
3. Do not rewrite unrelated working functionality merely for style.
4. Do not invent business requirements.
5. Do not create a new workflow state without approval.
6. Preserve database integrity and migration history.
7. Preserve historical order data.
8. Keep payment security fail-closed.
9. Keep server-side pricing authoritative.
10. Keep KDS payment-gated.
11. Keep customization rules explicit and product-aware.
12. Keep DEV/MOCK catalog clearly separated from authoritative production data.

Any implementation task should state:

- What workflow rule it implements
- What current behavior violates that rule
- What files will change
- How it will be validated
- What is explicitly not being changed

---

## 27. Master Acceptance Flow

The implementation is correct only if this complete scenario works:

1. Admin configures an available product.
2. Product has valid base ingredients.
3. Product exposes only its enabled customization groups/options.
4. Customer selects the product.
5. Customer selects valid sugar/ice preferences when applicable.
6. Customer selects valid milk alternative when applicable.
7. Customer selects add-ons when applicable.
8. Product-specific customization surcharges are applied correctly.
9. Customer adds the product to cart.
10. Customer applies a valid promotion if one exists.
11. Server recalculates the authoritative price.
12. Customer chooses Pay at Cashier OR Pay Online.
13. Pay at Cashier creates PENDING_PAYMENT.
14. PENDING_PAYMENT is not visible in KDS.
15. Cashier collects payment.
16. Cashier confirmation changes the order to PAID and stamps paidAt.
17. PAID order becomes visible to KDS.
18. KDS shows the finalized historical customization snapshot.
19. KDS moves the order through PREPARING -> READY -> COMPLETED.
20. Historical order data remains unchanged even if the catalog is edited later.

For Pay Online:

1. Customer chooses Pay Online.
2. Payment processing uses the real PayMongo path unless explicit development simulation is enabled.
3. No silent simulated fallback occurs.
4. Webhook/payment confirmation is verified according to the fail-closed secret policy.
5. Successful payment changes the order to PAID.
6. paidAt is stamped.
7. PAID order enters KDS.

---

## 28. Non-Negotiable Business Rules

1. PENDING_PAYMENT cannot go directly to PREPARING.
2. KDS must never show PENDING_PAYMENT.
3. Only paid orders enter kitchen execution.
4. Server-side pricing is authoritative.
5. Product-specific customization surcharge overrides the generic option modifier when configured.
6. Sugar and ice are system-defined ordering preferences.
7. Milk is a base ingredient plus product-specific alternative substitutions.
8. Add-ons are multiple-select and use product-specific surcharge.
9. Disabled products/options/ingredients must not be selectable.
10. Orders preserve historical snapshots.
11. Promotions are validated server-side.
12. Only one promotion applies to an order in the current scope.
13. Pay-at-Cashier orders remain pending until cashier payment confirmation.
14. PayMongo simulation must be explicitly enabled.
15. PayMongo failures must not silently fall back to simulation.
16. Webhook verification is fail-closed.
17. Production rejects unsigned webhook requests.
18. paymentIntentId is nullable but unique when present.
19. Realtime must not turn unpaid orders into kitchen work.
20. Cancellation and refund workflows are not part of the current scope.
21. The current seeded catalog is DEV/MOCK, not authoritative production catalog data.
22. Do not invent a new implementation step merely because an old plan contains one.

---

## 29. Reference Status

This document replaces conflicting old workflow/implementation assumptions.

Recommended repository filename:

Cafe_Builders_Current_Authoritative_Business_Workflow.md

Recommended next implementation process:

BUSINESS WORKFLOW -> CODE AUDIT -> GAP LIST -> APPROVAL -> BUILD -> VALIDATION -> REPORT

Do not begin a broad rewrite until the code audit against this document has been completed and the gaps are explicitly identified.
