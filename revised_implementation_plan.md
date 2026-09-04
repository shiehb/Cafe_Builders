# Final Implementation Plan & Technical Validation

## 1. Validated Availability Semantics
A search of the codebase confirms `manualAvailability` **does** exist in `server.ts` and `adminStore.ts`. 
The exact existing formula is:
`product.isAvailable = product.manualAvailability !== false && !ingredientUnavailable`
**Plan**: We will add `manualAvailability Boolean @default(true)` to the Prisma `Product` model. The backend will strictly retain this formula, computing `isAvailable` dynamically when an ingredient goes offline.

## 2. ProductIngredient `isRequired` Semantics
The existing `ingredientIds` is a simple string array, meaning all linked ingredients are implicitly required for the product to be available.
**Plan**: To preserve this while allowing future flexibility, we will add `isRequired Boolean @default(true)` to the explicit `ProductIngredient` join model.

## 3. Preserved API Contract (DTO Strategy)
The database models will use explicit join tables, but the API will **never** expose them directly. We will implement a centralized DTO mapper in `server.ts`:
```typescript
function mapProductToDTO(dbProduct: any): Product {
  return {
    ...dbProduct,
    price: dbProduct.price.toNumber(), // Safe serialization
    manualAvailability: dbProduct.manualAvailability,
    ingredientIds: dbProduct.productIngredients.map((pi) => pi.ingredientId),
    enabledCustomizationGroups: dbProduct.productGroups.map((pg) => pg.groupId),
    allowedOptionIds: dbProduct.productOptions.map((po) => po.optionId)
  };
}
```

## 4. Monetary Fields (Decimal Conversion)
An inspection of `schema.prisma` reveals that `Product.price`, `Order.subtotal`, `Order.totalAmount`, `OrderItem.unitPrice`, and `OrderItem.subtotal` currently use `Float`.
**Plan**: 
- Convert all these existing fields to `Decimal` in Prisma to prevent precision loss.
- In the centralized DTO layer, call `.toNumber()` so the frontend `src/types/index.ts` continues receiving standard numbers. No `.toNumber()` calls will be scattered elsewhere.

## 5. Customization Hierarchy Enforcement
The backend `POST/PATCH /api/admin/products` endpoints will enforce structural integrity:
- An option can only be attached to a product (`ProductCustomizationOption`) if its parent group is also attached (`ProductCustomizationGroup`).
- The database enforces that the Option belongs to the Group via foreign keys, preventing orphan options.

## 6. Authoritative Server-Side Checkout
The `POST /api/orders` endpoint will be completely rewritten to operate inside a `prisma.$transaction`:
1. Iterate over client-provided `items` (extracting only `productId`, `quantity`, and selected option IDs).
2. Fetch current prices directly from the DB.
3. Validate availability (`isAvailable === true`).
4. Validate that selected options belong to groups enabled for that product.
5. Calculate subtotal and total on the server.
6. Insert the `Order`, `OrderItem`, and new `OrderItemModifier` rows.

## 7. Protection of Historical Orders
The existing `OrderItem.customizations Json?` field **will remain untouched**.
New orders will populate both the legacy `customizations` JSON (for guaranteed backward compatibility with the current UI) and the new `OrderItemModifier` relations (for future robust querying).

## 8. Migration & Backfill Strategy
**Crucial Discovery**: A review of the current `schema.prisma` reveals that `ingredientIds`, `enabledCustomizationGroups`, and `allowedOptionIds` **do not currently exist in the PostgreSQL database**. They only exist in memory/frontend types.
**Strategy**: 
- We do not need a complex data-backfill SQL migration to move from arrays to join tables, because the arrays were never persisted in DB columns!
- We will generate a standard Prisma migration (`npx prisma migrate dev --name catalog_relations`) to create the new tables.
- The "backfill" will be handled cleanly by the idempotent Seed Script loading `menuData.ts`.

## 9. Idempotent Seed Strategy
The seed script will use `prisma.ingredient.upsert`, `prisma.customizationGroup.upsert`, etc., keyed by deterministic IDs from `menuData.ts`. 
- It will **not** overwrite `price`, `isAvailable`, or `manualAvailability` if the record already exists, protecting admin-made changes.

## 10. Codebase Search Confirmation
All references to `ingredientsStore`, `customizationGroupsStore`, `customizationOptionsStore`, `productsStore`, and `recomputeProductAvailability` have been identified in `server.ts` and `adminStore.ts` and will be surgically replaced with Prisma DB queries.

## 11. Final Prisma Schema Diff (Proposed additions/modifications)

```prisma
// Modified Existing Models
model Product {
  // ... existing fields ...
  price              Decimal  @db.Decimal(10, 2) // Changed from Float
  manualAvailability Boolean  @default(true)     // NEW

  productIngredients ProductIngredient[]
  productGroups      ProductCustomizationGroup[]
  productOptions     ProductCustomizationOption[]
}

model Order {
  // ... existing fields ...
  subtotal        Decimal @db.Decimal(10, 2) // Changed from Float
  serviceFee      Decimal @default(0.0) @db.Decimal(10, 2) // Changed from Float
  totalAmount     Decimal @db.Decimal(10, 2) // Changed from Float
}

model OrderItem {
  // ... existing fields ...
  unitPrice      Decimal @db.Decimal(10, 2) // Changed from Float
  subtotal       Decimal @db.Decimal(10, 2) // Changed from Float
  customizations Json?   // RETAINED for historical safety

  modifiers      OrderItemModifier[]
}

// New Models
model Ingredient {
  id              String   @id @default(cuid())
  name            String
  isAvailable     Boolean  @default(true)
  productIngredients ProductIngredient[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@map("ingredients")
}

model CustomizationGroup {
  id              String   @id @default(cuid())
  name            String
  selectionMode   String
  isActive        Boolean  @default(true)
  options         CustomizationOption[]
  productGroups   ProductCustomizationGroup[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@map("customization_groups")
}

model CustomizationOption {
  id              String   @id @default(cuid())
  groupId         String
  group           CustomizationGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  name            String
  priceModifier   Decimal  @db.Decimal(10, 2) @default(0)
  isActive        Boolean  @default(true)
  productOptions  ProductCustomizationOption[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@map("customization_options")
}

// Explicit Join Models
model ProductIngredient {
  productId       String
  ingredientId    String
  isRequired      Boolean  @default(true)
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  ingredient      Ingredient @relation(fields: [ingredientId], references: [id], onDelete: Restrict)
  @@id([productId, ingredientId])
  @@map("product_ingredients")
}

model ProductCustomizationGroup {
  productId       String
  groupId         String
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  group           CustomizationGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  @@id([productId, groupId])
  @@map("product_customization_groups")
}

model ProductCustomizationOption {
  productId       String
  optionId        String
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  option          CustomizationOption @relation(fields: [optionId], references: [id], onDelete: Cascade)
  @@id([productId, optionId])
  @@map("product_customization_options")
}

model OrderItemModifier {
  id              String   @id @default(cuid())
  orderItemId     String
  orderItem       OrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  groupName       String
  optionName      String
  priceAdjustment Decimal  @db.Decimal(10, 2)
  quantity        Int      @default(1)
  @@map("order_item_modifiers")
}
```

## 12. Implementation Sequence

1. Finalize Prisma schema.
2. Validate relationships and constraints.
3. Create migration (`npx prisma migrate dev`).
4. Backfill existing catalog relationships if required. (N/A: Fields are not in DB).
5. Implement idempotent seed (`upsert` logic).
6. Implement Prisma repository/query logic.
7. Implement DTO mapping.
8. Replace in-memory Maps in `server.ts`.
9. Implement availability logic (Product isAvailable derived from `manualAvailability` + `ingredients`).
10. Update admin product mutation endpoints (Enforce hierarchy).
11. Implement authoritative checkout validation.
12. Verify SSE/realtime behavior.
13. Run TypeScript/build checks.
14. Test catalog.
15. Test admin product editing.
16. Test customization validation.
17. Test checkout pricing.
18. Test unavailable ingredients.
19. Test repeated seed execution.
20. Test existing orders/historical snapshots.
