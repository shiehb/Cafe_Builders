import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const db = new PrismaClient();

  console.log("=== STEP 12-STYLE CLEANUP using suite logic ===");

  // 1. Delete orders with customerName starting with SMOKE_TEST_
  const smokeOrders = await db.order.findMany({
    where: { customerName: { startsWith: "SMOKE_TEST_" } },
    select: { id: true },
  });
  const orderIds = smokeOrders.map(o => o.id);
  console.log(`Found ${orderIds.length} SMOKE_TEST_ orders to delete`);

  await db.orderItemModifier.deleteMany({
    where: { orderItem: { orderId: { in: orderIds } } },
  });
  await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  console.log(`Deleted ${orderIds.length} orders`);

  // 2. Delete products with name starting SMOKE_TEST_
  const smokeProducts = await db.product.findMany({
    where: { name: { startsWith: "SMOKE_TEST_" } },
    select: { id: true },
  });
  const productIds = smokeProducts.map(p => p.id);
  console.log(`Found ${productIds.length} SMOKE_TEST_ products to delete`);

  await db.productIngredient.deleteMany({ where: { productId: { in: productIds } } });
  await db.productCustomizationGroup.deleteMany({ where: { productId: { in: productIds } } });
  await db.productCustomizationOption.deleteMany({ where: { productId: { in: productIds } } });
  await db.product.deleteMany({ where: { id: { in: productIds } } });
  console.log(`Deleted ${productIds.length} products`);

  // 3. Delete customization options with name starting SMOKE_TEST_
  await db.customizationOption.deleteMany({ where: { name: { startsWith: "SMOKE_TEST_" } } });
  console.log("Deleted SMOKE_TEST_ customization options");

  // 4. Delete customization groups with name starting SMOKE_TEST_
  await db.customizationGroup.deleteMany({ where: { name: { startsWith: "SMOKE_TEST_" } } });
  console.log("Deleted SMOKE_TEST_ customization groups");

  // 5. Delete ingredients with name starting SMOKE_TEST_
  await db.ingredient.deleteMany({ where: { name: { startsWith: "SMOKE_TEST_" } } });
  console.log("Deleted SMOKE_TEST_ ingredients");

  // 6. Delete categories with name starting SMOKE_TEST_
  await db.category.deleteMany({ where: { name: { startsWith: "SMOKE_TEST_" } } });
  console.log("Deleted SMOKE_TEST_ categories");

  // Verify final state
  const cats = await db.category.count({ where: { name: { contains: "SMOKE_TEST" } } });
  const ings = await db.ingredient.count({ where: { name: { contains: "SMOKE_TEST" } } });
  const prods = await db.product.count({ where: { name: { contains: "SMOKE_TEST" } } });
  const ords = await db.order.count({ where: { customerName: { contains: "SMOKE_TEST" } } });
  const totalOrds = await db.order.count();
  console.log("\n=== VERIFICATION ===");
  console.log(`Leftover categories: ${cats}`);
  console.log(`Leftover ingredients: ${ings}`);
  console.log(`Leftover products: ${prods}`);
  console.log(`Leftover orders (SMOKE_TEST_ customerName): ${ords}`);
  console.log(`Total orders in DB: ${totalOrds}`);

  // Check non-null paymentIntentId duplicates
  const groups = await db.$queryRaw`
    SELECT "paymentIntentId", COUNT(*) AS cnt
    FROM "orders"
    WHERE "paymentIntentId" IS NOT NULL
    GROUP BY "paymentIntentId"
    HAVING COUNT(*) > 1;
  `;
  console.log(`Non-null paymentIntentId duplicate groups: ${JSON.stringify(groups)}`);

  await db.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});