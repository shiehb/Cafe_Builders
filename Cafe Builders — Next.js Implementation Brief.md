# Cafe Builders — Next.js Implementation Brief

## Role

Act as a senior full-stack Next.js engineer. Update the existing Cafe Builders project to deliver a reliable, fast, desktop/tablet-friendly cafe operation system for **Customer Storefront**, **Cashier POS**, **Kitchen KDS**, and **Manager Admin**.

The project has already been converted from Vite to **Next.js App Router**. Do not reintroduce Vite. Inspect the existing repository before changing files, preserve working functionality, and run validation after every major change.

## Main objective

Create one canonical catalog and order workflow shared by Customer, POS, KDS, and Admin:

```text
Admin configures catalog and availability
        ↓
Canonical catalog and availability API
        ↓
Customer or Cashier creates an order
        ↓
Server validates product, options, inventory, and price
        ↓
Payment is confirmed
        ↓
KDS receives the exact paid order snapshot
        ↓
KDS: Preparing → Ready → Completed
        ↓
Customer, POS, and Admin receive synchronized status updates
```

## Critical constraints

1. **Do not change the Customer Storefront layout or customer journey.** Preserve the existing browse, category, product detail, customization, cart, and checkout sequence.
2. Improve Customer behavior only where needed for availability, customization correctness, cart editing, pricing, and checkout safety.
3. **Do not use Vite.** Use Next.js App Router and the existing custom server only if it is still needed for the API.
4. Do not add Hot/Iced temperature options. Temperature must be fully removed from UI, types, seed data, API payloads, database schema, and validation.
5. Do not use emoji in category names, customization groups, option labels, section titles, or staff navigation.
6. Use Philippine peso formatting such as `₱25.00`.
7. Keep changes compatible with the existing repository architecture instead of replacing working screens unnecessarily.

### Important current-state correction

The current Admin screen still uses the **original Admin layout**; only its colors/theme have been updated. This is not the desired final result. The implementation must replace the original Admin layout and navigation structure with the new five-page Admin workspace described below. Do not stop after applying CSS colors or wrapping the old page in a new theme.

Required Admin replacement:

- Remove the original single-page Admin content and old navigation pattern.
- Create a fixed vertical left sidebar on desktop.
- Create a collapsible sidebar/drawer for tablet widths.
- Add exactly five primary Admin navigation items:
  1. Dashboard
  2. Menu & Products
  3. Inventory & Ingredients
  4. Categories & Customizations
  5. Terminal Passcodes & URLs
- Render a distinct page view for each navigation item.
- Keep the selected navigation item visibly active.
- Preserve the selected Admin page while updating data or navigating within the Admin workspace.
- Do not use emoji icons; use a consistent icon library or text labels.
- Keep the Customer Storefront layout unchanged.

### Device targets and responsive behavior

Design each role for its real operating device:

| Role | Primary devices | Required approach |
|---|---|---|
| Customer Storefront | Mobile phones | Mobile-first, single-column, existing customer layout and journey preserved |
| Cashier POS | Tablets and desktop computers | Touch-first tablet workflow with an expanded two-pane desktop layout |
| Kitchen KDS | Tablets and desktop monitors | Large, glanceable ticket board for standing staff |
| Manager Admin | Tablets and desktop computers | Responsive management workspace with touch-friendly controls |

The Customer Storefront is mobile-only in design priority. Do not introduce desktop tables, a staff sidebar, or dense multi-column checkout into the Customer experience. Preserve its current browse, product, customization, cart, and checkout sequence.

POS, KDS, and Admin are tablet/desktop applications. They may use wider panels, sidebars, tables, split views, and operational dashboards. Do not shrink staff controls into tiny mobile cards.

Responsive requirements:

- Customer mobile: single-column content, full-width product cards, compact sticky categories, bottom navigation, and full-width customization/cart actions.
- POS tablet portrait: product grid with a ticket drawer and persistent item count/total.
- POS tablet landscape: product grid and ticket panel visible together when space permits.
- POS desktop: product grid on the left and fixed ticket/payment panel on the right.
- KDS tablet: three or four horizontally scrollable status columns with sticky headers and large ticket actions.
- KDS desktop: four visible status columns whenever the viewport permits.
- Admin tablet: collapsible navigation drawer plus stacked management panels.
- Admin desktop: fixed vertical sidebar plus wide tables and two-column forms.

Use touch targets of at least 44 pixels for frequent POS, KDS, and Admin actions. Keep the visual theme aligned across roles with the Customer Storefront: light background, white surfaces, emerald primary actions, dark readable text, subtle borders, rounded cards, and restrained shadows.

## Next.js requirements

Expected structure:

```text
app/
  layout.tsx
  page.tsx
next.config.ts
server.ts                 # Existing API server if retained
src/
  App.tsx
  screens/                 # Customer, POS, KDS, and Admin screens
  components/
  context/
  data/
  lib/
  types/
```

The project must use these scripts:

```json
{
  "dev": "tsx server.ts",
  "build": "next build",
  "start": "NODE_ENV=production tsx server.ts",
  "lint": "tsc --noEmit"
}
```

Do not add `vite.config.ts`, Vite middleware, `import.meta.env`, `VITE_*` variables, or a Vite HTML entry point. Use `process.env` on the server and `NEXT_PUBLIC_*` only for values that must be exposed to browser code.

## Database model

Implement or migrate to these entities.

### Products

- `id`
- `name`
- `description`
- `productType`: `BEVERAGE` or `FOOD`
- `basePrice`
- `imageUrl`
- `isActive`
- `manualAvailability`
- computed `isAvailable`
- `popular`
- `sortOrder`
- timestamps

Do not store temperature fields.

### Categories

- `id`
- `name`
- `productType`
- `isActive`
- `sortOrder`
- timestamps

Products must support multiple categories through `product_categories`.

Example: Iced Americano can belong to both `Iced Coffee` and `Espresso Classics`.

### Ingredients

- `id`
- `name`
- `isAvailable`
- timestamps

Use explicit relationships:

- `product_ingredients(productId, ingredientId, required)`
- `option_ingredients(optionId, ingredientId, required)`

Do not use product-name matching as the final availability mechanism.

### Customization groups

Master groups:

- `Ice Level`
- `Sugar Level`
- `Milk Choices`
- `Add-ons`

Each group contains:

- `id`
- `name`
- `selectionMode`: `SINGLE` or `MULTIPLE`
- `isActive`
- `sortOrder`

Required option labels:

| Group | Options |
|---|---|
| Ice Level | Less, Regular, Extra |
| Sugar Level | Less Sweet, Regular, More Sweet |
| Milk Choices | Whole Milk, Oat Milk, Almond Milk, Soy Milk |
| Add-ons | Extra Shot, Coffee Jelly, Vanilla Syrup |

There must be no `No Ice` option unless specifically approved later. There must be no Temperature group.

### Customization options

Each option must contain:

- `id`
- `groupId`
- `name`
- `priceModifier`
- `isActive`
- `sortOrder`

Use a product-group join table:

```text
product_customization_groups(productId, groupId, isRequired, sortOrder)
```

Use a product-option join table:

```text
product_customization_options(productId, optionId, isAvailable)
```

A product may use a master group while allowing only selected options.

Example:

```text
Iced Americano
  Groups: Ice Level, Sugar Level, Add-ons
  Allowed Add-ons: Extra Shot, Coffee Jelly
  Not allowed: Vanilla Syrup
```

Unchecked groups and unallowed options must remain hidden on the Customer and POS customization screens.

## Availability rules

```text
product.isAvailable =
  product.isActive
  AND product.manualAvailability
  AND every required linked ingredient is available
```

```text
option.isAvailable =
  option.isActive
  AND option.productAssignmentIsActive
  AND every required linked ingredient is available
```

When an ingredient is turned off in Admin:

1. Recompute all linked products.
2. Recompute all linked add-ons/options.
3. Mark affected products Sold Out.
4. Disable affected options.
5. Return the affected IDs in the API response.
6. Broadcast realtime product/option updates.
7. Prevent stale Customer carts and POS tickets from being charged.

The UI must show the reason when possible, for example:

```text
Sold Out — Oat Milk unavailable
```

## POS requirements

Use a two-pane desktop/tablet layout:

- Left: search, category tabs, and product grid.
- Right: fixed current ticket on desktop and tablet landscape.
- Tablet portrait: product grid with a ticket drawer and persistent ticket count.

POS behavior:

1. Search by product name and category.
2. Use large touch-friendly product cards.
3. Show available products first.
4. Show Sold Out products at the end with disabled controls.
5. Add simple products immediately.
6. Open a compact customization drawer only when the product has enabled groups.
7. Keep quantity controls visible: minus, quantity, plus.
8. Keep total and payment controls visible at the bottom.
9. Support Cash and QR Ph.
10. Prevent duplicate submission using an idempotency key.
11. Revalidate availability and prices immediately before charging.
12. After successful payment, send the order to KDS.

Suggested POS order flow:

```text
Select product
  → Select only product-specific options
  → Add to ticket
  → Review ticket
  → Select payment method
  → Validate availability and prices
  → Charge
  → Show order number
  → Send paid order to KDS
```

## KDS requirements

Use a high-contrast light layout matching the Customer Storefront theme:

- Background: `#F7F9FA`
- Cards: `#FFFFFF`
- Primary emerald: `#00A86B`
- Text: `#1F2937`
- Secondary text: `#6B7280`
- Border: `#E5E7EB`

Use four operational columns:

1. New / Paid
2. Preparing
3. Ready
4. Completed

Every ticket must show:

- Large order number
- Elapsed time
- Customer name or Guest
- Order type
- Payment status
- Product name
- Quantity
- Selected customization values
- Add-ons
- Special instructions
- One large next-status button

Recommended status buttons:

- `Start Preparing`
- `Mark Ready`
- `Complete Order`

Do not hide preparation details inside a modal.

Sort active tickets by urgency and received time. Use readable labels as well as color. Show a visible realtime connection status.

QR Ph orders must not enter active preparation until payment is confirmed. Repeated payment callbacks must not create duplicate orders or duplicate KDS tickets.

## Admin requirements

Keep the five-page vertical sidebar:

1. Dashboard
2. Menu & Products
3. Inventory & Ingredients
4. Categories & Customizations
5. Terminal Passcodes & URLs

Admin must be the source of truth for:

- Product type
- Product name and price
- Multiple categories
- Product availability
- Linked ingredients
- Enabled customization groups
- Allowed options and add-ons
- Option price modifiers

Inventory page behavior:

- Toggle an ingredient Available/Unavailable.
- Show affected products and add-ons before or immediately after the update.
- Use explicit relationships, not string matching.
- Show product availability reason.
- Broadcast updates to Customer and POS.

Product form behavior:

- Select `Beverage` or `Food`.
- Select multiple categories.
- Check applicable master customization groups.
- Configure allowed options for Add-ons.
- Link required ingredients.
- Save through the API/database.

## API contracts

### Catalog

```http
GET /api/catalog?availableOnly=true
```

Return products with:

- Product fields
- `categories[]`
- `customizationGroups[]`
- `options[]`
- Availability state and reason

### Create product

```http
POST /api/admin/products
```

```json
{
  "name": "Iced Americano",
  "description": "Double espresso over chilled water",
  "productType": "BEVERAGE",
  "basePrice": 150,
  "categoryIds": ["cat_iced_coffee", "cat_espresso"],
  "ingredientIds": ["ingredient_espresso_beans", "ingredient_water"],
  "customizationGroupIds": ["group_ice", "group_sugar", "group_addons"],
  "allowedOptionIds": [
    "ice_less",
    "ice_regular",
    "ice_extra",
    "sugar_less",
    "sugar_regular",
    "sugar_more",
    "addon_shot",
    "addon_jelly"
  ],
  "isAvailable": true
}
```

### Ingredient availability

```http
PATCH /api/admin/ingredients/:ingredientId
```

```json
{
  "isAvailable": false
}
```

Response:

```json
{
  "success": true,
  "ingredient": {
    "id": "ingredient_oat_milk",
    "name": "Oat Milk",
    "isAvailable": false
  },
  "affectedProducts": ["prod_oat_flat_white"],
  "affectedOptions": ["option_oat_milk"]
}
```

### Create order from Customer or POS

```http
POST /api/orders
Idempotency-Key: unique-client-request-key
```

```json
{
  "source": "POS",
  "customerName": "Walk-in Guest",
  "orderType": "DINE_IN",
  "paymentMethod": "CASH",
  "paymentStatus": "PAID",
  "cashTendered": 600,
  "notes": "Table 8",
  "items": [
    {
      "productId": "prod_iced_americano",
      "quantity": 2,
      "selections": [
        {
          "groupId": "group_ice",
          "optionId": "ice_less"
        },
        {
          "groupId": "group_sugar",
          "optionId": "sugar_regular"
        },
        {
          "groupId": "group_addons",
          "optionId": "addon_shot",
          "quantity": 1
        }
      ],
      "specialInstructions": "Serve separately"
    }
  ]
}
```

The client sends IDs only. The server loads names and prices, validates every relationship, calculates totals, and creates immutable snapshots.

### Order status

```http
PATCH /api/orders/:orderId/status
```

```json
{
  "status": "READY",
  "updatedBy": "kds-terminal-01"
}
```

Valid transitions:

```text
PENDING_PAYMENT → PAID
PAID → PREPARING
PREPARING → READY
READY → COMPLETED
```

Reject invalid transitions.

## Server-side order validation

Before creating an order:

1. Reject an empty cart.
2. Reject duplicate idempotency keys.
3. Load all products from the canonical catalog.
4. Reject missing, inactive, or unavailable products.
5. Validate every selected customization group.
6. Confirm every group is enabled for the product.
7. Confirm every option is allowed for the product.
8. Reject inactive or unavailable options.
9. Enforce required groups and selection modes.
10. Recalculate modifier prices from the database.
11. Recalculate line totals and order totals.
12. Validate cash tendered.
13. Create order, item, and selection snapshots in one transaction.
14. Publish one order event only.

Never trust client-submitted price totals.

## Order snapshot format

Store the following for every order item:

```json
{
  "productId": "prod_iced_americano",
  "productNameSnapshot": "Iced Americano",
  "basePriceSnapshot": 150,
  "quantity": 2,
  "customizationTotal": 60,
  "lineTotal": 360,
  "selections": [
    {
      "groupId": "group_sugar",
      "groupNameSnapshot": "Sugar Level",
      "optionId": "sugar_regular",
      "optionNameSnapshot": "Regular",
      "priceModifierSnapshot": 0
    },
    {
      "groupId": "group_addons",
      "groupNameSnapshot": "Add-ons",
      "optionId": "addon_shot",
      "optionNameSnapshot": "Extra Shot",
      "priceModifierSnapshot": 30
    }
  ],
  "specialInstructions": "Serve separately"
}
```

KDS, POS, Customer receipt, and Admin audit must render this same snapshot.

## Realtime events

Support these events through the project’s existing SSE or Supabase Realtime mechanism:

```json
{
  "type": "product_availability_updated",
  "productId": "prod_oat_flat_white",
  "isAvailable": false,
  "reason": "INGREDIENT_UNAVAILABLE",
  "ingredientId": "ingredient_oat_milk"
}
```

```json
{
  "type": "order_created",
  "orderId": "ord_00031",
  "orderNumber": "C-031",
  "status": "PAID",
  "source": "POS"
}
```

```json
{
  "type": "order_status_updated",
  "orderId": "ord_00031",
  "orderNumber": "C-031",
  "previousStatus": "PREPARING",
  "status": "READY",
  "updatedBy": "kds-terminal-01"
}
```

Customer, POS, KDS, and Admin must refresh relevant state when events arrive.

## Error codes

Use consistent JSON errors:

- `PRODUCT_NOT_FOUND`
- `PRODUCT_UNAVAILABLE`
- `OPTION_NOT_ALLOWED`
- `OPTION_UNAVAILABLE`
- `REQUIRED_CUSTOMIZATION_MISSING`
- `PRICE_CHANGED`
- `CART_REVALIDATION_REQUIRED`
- `INSUFFICIENT_CASH`
- `PAYMENT_PENDING`
- `INVALID_STATUS_TRANSITION`
- `DUPLICATE_REQUEST`

Example:

```json
{
  "success": false,
  "code": "PRODUCT_UNAVAILABLE",
  "message": "Oat Flat White Ristretto is Sold Out because Oat Milk is unavailable.",
  "affectedProductIds": ["prod_oat_flat_white"],
  "affectedIngredientIds": ["ingredient_oat_milk"]
}
```

## Implementation order

1. Inspect the current Next.js repository and identify existing models, routes, and data stores.
2. Remove remaining temperature fields, labels, and payload properties.
3. Finalize canonical Product, Category, Ingredient, Group, Option, and relationship models.
4. Implement availability computation and explicit ingredient relationships.
5. Implement Admin persistence for products, categories, ingredients, groups, and allowed options.
6. Implement the catalog API.
7. Update Customer customization visibility and cart editing without changing the storefront layout.
8. Update POS to use the catalog API and the two-pane fast-order workflow.
9. Implement server-side pricing and order validation.
10. Implement immutable order and customization snapshots.
11. Update KDS to consume order snapshots and support status transitions.
12. Add realtime product and order synchronization.
13. Add idempotency and payment safety.
14. Apply the Customer Storefront theme to POS, KDS, and Admin.
15. Run automated tests, typecheck, production build, and route smoke tests.

## Acceptance tests

### Product configuration

- Create a Beverage product.
- Assign two categories.
- Enable Ice Level, Sugar Level, and Add-ons.
- Allow Extra Shot and Coffee Jelly only.
- Confirm Vanilla Syrup is hidden for that product.

### Customer

- Confirm the storefront layout is unchanged.
- Confirm Sugar Level shows Less Sweet, Regular, and More Sweet.
- Confirm Ice Level shows Less, Regular, and Extra.
- Confirm no Temperature control exists.
- Confirm disabled options cannot be selected.
- Confirm cart editing restores all selections and totals.

### Availability

- Disable Oat Milk.
- Confirm all explicitly linked products become Sold Out.
- Confirm Oat Milk is disabled as an option.
- Confirm existing carts containing affected items cannot checkout.
- Confirm the API rejects a stale invalid order with HTTP 409.

### POS-to-KDS

- Add a customized product in POS.
- Add a note and select Cash.
- Submit the order.
- Confirm exactly one order is created.
- Confirm exactly one KDS ticket appears.
- Confirm KDS shows the exact options and note.
- Move the order through Preparing, Ready, and Completed.
- Confirm the same status appears in Customer receipt, POS, and Admin.

### Payment safety

- Create a QR Ph order.
- Confirm it remains pending until payment confirmation.
- Repeat the payment callback.
- Confirm no duplicate order or KDS ticket is created.
- Attempt insufficient cash.
- Confirm the order is rejected before creation.

### Next.js

- `npm run dev` starts the Next.js application.
- `npm run lint` passes.
- `npm run build` passes.
- `npm run start` serves the production build.
- No active source or package script references Vite.
- Customer, POS, KDS, Admin, and API routes work through the Next.js runtime.

## Definition of done

The work is complete when Admin configures each product once, Customer and POS consume the same catalog, multiple categories and product-specific customization groups work correctly, unavailable ingredients disable exactly their linked products and options, sold-out items cannot be ordered through any route, the server calculates and validates prices, POS sends one paid order to KDS, KDS displays the complete preparation snapshot, status updates synchronize across all roles, and staff screens visually match the Customer Storefront theme.


## Staff layout specifications

The following layouts are for **POS, KDS, and Admin only**. They should share the Customer Storefront’s light theme but remain operational interfaces optimized for tablets and desktop screens.

## POS layout

### Desktop and tablet landscape

Use a persistent two-pane workspace:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Cafe POS     Search products...     Open Tickets     Sync: Connected    │
├──────────────────────────────────────────────┬─────────────────────────┤
│ Category tabs                                │ CURRENT TICKET          │
│ All | Coffee | Matcha | Food | Pastries      │ Walk-in Guest            │
│                                              │ Dine-in / Takeaway       │
│ Product grid                                ├─────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐      │ 2 × Iced Americano      │
│ │ Product  │ │ Product  │ │ Product  │      │ Less Ice · Regular      │
│ │ ₱150.00  │ │ ₱180.00  │ │ ₱95.00   │      │ Extra Shot (+₱30.00)    │
│ │ Add      │ │ Customize│ │ Add      │      │ − 2 +       ₱360.00     │
│ └──────────┘ └──────────┘ └──────────┘      │                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐      │ 1 × Croissant           │
│ │ Product  │ │ Product  │ │ Sold Out │      │ − 1 +       ₱120.00     │
│ │ ₱160.00  │ │ ₱200.00  │ │ Disabled │      ├─────────────────────────┤
│ └──────────┘ └──────────┘ └──────────┘      │ Subtotal      ₱480.00   │
│                                              │ Payment: [Cash] [QR Ph] │
│                                              │ Cash Tendered            │
│                                              │ Total         ₱480.00   │
│                                              │ [Charge & Send to KDS]  │
└──────────────────────────────────────────────┴─────────────────────────┘
```

### POS regions

| Region | Function |
|---|---|
| Header | Terminal name, product search, open tickets, connection status, lock/logout |
| Category bar | Fast filtering without leaving the page |
| Product grid | Available products first, Sold Out products last |
| Ticket panel | Current order, quantity, customization summary, notes, subtotal |
| Payment footer | Cash/QR Ph, tendered amount, change, total, charge action |

### POS interaction rules

- Search and category filtering must not clear the current ticket.
- Simple products add directly with one tap.
- Products with customization groups open a compact drawer or modal.
- The drawer must show only groups enabled for that product.
- Add-ons must be product-specific; do not show every master add-on.
- Sold Out product cards remain visible at the end but cannot be selected.
- The ticket panel remains visible on desktop and tablet landscape.
- Tablet portrait uses a persistent `Ticket` button with item count and total.
- The charge action stays fixed at the bottom of the ticket panel.
- Disable the charge action while the order is being submitted.
- Show the generated order number immediately after success.
- Provide a clear retry path for network failures without creating a duplicate order.

### POS customization drawer

```text
┌────────────────────────────────────┐
│ Customize Iced Americano           │
├────────────────────────────────────┤
│ Sugar Level                        │
│ ( ) Less Sweet  (•) Regular        │
│ ( ) More Sweet                     │
│                                    │
│ Ice Level                          │
│ (•) Less  ( ) Regular  ( ) Extra   │
│                                    │
│ Add-ons                            │
│ [ ] Extra Shot (+₱30.00)           │
│ [ ] Coffee Jelly (+₱25.00)         │
│                                    │
│ Item total: ₱180.00                │
│ [Cancel] [Add to Ticket]           │
└────────────────────────────────────┘
```

## KDS layout

### Desktop monitor

Use a four-column production board:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ KITCHEN KDS   New 3   Preparing 5   Ready 2   Sync: Connected   Sound  │
├─────────────────┬─────────────────┬─────────────────┬─────────────────┤
│ NEW / PAID      │ PREPARING       │ READY           │ COMPLETED       │
│                 │                 │                 │                 │
│ ┌─────────────┐ │ ┌─────────────┐ │ ┌─────────────┐ │ ┌─────────────┐ │
│ │ #C-031      │ │ │ #C-029      │ │ │ #C-025      │ │ │ #C-021      │ │
│ │ 5 min       │ │ │ 8 min       │ │ │ Ready 2m    │ │ │ Completed   │ │
│ │ Paid        │ │ │ Paid        │ │ │ Paid        │ │ │ 10:24 AM    │ │
│ │             │ │ │             │ │ │             │ │ │             │ │
│ │ 2 × Iced    │ │ │ 1 × Latte   │ │ │ 2 × Croiss │ │ │ 1 × Espresso│ │
│ │ Americano   │ │ │ Regular     │ │ │             │ │ │             │ │
│ │ Less Ice    │ │ │ Oat Milk    │ │ │             │ │ │             │ │
│ │ Extra Shot  │ │ │ Less Sweet  │ │ │             │ │ │             │ │
│ │             │ │ │             │ │ │             │ │ │             │ │
│ │ [Start]     │ │ │ [Mark Ready]│ │ │ [Complete]  │ │ │ [Reopen]     │ │
│ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### Tablet KDS

- Keep the same four status columns.
- Allow horizontal scrolling if the tablet width cannot show all columns.
- Keep column headers sticky while tickets scroll.
- Do not shrink order numbers below a comfortable distance-reading size.
- Keep one primary next-status button visible on each active ticket.
- Keep the newest paid ticket visually prominent without moving tickets staff already started.

### KDS ticket content

Each ticket must show, in this order:

1. Order number.
2. Elapsed time.
3. Payment status.
4. Order type and customer/table identifier.
5. Product name and quantity.
6. Customization selections.
7. Add-ons and modifiers.
8. Special instructions.
9. Next status action.

Example:

```text
#C-031                         08:42
PAID · DINE-IN · Table 8

2 × Iced Americano
  Less Ice · Regular
  Extra Shot (+₱30.00)

1 × Croissant
  Serve separately

[Start Preparing]
```

### KDS urgency rules

| Wait time | Visual state | Action |
|---|---|---|
| 0–7 minutes | Normal | Continue standard preparation |
| 8–14 minutes | Amber | Prioritize soon |
| 15+ minutes | Red | Show delay indicator |
| 30+ minutes | Critical | Show escalation warning |

Use labels and timers in addition to color. Do not rely on color alone.

### KDS status rules

- `PENDING_PAYMENT` is not an active kitchen ticket.
- `PAID` enters New / Paid.
- `PREPARING` enters Preparing.
- `READY` enters Ready.
- `COMPLETED` leaves the active board or enters Completed history.
- Invalid status transitions must be rejected by the server.
- Repeated realtime events must not duplicate a ticket.
- Realtime disconnection must be visible in the header.

## Admin layout

### Desktop Admin shell

Use a fixed vertical left sidebar and a flexible content workspace:

```text
┌──────────────┬───────────────────────────────────────────────────────────┐
│ CAFE ADMIN   │ Page title                         Search  User  Lock      │
│              ├───────────────────────────────────────────────────────────┤
│ Dashboard    │                                                           │
│ Menu &       │                 ACTIVE PAGE CONTENT                        │
│ Products     │                                                           │
│ Inventory &  │                                                           │
│ Ingredients  │                                                           │
│ Categories & │                                                           │
│ Customiz.    │                                                           │
│ Passcodes &  │                                                           │
│ URLs         │                                                           │
│              │                                                           │
│ Storefront   │                                                           │
└──────────────┴───────────────────────────────────────────────────────────┘
```

### Admin tablet shell

- Use a collapsible left navigation drawer.
- The drawer opens with a clear menu button and closes after selecting a page.
- Keep page title, save state, and primary action visible in the top bar.
- Stack tables into cards when the tablet is too narrow.
- Keep controls at least 44 pixels high.

### Admin shared page header

Every Admin page should have:

```text
Page title
Short operational description
Search/filter controls when applicable
Primary action on the right
Save status or realtime status
```

### Admin Dashboard

```text
┌──────────────────────────────────────────────────────────────┐
│ Dashboard                                      Today ▼       │
├────────────┬────────────┬────────────┬──────────────────────┤
│ Gross Sales│ Active     │ Completed  │ Average Ticket       │
│ ₱24,580.00 │ Orders 12  │ Orders 48  │ ₱312.40              │
├────────────┴────────────┴────────────┴──────────────────────┤
│ Order Audit Log                                               │
│ Time | Order | Source | Amount | Payment | Status | Updated  │
│ 10:24| C-031  | POS    | ₱480   | Cash    | Ready  | KDS      │
└──────────────────────────────────────────────────────────────┘
```

### Admin Menu & Products

```text
┌──────────────────────────────────────────────────────────────┐
│ Menu     & Products                         [+ Create Product]   │
├──────────────────────────────────────────────────────────────┤
│ Search products...  Type ▼  Category ▼  Status ▼             │
├──────────────────────────────────────────────────────────────┤
│ Product       Type       Categories       Price   Status Edit │
│ Iced Americano Beverage  Iced Coffee,     ₱150    In Stock   │
│                         Espresso Classics                   │
│ Croissant     Food       Pastries         ₱120    Sold Out   │
└──────────────────────────────────────────────────────────────┘
```

Product create/edit should use a clear multi-section form:

1. Basic information.
2. Product type: Beverage or Food.
3. Multiple category selection.
4. Price and image.
5. Required ingredients.
6. Enabled master customization groups.
7. Allowed options/add-ons for this product.
8. Availability and preview.
9. Save or cancel.

### Admin Inventory & Ingredients

```text
┌──────────────────────────────────────────────────────────────┐
│ Inventory & Ingredients                      [+ Add Ingredient]│
├──────────────────────────────────────────────────────────────┤
│ Search ingredients...  Status ▼                              │
├──────────────────────────────────────────────────────────────┤
│ Ingredient       Linked products/options       Status Toggle  │
│ Oat Milk         3 products, 1 option           Available     │
│ Espresso Beans   12 products                   Available     │
│ Vanilla Syrup    2 products                    Unavailable   │
└──────────────────────────────────────────────────────────────┘
```

When toggling an ingredient off, show a confirmation summary:

```text
Oat Milk will affect:
- Oat Flat White Ristretto — Sold Out
- Oat Milk option — Unavailable

[Cancel] [Mark Unavailable]
```

### Admin Categories & Customizations

Use tabs or segmented controls inside the page:

```text
[Categories] [Customization Groups] [Options]
```

Category editor fields:

- Category name
- Product type: Beverage or Food
- Sort order
- Active/inactive

Customization group editor fields:

- Group name
- Selection mode
- Required or optional behavior
- Option list
- Option name
- Price modifier in Philippine pesos
- Option availability
- Sort order

Display options simply:

```text
Oat Milk (+₱25.00)
Extra Shot (+₱30.00)
Coffee Jelly (+₱25.00)
```

Do not display emoji or temperature choices.

### Admin Terminal Passcodes & URLs

Use three clear access cards:

```text
Kitchen KDS
PIN protection: Enabled
[Copy KDS URL] [Open KDS]

Cashier POS
PIN protection: Enabled
[Copy POS URL] [Open POS]

Manager Admin
PIN protection: Enabled
[Copy Admin URL] [Open Admin]
```

PINs must remain server-controlled. Never expose secret PIN values in public browser bundles.

## Staff navigation consistency

POS, KDS, and Admin should share:

- Same header height and spacing system.
- Same white surfaces and emerald primary action color.
- Same terminal lock control.
- Same realtime connection indicator.
- Same typography hierarchy.
- Same error, warning, success, and loading states.
- Same responsive behavior for tablet and desktop.

They should not share the Customer Storefront’s bottom navigation or customer-oriented product browsing structure.
