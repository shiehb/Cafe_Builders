# Implementation Plan: Revision of Current Data Model

## 1. Goal
Revise the existing database schema to solve the "Split State" technical debt identified in the audit without over-engineering. We will move the in-memory Maps (`Ingredient`, `CustomizationGroup`, `CustomizationOption`) from `server.ts` into PostgreSQL via Prisma. We will preserve the existing frontend and API contracts wherever possible to ensure backward compatibility.

## 2. Models to Modify/Create in `schema.prisma`

We will map the existing Typescript interfaces directly into Prisma models.

### New Models:
- **`Ingredient`**: `id`, `name`, `isAvailable`, `createdAt`, `updatedAt`.
- **`CustomizationGroup`**: `id`, `name`, `selectionMode` (enum SINGLE, MULTIPLE), `isActive`, `createdAt`, `updatedAt`.
- **`CustomizationOption`**: `id`, `groupId`, `name`, `priceModifier` (Float), `isActive`, `createdAt`, `updatedAt`.

### Existing Models to Update:
- **`Product`**:
  - Add implicit many-to-many relation to `Ingredient` (replacing `ingredientIds` string array).
  - Add implicit many-to-many relation to `CustomizationGroup` (replacing `enabledCustomizationGroups`).
  - Add implicit many-to-many relation to `CustomizationOption` (replacing `allowedOptionIds`).
- **`Category`**: Unchanged.
- **`Order`**: Unchanged.
- **`OrderItem`**: Unchanged (keep `customizations Json?` for backward compatibility).

## 3. Files / Components to Change

1. **`prisma/schema.prisma`**: Define the new models and relationships.
2. **`src/lib/prisma.ts` (or equivalent)**: Update the seed script (`seedDatabaseIfEmpty`) to insert the data currently hardcoded in `server.ts` and `src/data/menuData.ts` into the actual database tables.
3. **`server.ts`**:
   - Delete `ingredientsStore`, `customizationGroupsStore`, `customizationOptionsStore`, and `productsStore` Maps.
   - Refactor `recomputeProductAvailability()` to execute a Prisma update rather than an in-memory evaluation.
   - Refactor the Catalog API (e.g., `GET /api/catalog`) to fetch Products with `include: { ingredients: true, customizationGroups: true, allowedOptions: true }`.
   - Refactor the Order Checkout validation to query the database to verify product availability and option prices, rather than checking the Maps.
4. **`src/types/index.ts`**: Align the Typescript interfaces with the generated Prisma types if necessary, though the goal is to keep the shape identical so frontend components don't break.

## 4. Migration & Breaking Changes
- **Breaking Change**: The application will now strictly depend on PostgreSQL for ingredients and modifiers. The initial startup must run the seed script to populate these tables, otherwise the catalog will be empty.
- **Migration**: We will generate a new Prisma migration (`npx prisma migrate dev`).
- **Preservation**: The Customer UI, POS UI, and KDS UI remain 100% untouched because the API responses will retain the exact same JSON shapes (nested objects/arrays) as the previous in-memory Maps provided.

## 5. What Remains Unchanged
- The Next.js frontend components and styling.
- The `Order` and `OrderItem` snapshot mechanism (JSON customizations).
- The Realtime SSE broadcast mechanism (it will just broadcast the DB results).

## 6. Execution Steps
1. Update `schema.prisma`.
2. Run `npx prisma format` and `npx prisma db push` (or `migrate dev`).
3. Update the seed script in `server.ts` / `prisma.ts` to populate the new tables.
4. Replace all Map `.get()` and `.values()` calls in `server.ts` with asynchronous `prisma...findMany()` and `findUnique()` calls.
5. Verify `npm run build` and `npm run dev` start without errors.
