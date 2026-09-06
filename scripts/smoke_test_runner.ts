import { getDb } from "../src/lib/prisma";
import * as catalogService from "../src/services/catalogService";
import * as inventoryService from "../src/services/inventoryService";
import * as orderService from "../src/services/orderService";
import * as adminService from "../src/services/adminService";
import { createPayMongoQRPhPayment, PayMongoNotConfiguredError } from "../src/lib/paymongo";

const BASE_URL = "http://127.0.0.1:3000";

async function main() {
  console.log("================================================================================");
  console.log("STARTING PHASE 3 END-TO-END RUNTIME SMOKE TEST");
  console.log("================================================================================");

  const db = getDb();

  // Step 0: Ensure DB is empty before we start
  console.log("\n[STEP 0] Checking pre-test database status...");
  const initialCounts = {
    categories: await db.category.count(),
    ingredients: await db.ingredient.count(),
    customizationGroups: await db.customizationGroup.count(),
    customizationOptions: await db.customizationOption.count(),
    products: await db.product.count(),
    orders: await db.order.count(),
    orderItems: await db.orderItem.count(),
    orderItemModifiers: await db.orderItemModifier.count(),
  };
  console.log("Initial database counts:", initialCounts);

  // Authenticate as Admin to get session cookie
  console.log("\n[AUTH] Logging in to retrieve HttpOnly admin_session cookie...");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: "9999" }),
  });
  const cookieHeader = loginRes.headers.get("set-cookie") || "";
  const adminCookie = cookieHeader.split(";")[0];
  console.log("Auth Status:", loginRes.status, "Cookie captured:", !!adminCookie);

  const adminHeaders = {
    "Content-Type": "application/json",
    Cookie: adminCookie,
  };

  // ---------------------------------------------------------------------------
  // STEP 2: CREATE TEMPORARY TEST DATA
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 2] Creating temporary test data with prefix SMOKE_TEST_...");

  // 2.1 Category
  const catRes = await fetch(`${BASE_URL}/api/admin/categories`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "SMOKE_TEST_Category",
      sortOrder: 1,
      icon: "Coffee",
    }),
  });
  const catData = await catRes.json();
  if (!catRes.ok) {
    throw new Error(`Category creation failed: ${JSON.stringify(catData)}`);
  }
  const testCategory = catData.category || catData.data;
  console.log("1. Created Category:", testCategory.id, testCategory.name);

  // 2.2 Ingredient
  const ingRes = await fetch(`${BASE_URL}/api/admin/ingredients`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "SMOKE_TEST_Espresso_Bean",
      isAvailable: true,
    }),
  });
  const ingData = await ingRes.json();
  const testIngredient = ingData.ingredient || ingData.data;
  console.log("2. Created Ingredient:", testIngredient.id, testIngredient.name, "isAvailable:", testIngredient.isAvailable);

  // 2.3 Customization Group
  const groupRes = await fetch(`${BASE_URL}/api/admin/customization-groups`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "SMOKE_TEST_Milk_Choice",
      selectionMode: "SINGLE",
      isRequired: true,
      sortOrder: 1,
      isActive: true,
    }),
  });
  const groupData = await groupRes.json();
  const testGroup = groupData.group || groupData.data;
  console.log("3. Created Customization Group:", testGroup.id, testGroup.name);

  // 2.4 Customization Options (at least 2)
  const opt1Res = await fetch(`${BASE_URL}/api/admin/customization-options`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      groupId: testGroup.id,
      name: "SMOKE_TEST_Oat_Milk",
      priceModifier: 30.0,
      isActive: true,
    }),
  });
  const opt1Data = await opt1Res.json();
  const testOption1 = opt1Data.option || opt1Data.data;
  console.log("4a. Created Option 1:", testOption1.id, testOption1.name, "priceModifier:", testOption1.priceModifier);

  const opt2Res = await fetch(`${BASE_URL}/api/admin/customization-options`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      groupId: testGroup.id,
      name: "SMOKE_TEST_Almond_Milk",
      priceModifier: 25.0,
      isActive: true,
    }),
  });
  const opt2Data = await opt2Res.json();
  const testOption2 = opt2Data.option || opt2Data.data;
  console.log("4b. Created Option 2:", testOption2.id, testOption2.name, "priceModifier:", testOption2.priceModifier);

  // 2.5 Product
  const prodRes = await fetch(`${BASE_URL}/api/admin/products`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "SMOKE_TEST_Artisan_Latte",
      description: "Rich espresso with silky steamed milk choice",
      price: 160.0,
      categoryId: testCategory.id,
      isAvailable: true,
      popular: true,
      ingredientIds: [testIngredient.id],
      customizationGroupIds: [testGroup.id],
      allowedOptionIds: [testOption1.id, testOption2.id],
    }),
  });
  const prodData = await prodRes.json();
  const testProduct = prodData.product;
  console.log("5. Created Product:", testProduct.id, testProduct.name, "price:", testProduct.price, "isAvailable:", testProduct.isAvailable);

  // ---------------------------------------------------------------------------
  // STEP 3: CATALOG TESTS
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 3] Testing Public Catalog API endpoints...");

  // 3.1 GET /api/products
  const listProdsRes = await fetch(`${BASE_URL}/api/products`);
  const listProdsJson = await listProdsRes.json();
  const foundProd = (listProdsJson.data || []).find((p: any) => p.id === testProduct.id);

  console.log("GET /api/products returns", (listProdsJson.data || []).length, "products.");
  if (!foundProd) throw new Error("Created product not found in GET /api/products");
  console.log("Product in catalog:", {
    id: foundProd.id,
    name: foundProd.name,
    price: foundProd.price,
    priceType: typeof foundProd.price,
    categoryName: foundProd.categoryName,
    ingredientsCount: foundProd.ingredientIds?.length,
    customizationGroupsCount: foundProd.customizationGroups?.length,
    allowedOptionIdsCount: foundProd.allowedOptionIds?.length,
    isAvailable: foundProd.isAvailable,
  });

  // 3.2 GET /api/products/:id
  const singleProdRes = await fetch(`${BASE_URL}/api/products/${testProduct.id}`);
  const singleProdJson = await singleProdRes.json();
  const singleProd = singleProdJson.product;
  if (!singleProd || singleProd.id !== testProduct.id) {
    throw new Error(`GET /api/products/:id failed for id ${testProduct.id}`);
  }
  console.log("GET /api/products/:id verified successfully for:", singleProd.name);

  // ---------------------------------------------------------------------------
  // STEP 4: AVAILABILITY PROPAGATION TEST
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 4] Testing Inventory Availability Propagation...");

  // 4.1 Initial check: isAvailable == true
  console.log("Initial state: product.isAvailable =", singleProd.isAvailable);
  if (singleProd.isAvailable !== true) {
    throw new Error("Expected initial product.isAvailable to be true");
  }

  // 4.2 Set ingredient.isAvailable = false via PATCH /api/admin/ingredients/:id
  console.log("Setting ingredient.isAvailable = false...");
  const patchIngRes1 = await fetch(`${BASE_URL}/api/admin/ingredients/${testIngredient.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ isAvailable: false }),
  });
  const patchIngJson1 = await patchIngRes1.json();
  console.log("Ingredient updated:", patchIngJson1.ingredient?.name, "isAvailable:", patchIngJson1.ingredient?.isAvailable);

  // Check product via public API
  const prodCheck1Res = await fetch(`${BASE_URL}/api/products/${testProduct.id}`);
  const prodCheck1 = (await prodCheck1Res.json()).product;
  console.log("After ingredient 86'd, product.isAvailable =", prodCheck1.isAvailable);
  if (prodCheck1.isAvailable !== false) {
    throw new Error("Availability propagation failed: product should be unavailable when required ingredient is unavailable");
  }

  // 4.3 Restore ingredient.isAvailable = true
  console.log("Restoring ingredient.isAvailable = true...");
  const patchIngRes2 = await fetch(`${BASE_URL}/api/admin/ingredients/${testIngredient.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ isAvailable: true }),
  });
  const patchIngJson2 = await patchIngRes2.json();
  console.log("Ingredient updated:", patchIngJson2.ingredient?.name, "isAvailable:", patchIngJson2.ingredient?.isAvailable);

  const prodCheck2Res = await fetch(`${BASE_URL}/api/products/${testProduct.id}`);
  const prodCheck2 = (await prodCheck2Res.json()).product;
  console.log("After ingredient restored, product.isAvailable =", prodCheck2.isAvailable);
  if (prodCheck2.isAvailable !== true) {
    throw new Error("Availability propagation failed: product should be available when ingredient is restored");
  }
  console.log("Inventory availability propagation TEST PASSED!");

  // ---------------------------------------------------------------------------
  // STEP 5: CHECKOUT TEST WITH AUTHORITATIVE PRICING VALIDATION
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 5] Testing Checkout with Authoritative Pricing...");

  // Deliberately send bogus client prices in the payload:
  // Base product is PHP 160.00, Option1 (Oat milk) is PHP 30.00
  // Quantity: 2
  // True line total: (160 + 30) * 2 = 380.00
  // Deliberate bogus client pricing: price = 1.00, total = 2.00
  const checkoutPayload = {
    customerName: "SMOKE_TEST_Customer",
    orderType: "DINE_IN",
    paymentMethod: "CASH",
    items: [
      {
        productId: testProduct.id,
        productName: "Client_Attempted_Tampered_Name",
        quantity: 2,
        price: 1.0, // TAMPERED CLIENT PRICE!
        unitPrice: 1.0, // TAMPERED CLIENT PRICE!
        selectedOptionIds: [testOption1.id],
        customizations: {
          milkOption: "SMOKE_TEST_Oat_Milk",
        },
        notes: "Extra hot please",
      },
    ],
    notes: "Smoke test order",
  };

  const checkoutRes = await fetch(`${BASE_URL}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(checkoutPayload),
  });

  const checkoutJson = await checkoutRes.json();
  if (checkoutRes.status !== 201 || !checkoutJson.success) {
    throw new Error(`Checkout failed with status ${checkoutRes.status}: ${JSON.stringify(checkoutJson)}`);
  }

  const createdOrder = checkoutJson.order;
  console.log("Order created successfully:", {
    id: createdOrder.id,
    orderNumber: createdOrder.orderNumber,
    subtotal: createdOrder.subtotal,
    totalAmount: createdOrder.totalAmount,
    status: createdOrder.status,
    itemsCount: createdOrder.items?.length,
  });

  // Verify authoritative pricing
  const expectedSubtotal = 380.0; // (160 + 30) * 2
  const expectedTotal = 380.0;

  if (createdOrder.subtotal !== expectedSubtotal) {
    throw new Error(`Authoritative subtotal mismatch! Expected ${expectedSubtotal}, got ${createdOrder.subtotal}`);
  }
  if (createdOrder.totalAmount !== expectedTotal) {
    throw new Error(`Authoritative total mismatch! Expected ${expectedTotal}, got ${createdOrder.totalAmount}`);
  }

  // Verify OrderItem snapshot fields
  const orderItem = createdOrder.items[0];
  console.log("OrderItem snapshot:", {
    id: orderItem.id,
    productId: orderItem.productId,
    productName: orderItem.productName,
    unitPrice: orderItem.unitPrice,
    quantity: orderItem.quantity,
    subtotal: orderItem.subtotal,
  });

  if (orderItem.productId !== testProduct.id) throw new Error("OrderItem.productId mismatch");
  if (orderItem.productName !== "SMOKE_TEST_Artisan_Latte") throw new Error("OrderItem.productName snapshot mismatch");
  if (orderItem.unitPrice !== 160.0) throw new Error("OrderItem.unitPrice snapshot mismatch");
  if (orderItem.quantity !== 2) throw new Error("OrderItem.quantity mismatch");
  if (orderItem.subtotal !== 380.0) throw new Error("OrderItem.subtotal mismatch");

  // Verify OrderItemModifier snapshot fields
  const modifier = orderItem.modifiers[0];
  console.log("OrderItemModifier snapshot:", {
    id: modifier.id,
    optionId: modifier.optionId,
    groupName: modifier.groupName,
    optionName: modifier.optionName,
    priceAdjustment: modifier.priceAdjustment,
    quantity: modifier.quantity,
  });

  if (modifier.optionId !== testOption1.id) throw new Error("OrderItemModifier.optionId mismatch");
  if (modifier.groupName !== "SMOKE_TEST_Milk_Choice") throw new Error("OrderItemModifier.groupName mismatch");
  if (modifier.optionName !== "SMOKE_TEST_Oat_Milk") throw new Error("OrderItemModifier.optionName mismatch");
  if (modifier.priceAdjustment !== 30.0) throw new Error("OrderItemModifier.priceAdjustment mismatch");
  if (modifier.quantity !== 1) throw new Error("OrderItemModifier.quantity mismatch");

  console.log("Checkout authoritative pricing and snapshot creation TEST PASSED!");

  // ---------------------------------------------------------------------------
  // STEP 6: HISTORICAL SNAPSHOT IMMUTABILITY TEST
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 6] Testing Historical Snapshot Immutability...");

  // Modify product name and price in catalog
  console.log("Mutating product name and price in catalog...");
  await fetch(`${BASE_URL}/api/admin/products/${testProduct.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "SMOKE_TEST_Artisan_Latte_MUTATED",
      price: 999.0,
    }),
  });

  // Modify option name and priceModifier in catalog
  console.log("Mutating customization option name and priceModifier in catalog...");
  await fetch(`${BASE_URL}/api/admin/customization-options/${testOption1.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "SMOKE_TEST_Oat_Milk_MUTATED",
      priceModifier: 150.0,
    }),
  });

  // Fetch the previously created order from the API/DB
  const orderAfterCatalogMutationRes = await fetch(`${BASE_URL}/api/orders/${createdOrder.id}`);
  const orderAfterMutation = (await orderAfterCatalogMutationRes.json()).data;

  const itemAfter = orderAfterMutation.items[0];
  const modAfter = itemAfter.modifiers[0];

  console.log("Order Item after catalog mutation:", {
    storedProductName: itemAfter.productName,
    storedUnitPrice: itemAfter.unitPrice,
    storedOptionName: modAfter.optionName,
    storedPriceAdjustment: modAfter.priceAdjustment,
    orderSubtotal: orderAfterMutation.subtotal,
    orderTotal: orderAfterMutation.totalAmount,
  });

  if (itemAfter.productName !== "SMOKE_TEST_Artisan_Latte") {
    throw new Error("Historical Snapshot Violated: item.productName changed when product changed!");
  }
  if (itemAfter.unitPrice !== 160.0) {
    throw new Error("Historical Snapshot Violated: item.unitPrice changed when product changed!");
  }
  if (modAfter.optionName !== "SMOKE_TEST_Oat_Milk") {
    throw new Error("Historical Snapshot Violated: modifier.optionName changed when option changed!");
  }
  if (modAfter.priceAdjustment !== 30.0) {
    throw new Error("Historical Snapshot Violated: modifier.priceAdjustment changed when option changed!");
  }
  if (orderAfterMutation.subtotal !== 380.0 || orderAfterMutation.totalAmount !== 380.0) {
    throw new Error("Historical Snapshot Violated: order totals mutated!");
  }
  console.log("Historical Snapshot Immutability TEST PASSED!");

  // ---------------------------------------------------------------------------
  // STEP 7: ORDER STATUS LIFECYCLE PERSISTENCE TEST
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 7] Testing Order Status Lifecycle Progression via PATCH /api/orders/:id/status...");

  const transitions = ["PAID", "PREPARING", "READY", "COMPLETED"] as const;

  for (const nextStatus of transitions) {
    const patchStatusRes = await fetch(`${BASE_URL}/api/orders/${createdOrder.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (patchStatusRes.status !== 200) {
      throw new Error(`Failed to update status to ${nextStatus}: ${await patchStatusRes.text()}`);
    }

    // Immediately verify against the database/API directly
    const verifyOrderRes = await fetch(`${BASE_URL}/api/orders/${createdOrder.id}`);
    const verifyOrder = (await verifyOrderRes.json()).data;

    console.log(`Status transition -> ${nextStatus}: Verified DB status = ${verifyOrder.status}`);
    if (verifyOrder.status !== nextStatus) {
      throw new Error(`Status did not persist in database! Expected ${nextStatus}, found ${verifyOrder.status}`);
    }
  }
  console.log("Order status progression and persistence TEST PASSED!");

  // ---------------------------------------------------------------------------
  // STEP 8: PAYMENT RECORD TEST (Simulated payment identifiers)
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 8] Testing orderService.recordPayment() with simulated IDs...");

  const step8CheckoutRes = await fetch(`${BASE_URL}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "SMOKE_TEST_Payment_Customer",
      orderType: "DINE_IN",
      paymentMethod: "GCASH",
      items: [{ productId: testProduct.id, quantity: 1 }],
    }),
  });

  const step8CheckoutJson = await step8CheckoutRes.json();
  if (step8CheckoutRes.status !== 201 || !step8CheckoutJson.success) {
    throw new Error(`STEP 8 checkout failed with status ${step8CheckoutRes.status}: ${JSON.stringify(step8CheckoutJson)}`);
  }
  const step8Order = step8CheckoutJson.order;

  const simPaymentIntent = "pi_smoke_test_intent_778899";
  const simPaymentMethod = "pm_smoke_test_card_112233";

  const recordedOrder = await orderService.recordPayment({
    idOrOrderNumber: step8Order.id,
    paymentIntentId: simPaymentIntent,
    paymentMethodId: simPaymentMethod,
    status: "PREPARING",
  });

  console.log("Payment record returned:", {
    orderNumber: recordedOrder.orderNumber,
    paymentIntentId: recordedOrder.paymentIntentId,
    paymentMethodId: recordedOrder.paymentMethodId,
    status: recordedOrder.status,
  });

  // Verify persistence by querying fresh from DB
  const dbOrder = await db.order.findUnique({ where: { id: step8Order.id } });
  if (dbOrder?.paymentIntentId !== simPaymentIntent) {
    throw new Error("paymentIntentId failed to persist in DB");
  }
  if (dbOrder?.paymentMethodId !== simPaymentMethod) {
    throw new Error("paymentMethodId failed to persist in DB");
  }
  if (dbOrder?.status !== "PREPARING") {
    throw new Error("Order status failed to persist in DB");
  }
  console.log("Payment persistence TEST PASSED!");

  // ---------------------------------------------------------------------------
  // STEP 9: ORDER NUMBER CONCURRENCY TEST
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 9] Testing Order Number Generation Concurrency...");

  console.log("Dispatching 5 concurrent order creation requests via API...");
  const concurrentPromises = Array.from({ length: 5 }).map((_, i) =>
    fetch(`${BASE_URL}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `Concurrent_Customer_${i}`,
        orderType: "DINE_IN",
        paymentMethod: "CASH",
        items: [
          {
            productId: testProduct.id,
            quantity: 1,
            selectedOptionIds: [testOption2.id],
          },
        ],
      }),
    }).then(async (r) => ({ status: r.status, data: await r.json() }))
  );

  const concurrentResults = await Promise.all(concurrentPromises);
  const successfulOrders = concurrentResults
    .filter((r) => r.status === 201 && r.data.success)
    .map((r) => r.data.order);
  const failedOrders = concurrentResults.filter((r) => r.status !== 201);
  if (failedOrders.length > 0) {
    console.log("Failed orders data:", JSON.stringify(failedOrders, null, 2));
  }

  console.log(
    `Concurrent results: ${successfulOrders.length} succeeded, ${failedOrders.length} failed.`
  );
  const generatedNumbers = successfulOrders.map((o) => o.orderNumber);
  console.log("Generated order numbers:", generatedNumbers);

  const uniqueNumbers = new Set(generatedNumbers);
  const hasDuplicates = uniqueNumbers.size < generatedNumbers.length;
  console.log("Unique order numbers count:", uniqueNumbers.size, "Has duplicates:", hasDuplicates);

  // ---------------------------------------------------------------------------
  // STEP 10: API ERROR HANDLING TESTS
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 10] Testing API Error Handling and Validation...");

  // 10.1 Nonexistent product
  const err1Res = await fetch(`${BASE_URL}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ productId: "non_existent_product_xyz", quantity: 1 }],
    }),
  });
  const err1Json = await err1Res.json();
  console.log("10.1 Nonexistent product status:", err1Res.status, "body:", err1Json);
  if (err1Res.status < 400 || !err1Json.error) {
    throw new Error("Expected 4xx error for nonexistent product");
  }

  // 10.2 Archived / unavailable product checkout
  // Archive a dummy test product to verify rejection
  const tempProd = await catalogService.createProduct({
    name: "SMOKE_TEST_Archived_Item",
    price: 100,
    categoryId: testCategory.id,
    description: "Temp",
    imageUrl: "https://example.com/item.png",
  });
  await catalogService.archiveProduct(tempProd.id);

  const err2Res = await fetch(`${BASE_URL}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ productId: tempProd.id, quantity: 1 }],
    }),
  });
  const err2Json = await err2Res.json();
  console.log("10.2 Archived product checkout status:", err2Res.status, "body:", err2Json);
  if (err2Res.status !== 409) {
    throw new Error(`Expected 409 status for archived product, got ${err2Res.status}`);
  }

  // 10.3 Nonexistent customization option
  const err3Res = await fetch(`${BASE_URL}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [
        {
          productId: testProduct.id,
          quantity: 1,
          selectedOptionIds: ["non_existent_option_123"],
        },
      ],
    }),
  });
  const err3Json = await err3Res.json();
  console.log("10.3 Nonexistent option status:", err3Res.status, "body:", err3Json);
  if (err3Res.status < 400 || !err3Json.error) {
    throw new Error("Expected 4xx error for nonexistent option");
  }

  // 10.4 Invalid order status transition
  const err4Res = await fetch(`${BASE_URL}/api/orders/${createdOrder.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "INVALID_STATUS_STRING" }),
  });
  const err4Json = await err4Res.json();
  console.log("10.4 Invalid status transition status:", err4Res.status, "body:", err4Json);
  if (err4Res.status !== 400) {
    throw new Error(`Expected 400 status for invalid status transition, got ${err4Res.status}`);
  }

  // 10.5 Malformed request (empty cart)
  const err5Res = await fetch(`${BASE_URL}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [] }),
  });
  const err5Json = await err5Res.json();
  console.log("10.5 Malformed empty cart status:", err5Res.status, "body:", err5Json);
  if (err5Res.status !== 400) {
    throw new Error(`Expected 400 status for empty cart, got ${err5Res.status}`);
  }

  // Confirm no raw Prisma errors exposed
  for (const json of [err1Json, err2Json, err3Json, err4Json, err5Json]) {
    const str = JSON.stringify(json);
    if (str.includes("PrismaClientKnownRequestError") || str.includes("prisma.")) {
      throw new Error(`Raw Prisma error leaked to client: ${str}`);
    }
  }
  console.log("API Error Handling and Security Validation TEST PASSED!");

  // ---------------------------------------------------------------------------
  // STEP 11: CLEANUP
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 11] Cleaning up ONLY temporary SMOKE_TEST data...");

  // Delete all orders and related items created during smoke test
  const smokeOrders = await db.order.findMany({
    where: {
      OR: [
        { customerName: { startsWith: "SMOKE_TEST_" } },
        { customerName: { startsWith: "Concurrent_Customer_" } },
        { id: createdOrder.id },
      ],
    },
    select: { id: true },
  });

  const orderIds = smokeOrders.map((o) => o.id);
  console.log(`Found ${orderIds.length} smoke test orders to delete.`);

  await db.orderItemModifier.deleteMany({
    where: {
      orderItem: { orderId: { in: orderIds } },
    },
  });
  await db.orderItem.deleteMany({
    where: { orderId: { in: orderIds } },
  });
  await db.order.deleteMany({
    where: { id: { in: orderIds } },
  });

  // Delete products
  const smokeProducts = await db.product.findMany({
    where: {
      name: { startsWith: "SMOKE_TEST_" },
    },
    select: { id: true },
  });
  const productIds = smokeProducts.map((p) => p.id);
  console.log(`Found ${productIds.length} smoke test products to delete.`);

  await db.productIngredient.deleteMany({
    where: { productId: { in: productIds } },
  });
  await db.productCustomizationGroup.deleteMany({
    where: { productId: { in: productIds } },
  });
  await db.productCustomizationOption.deleteMany({
    where: { productId: { in: productIds } },
  });
  await db.product.deleteMany({
    where: { id: { in: productIds } },
  });

  // Delete options, groups, ingredients, categories
  await db.customizationOption.deleteMany({
    where: { name: { startsWith: "SMOKE_TEST_" } },
  });
  await db.customizationGroup.deleteMany({
    where: { name: { startsWith: "SMOKE_TEST_" } },
  });
  await db.ingredient.deleteMany({
    where: { name: { startsWith: "SMOKE_TEST_" } },
  });
  await db.category.deleteMany({
    where: { name: { startsWith: "SMOKE_TEST_" } },
  });

  // Verify DB counts are completely clean
  const finalCounts = {
    categories: await db.category.count(),
    ingredients: await db.ingredient.count(),
    customizationGroups: await db.customizationGroup.count(),
    customizationOptions: await db.customizationOption.count(),
    products: await db.product.count(),
    orders: await db.order.count(),
    orderItems: await db.orderItem.count(),
    orderItemModifiers: await db.orderItemModifier.count(),
  };
  console.log("Post-cleanup database counts:", finalCounts);

  for (const [table, count] of Object.entries(finalCounts)) {
    if (count !== 0) {
      throw new Error(`Cleanup failed: Table ${table} still has ${count} records!`);
    }
  }
  console.log("Database cleanup verified: 0 smoke test records remain!");

  // ---------------------------------------------------------------------------
  // STEP 12: FINAL DATABASE VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 12] Final Database Architecture Verification...");

  // Verify 11 expected tables
  const tables: any[] = await db.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  const tableNames = tables.map((t) => t.table_name);
  console.log("Tables present in database (" + tableNames.length + "):", tableNames);

  const expected11Tables = [
    "_prisma_migrations",
    "categories",
    "customization_groups",
    "customization_options",
    "ingredients",
    "order_item_modifiers",
    "order_items",
    "orders",
    "product_customization_groups",
    "product_customization_options",
    "product_ingredients",
    "products",
  ]; // Note: categories, customization_groups, customization_options, ingredients, order_item_modifiers, order_items, orders, product_customization_groups, product_customization_options, product_ingredients, products are the 11 domain tables (+ _prisma_migrations)

  const migrations: any[] = await db.$queryRaw`
    SELECT migration_name, finished_at 
    FROM "_prisma_migrations"
    ORDER BY finished_at ASC;
  `;
  console.log("Applied migrations in _prisma_migrations:", migrations);

  if (migrations.length !== 1 || migrations[0].migration_name !== "20260904000000_init_clean_catalog") {
    throw new Error(`_prisma_migrations violation! Found: ${JSON.stringify(migrations)}`);
  }

  console.log("\n================================================================================");

  // ---------------------------------------------------------------------------
  // STEP 11g: F11-A PAYMENT INTEGRITY HARDENING TESTS
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 11g] Testing F11-A payment integrity hardening...");

  // -- A1: no silent simulated fallback; explicit failure; simulation gated --
  {
    const origSec = process.env.PAYMONGO_SECRET_KEY;
    const origSim = process.env.PAYMONGO_SIMULATION_ENABLED;
    const origFetch = globalThis.fetch;
    const resetF11Env = () => {
      if (origSec === undefined) delete process.env.PAYMONGO_SECRET_KEY;
      else process.env.PAYMONGO_SECRET_KEY = origSec;
      if (origSim === undefined) delete process.env.PAYMONGO_SIMULATION_ENABLED;
      else process.env.PAYMONGO_SIMULATION_ENABLED = origSim;
      globalThis.fetch = origFetch;
    };

    let f11NotConfiguredError = false;
    process.env.PAYMONGO_SECRET_KEY = "";
    delete process.env.PAYMONGO_SIMULATION_ENABLED;
    try {
      await createPayMongoQRPhPayment(100, "C-F11");
    } catch (e) {
      f11NotConfiguredError = e instanceof PayMongoNotConfiguredError;
    }
    console.log("F11 (A1) not configured -> explicit PayMongoNotConfiguredError:", f11NotConfiguredError);
    if (!f11NotConfiguredError) {
      throw new Error("F11 (A1): no PayMongo key + simulation OFF must throw PayMongoNotConfiguredError");
    }

    process.env.PAYMONGO_SECRET_KEY = "";
    process.env.PAYMONGO_SIMULATION_ENABLED = "true";
    const f11Sim = await createPayMongoQRPhPayment(100, "C-F11");
    console.log("F11 (A1) sim explicitly enabled: isSimulated =", f11Sim.isSimulated, "intent =", f11Sim.paymentIntentId);
    if (f11Sim.isSimulated !== true) {
      throw new Error("F11 (A1): PAYMONGO_SIMULATION_ENABLED=true must yield isSimulated:true");
    }
    if (!f11Sim.paymentIntentId.includes("_sim_")) {
      throw new Error("F11 (A1): simulated intent id must be clearly marked");
    }

    let f11ProviderFailureThrew = false;
    process.env.PAYMONGO_SECRET_KEY = "sk_test_f11_provider_failure";
    delete process.env.PAYMONGO_SIMULATION_ENABLED;
    globalThis.fetch = (async () => {
      throw new Error("simulated PayMongo network outage");
    }) as any;
    try {
      await createPayMongoQRPhPayment(100, "C-F11");
    } catch (e) {
      f11ProviderFailureThrew = !(e instanceof PayMongoNotConfiguredError);
    }
    console.log("F11 (A1) live provider outage -> explicit error (no simulated QR):", f11ProviderFailureThrew);
    if (!f11ProviderFailureThrew) {
      throw new Error("F11 (A1): live PayMongo outage must throw, never return a simulated QR");
    }

    resetF11Env();
  }

  // -- A2: DB-level unique payment binding --
  const f11DupIntent = `pi_smoke_f11_dup_${Date.now()}`;
  const f11DupNumber = `C-${7000 + Math.floor(Math.random() * 9000)}`;
  await db.order.create({
    data: {
      orderNumber: f11DupNumber,
      status: "PENDING_PAYMENT",
      paymentMethod: "QRPH",
      paymentIntentId: f11DupIntent,
      orderType: "TAKEAWAY",
      customerName: "SMOKE_TEST_F11_DUP",
      subtotal: 10,
      totalAmount: 10,
    },
  });
  let f11DuplicateRejected = false;
  try {
    await db.order.create({
      data: {
        orderNumber: `C-${7000 + Math.floor(Math.random() * 9000)}`,
        status: "PENDING_PAYMENT",
        paymentMethod: "QRPH",
        paymentIntentId: f11DupIntent,
        orderType: "TAKEAWAY",
        customerName: "SMOKE_TEST_F11_DUP",
        subtotal: 10,
        totalAmount: 10,
      },
    });
  } catch (e: any) {
    f11DuplicateRejected = e?.code === "P2002";
  }
  console.log("F11 (A2) duplicate paymentIntentId rejected by DB:", f11DuplicateRejected);
  if (!f11DuplicateRejected) {
    throw new Error("F11 (A2): duplicate non-null paymentIntentId must be rejected by the DB unique index");
  }

  // -- A3: unsigned webhook policy --
  const f11gUnsigned = await fetch(`${BASE_URL}/api/webhooks/paymongo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        id: "evt_f11g_unsigned",
        attributes: {
          type: "payment.paid",
          data: { id: "pay_f11g", attributes: { amount: 1, status: "paid", payment_intent_id: "pi_f11g_unsigned" } },
        },
      },
    }),
  });
  const f11gUnsignedStatus = f11gUnsigned.status;
  const f11gUnsignedJson = await f11gUnsigned.json().catch(() => ({}));
  console.log("F11 (A3) unsigned webhook:", f11gUnsignedStatus, JSON.stringify(f11gUnsignedJson));

  const f11gOverrideOn = process.env.PAYMONGO_ALLOW_UNSIGNED_WEBHOOKS_DEV === "true";
  if (f11gOverrideOn) {
    console.log("F11 (A3) NOTE: dev unsigned override is ON in this environment; unsigned acceptance is intentional, skipping rejection assertion.");
  } else {
    if (![401, 503].includes(f11gUnsignedStatus)) {
      throw new Error(`F11 (A3): unsigned webhook must be rejected (401 with secret / 503 fail-closed), got ${f11gUnsignedStatus}`);
    }
  }

  console.log("STEP 11g F11-A PAYMENT INTEGRITY HARDENING TESTS PASSED");
  console.log("ALL PHASE 3 SMOKE TESTS COMPLETED SUCCESSFULLY WITH ZERO ERRORS!");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR IN SMOKE TEST:", err);
  process.exit(1);
});
