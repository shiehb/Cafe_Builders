# Cafe POS Architectural Audit Report

## A. CURRENT ARCHITECTURE
The current architecture is a hybrid system, likely mid-migration from Vite to a Next.js App Router setup, while retaining a custom Express server (`server.ts`). It handles POS, KDS, Admin, and Customer Storefront in a unified codebase. The database uses PostgreSQL via Prisma, but currently only persists `Categories`, `Products`, `Orders`, and `OrderItems`. 

Crucially, the rest of the application state (Ingredients, Customization Groups, Customization Options, and complex product mapping rules) is maintained **primarily in-memory** on the Express server via `Map` objects and initialized from hardcoded files (`src/data/menuData.ts`). State updates happen via REST APIs in `server.ts` which then broadcast real-time events through SSE and Supabase Realtime to connected clients.

## B. CURRENT DATA MODEL
```text
=== Database Models (Prisma) ===
Category (1) ─── (*) Product
Product  (1) ─── (*) OrderItem
Order    (1) ─── (*) OrderItem

=== In-Memory Models (server.ts) ===
Ingredient
CustomizationGroupConfig
CustomizationOptionConfig
CartItem
```

## C. CURRENT PRODUCT FLOW
Currently, product creation is hardcoded. Products are defined in `src/data/menuData.ts` and loaded into an in-memory Map (`productsStore`) on server startup. The server assigns `ingredientIds` based on rudimentary hardcoded rules (e.g., if category is "cat_matcha", append "ingredient_matcha"). Product availability is calculated dynamically via `recomputeProductAvailability()` on the server by checking if any of the hardcoded `ingredientIds` in the `ingredientsStore` Map have `isAvailable = false`.

## D. CURRENT ORDER FLOW
The client sends a `CheckoutPayload` to the `POST /api/orders` endpoint containing product IDs, quantities, and selected customizations. Customizations are passed in a loosely structured `ItemCustomization` object (e.g. `iceLevel`, `sweetness`). 

The server validates the order against the in-memory stores and creates an `Order` in the database. In the Prisma schema, customization choices are serialized directly into a nullable `Json` column on the `OrderItem` table. There are no relational constraints linking an ordered customization to a specific active `CustomizationOption` in the database. 

## E. CURRENT INVENTORY FLOW
There is **no actual numerical stock deduction mechanism** (e.g., deducting 15g of coffee beans). The inventory flow is purely binary: an ingredient is either `isAvailable: true` or `isAvailable: false`. When an admin marks an ingredient as unavailable via the API, the server recomputes product availability for all products that list that ingredient in their `ingredientIds`. Affected products are marked as sold out and broadcasted via SSE/Supabase to lock out clients.

## F. PROBLEMS / TECHNICAL DEBT
- **Split State Engine:** The database holds products/orders, but server memory holds ingredients, customizations, and complex mapping rules. If the server restarts, run-time overrides are lost.
- **Tightly Coupled Logic:** `server.ts` uses hardcoded if-statements for ingredient assignments (`categoryId === "cat_coffee" ? ["ingredient_coffee_beans"]`).
- **Inconsistent Typing:** Customization properties use loose keys (`ItemCustomization.iceLevel`) instead of standardized Group IDs and Option IDs.
- **Pricing Limitations:** Pricing modifications for milks and add-ons are hardcoded in the frontend and `server.ts`, making dynamic, contextual, or per-product modifier pricing impossible without code changes.
- **Inventory & Recipe Deficiencies:** No concept of unit of measure, quantity/stock amounts, or recipe consumption. Ingredients function strictly as binary availability tags.
- **Scalability Risks:** The `server.ts` holding global state in memory will completely break if the application is scaled horizontally or deployed to a serverless environment (Next.js default).

## G. REFACTORING RISKS
- **Breaking KDS and POS Frontends:** Migrating the `server.ts` Maps into a proper relational database will change the JSON shape of API responses that the POS and KDS currently rely on.
- **Stale Customizations in Order History:** The `OrderItem` table relies on a `Json` column for customizations. Transitioning to a strict relational model requires ensuring old orders can still be correctly parsed and rendered.
- **Serverless Realtime Compatibility:** Moving away from the long-running Express server to standard Next.js API routes means the current Express-based SSE might break. Realtime features will need to fully depend on Supabase.

## H. PROPOSED TARGET ARCHITECTURE
The proposed conceptual model:
```text
Product
├── Recipe
│    └── Recipe Items
│          └── Ingredient
│
└── Modifier Groups
      └── Modifier Options
            └── Ingredient (optional)
```

**Evaluation of Target Architecture:**
- **Excellent Suitability:** This architecture is exactly the industry standard for modern POS (Toast, Square), KDS, and online ordering. It beautifully decouples *what we sell* (Product) from *what we stock* (Ingredient) and *how it's made* (Recipe).
- **Inventory Accuracy:** Allowing Modifier Options to optionally link to an Ingredient ensures that an add-on (e.g., "Extra Shot") can properly deduct espresso beans inventory.
- **Contextual Pricing:** Pricing on the Modifier Option (rather than globally on the ingredient) solves the problem where Almond Milk costs ₱30 for a small drink but ₱50 for a large drink, without needing to duplicate the Almond Milk ingredient.
- **Future Scalability:** It directly supports recipe costing, exact inventory deduction, product variants, and combos/bundles.

---

### 1. "SAFE TO REFACTOR" AREAS
- `prisma/schema.prisma` (Safe to add new canonical models for Ingredients, Recipes, Modifier Groups, and Options since they do not currently exist).
- `src/data/menuData.ts` (Safe to transition these into a Prisma seed script).
- Admin UI (Explicitly marked for a full redesign and replacement in the implementation brief).

### 2. "DO NOT TOUCH YET" AREAS
- Customer Storefront layout (Explicitly restricted by the implementation brief).
- KDS ticket rendering UI (Must remain visually identical per the brief).
- Existing `Order` and `OrderItem` table schemas (Wait until the new product catalog is fully in place before altering order insertion).

### 3. RECOMMENDED MIGRATION SEQUENCE
1. **Schema Expansion:** Add canonical schema models for Ingredient, CustomizationGroup, CustomizationOption, and their relations to Product in `schema.prisma`.
2. **Data Seeding:** Create a Prisma seed script to migrate the hardcoded data from `server.ts` and `menuData.ts` into the DB.
3. **API Refactor:** Update the catalog and admin APIs to query and mutate Prisma instead of the in-memory Maps.
4. **Admin Revamp:** Build the new 5-page Admin workspace to manage the new DB entities.
5. **Validation Update:** Update the Order submission endpoint to perform server-side validation against Prisma relationships rather than memory.
6. **Snapshotting:** Refactor `OrderItem` to capture structured JSON snapshots of the new relational models during checkout.

### 4. RECOMMENDED IMPLEMENTATION PHASES
- **Phase 1: Catalog DB Migration:** Move Ingredients, Modifiers, and Products fully into PostgreSQL. Eliminate `server.ts` memory stores.
- **Phase 2: Availability & Validation Engine:** Ensure product/modifier availability dynamically computes from DB ingredient status. Enforce strict server-side order validation.
- **Phase 3: Admin Workspace:** Construct the full 5-page Admin UI for managing the catalog.
- **Phase 4: Recipe & Inventory Costing (Future):** Introduce `Recipe`, `RecipeItem`, and numerical stock deduction logic.

### 5. QUESTIONS THAT MUST BE RESOLVED
1. **Inventory Precision:** Should we immediately implement numerical stock levels (e.g., `stockQuantity`, `unitOfMeasure`) for Ingredients in the schema, or stick to the boolean `isAvailable` toggle for this initial refactor?
2. **Order Snapshot Versioning:** How should historical `OrderItem` JSON customizations be handled when we change the structure of `CustomizationOption`? Do we need to implement versioned snapshot payloads?
3. **Variant Handling:** Does the system need to support Product Variants (e.g., Small / Large) immediately, or can size be treated as a standard Modifier Group for now?
