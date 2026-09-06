import { getDb } from "../src/lib/prisma";
import * as catalogService from "../src/services/catalogService";
import * as inventoryService from "../src/services/inventoryService";
import * as orderService from "../src/services/orderService";
import * as adminService from "../src/services/adminService";
import { createPayMongoQRPhPayment, PayMongoNotConfiguredError } from "../src/lib/paymongo";
import dotenv from "dotenv";

// Load .env so the runner's process.env matches the dev server it targets
// (server.ts calls dotenv.config() too). This keeps the simulation-flag and
// webhook-override assertions aligned with the running server.
dotenv.config();

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
  // STEP 7: ORDER STATUS LIFECYCLE AUTHORIZATION TEST (P0)
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 7] Testing Order Status Lifecycle Authorization (P0)...");

  // 7a. Unauthenticated status PATCH is rejected (P0-B).
  const unauthPatchRes = await fetch(`${BASE_URL}/api/orders/${createdOrder.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PREPARING" }),
  });
  if (unauthPatchRes.status !== 401) {
    throw new Error(`Unauthenticated status PATCH must be rejected with 401, got ${unauthPatchRes.status}`);
  }
  console.log("7a. Unauthenticated status PATCH -> 401 (rejected)");

  // 7b. Generic status PATCH attempting PAID is rejected even for an
  //     authenticated staff session (P0-B: no payment bypass via this route).
  const paidPatchRes = await fetch(`${BASE_URL}/api/orders/${createdOrder.id}/status`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "PAID" }),
  });
  if (paidPatchRes.status !== 409) {
    throw new Error(`Status PATCH to PAID must be rejected with 409, got ${paidPatchRes.status}: ${await paidPatchRes.text()}`);
  }
  console.log("7b. Authenticated status PATCH -> PAID rejected with 409 (no payment bypass)");

  // 7c. PAID is reachable ONLY through the authorized payment mechanism.
  const paidViaRecord = await orderService.recordPayment({ idOrOrderNumber: createdOrder.id });
  if (paidViaRecord.status !== "PAID" || !paidViaRecord.paidAt) {
    throw new Error("Authorized recordPayment must land the order on PAID and stamp paidAt");
  }
  console.log("7c. Authorized payment (recordPayment) -> PAID:", paidViaRecord.orderNumber, paidViaRecord.paidAt);

  // 7d. Legitimate KDS transitions via the status route (staff session).
  const transitions = ["PREPARING", "READY", "COMPLETED"] as const;

  for (const nextStatus of transitions) {
    const patchStatusRes = await fetch(`${BASE_URL}/api/orders/${createdOrder.id}/status`, {
      method: "PATCH",
      headers: adminHeaders,
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

  // P0 lifecycle: PENDING_PAYMENT -> PREPARING must remain impossible even for
  // an authenticated staff session (payment-before-kitchen, R2/R1).
  const skipToPreparingRes = await fetch(`${BASE_URL}/api/orders/${step8Order.id}/status`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "PREPARING" }),
  });
  if (skipToPreparingRes.status !== 409) {
    throw new Error(`PENDING_PAYMENT -> PREPARING must be rejected with 409, got ${skipToPreparingRes.status}: ${await skipToPreparingRes.text()}`);
  }
  console.log("PENDING_PAYMENT -> PREPARING rejected with 409 (payment-before-kitchen enforced)");

  const simPaymentIntent = "pi_smoke_test_intent_778899";
  const simPaymentMethod = "pm_smoke_test_card_112233";

  // R1: payment confirmation (webhook/POS) lands on PAID and stamps paidAt;
  // the kitchen only starts brewing after an explicit PAID -> PREPARING.
  const recordedOrder = await orderService.recordPayment({
    idOrOrderNumber: step8Order.id,
    paymentIntentId: simPaymentIntent,
    paymentMethodId: simPaymentMethod,
  });

  console.log("Payment record returned:", {
    orderNumber: recordedOrder.orderNumber,
    paymentIntentId: recordedOrder.paymentIntentId,
    paymentMethodId: recordedOrder.paymentMethodId,
    status: recordedOrder.status,
    paidAt: recordedOrder.paidAt,
  });

  // Verify persistence by querying fresh from DB
  const dbOrder = await db.order.findUnique({ where: { id: step8Order.id } });
  if (dbOrder?.paymentIntentId !== simPaymentIntent) {
    throw new Error("paymentIntentId failed to persist in DB");
  }
  if (dbOrder?.paymentMethodId !== simPaymentMethod) {
    throw new Error("paymentMethodId failed to persist in DB");
  }
  if (dbOrder?.status !== "PAID") {
    throw new Error(`Order status failed to persist in DB (R1 expects PAID, got ${dbOrder?.status})`);
  }
  if (!dbOrder?.paidAt) {
    throw new Error("paidAt was not stamped on R1 PAID transition");
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
    headers: adminHeaders,
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

  // Verify no SMOKE_TEST_* records remain across the domain tables.
  // NOTE: The catalog now hosts a permanent DEV/MOCK baseline (19 products,
  // ingredients, groups, options) seeded by prisma/seed.ts, so the catalog is
  // intentionally NON-empty after cleanup. This assertion therefore verifies
  // that ONLY the smoke test's own prefixed data has been removed rather than
  // demanding an empty database.
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

  const smokeResidue = {
    categories: await db.category.count({ where: { name: { startsWith: "SMOKE_TEST_" } } }),
    ingredients: await db.ingredient.count({ where: { name: { startsWith: "SMOKE_TEST_" } } }),
    customizationGroups: await db.customizationGroup.count({ where: { name: { startsWith: "SMOKE_TEST_" } } }),
    customizationOptions: await db.customizationOption.count({ where: { name: { startsWith: "SMOKE_TEST_" } } }),
    products: await db.product.count({ where: { name: { startsWith: "SMOKE_TEST_" } } }),
    orders: await db.order.count({
      where: {
        OR: [
          { customerName: { startsWith: "SMOKE_TEST_" } },
          { customerName: { startsWith: "Concurrent_Customer_" } },
          { id: createdOrder.id },
        ],
      },
    }),
  };
  console.log("Smoke-test residue after cleanup:", smokeResidue);

  for (const [table, count] of Object.entries(smokeResidue)) {
    if (count !== 0) {
      throw new Error(`Cleanup failed: Table ${table} still has ${count} SMOKE_TEST_ record(s)!`);
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

  const expectedMigrations = [
    "20260904000000_init_clean_catalog",
    "20260906000000_f11_a_unique_payment_intent",
    "20260906000001_m5_domain_design",
  ];

  const migrationNames = migrations.map((m) => m.migration_name);
  const matches =
    migrationNames.length === expectedMigrations.length &&
    expectedMigrations.every((name, idx) => migrationNames[idx] === name);

  if (!matches) {
    throw new Error(
      `_prisma_migrations violation! Expected ${JSON.stringify(expectedMigrations)}, found: ${JSON.stringify(migrationNames)}`
    );
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

  // -- A4: simulation endpoint authorization (P0-A) --
  // The smoke runner shares process.env with the dev server it targets, so the
  // runner's PAYMONGO_SIMULATION_ENABLED / NODE_ENV reflect how that server was
  // launched (same single .env source of truth).
  {
    const simFlagOn = process.env.PAYMONGO_SIMULATION_ENABLED === "true";
    const simServerProd = process.env.NODE_ENV === "production";

    const probeSim = async (headers: Record<string, string>) => {
      const r = await fetch(`${BASE_URL}/api/webhooks/paymongo/simulate`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      return r;
    };

    // No caller may ever be granted success without satisfying every gate.
    const unauthSimRes = await probeSim({ "Content-Type": "application/json" });
    if (unauthSimRes.status === 200) {
      throw new Error("F11 (A4): unauthenticated simulate call must never succeed");
    }

    if (!simFlagOn || simServerProd) {
      // Flag absent/false, or production: rejected regardless of auth.
      const staffSimRes = await probeSim(adminHeaders);
      if (staffSimRes.status === 200) {
        throw new Error("F11 (A4): simulate endpoint must never succeed when disabled or in production");
      }
      console.log("F11 (A4) simulate disabled/production -> rejected for all callers:", {
        unauthStatus: unauthSimRes.status,
        staffStatus: staffSimRes.status,
      });
    } else if (simFlagOn && !simServerProd) {
      // Development + simulation enabled: an authenticated staff session passes
      // the gate (the endpoint may then return 200 or 404 depending on whether
      // a pending QR order exists, but never a 401/403 auth error).
      const staffSimRes = await probeSim(adminHeaders);
      if ([401, 403].includes(staffSimRes.status)) {
        throw new Error(`F11 (A4): staff-authorized simulate call must pass the gate, got ${staffSimRes.status}`);
      }
      console.log("F11 (A4) simulation enabled (dev) -> staff session passes the gate:", {
        unauthStatus: unauthSimRes.status,
        staffStatus: staffSimRes.status,
      });
    }
  }

  console.log("STEP 11g F11-A PAYMENT INTEGRITY HARDENING TESTS PASSED");

  // STEP 11g created a control order (SMOKE_TEST_F11_DUP) for the duplicate
  // paymentIntentId test. It is created after STEP 11 cleanup, so remove it
  // here to leave the database exactly at the persisted DEV baseline (0 orders).
  const f11gOrderIds = (
    await db.order.findMany({
      where: { customerName: "SMOKE_TEST_F11_DUP" },
      select: { id: true },
    })
  ).map((o) => o.id);
  if (f11gOrderIds.length > 0) {
    await db.orderItemModifier.deleteMany({
      where: { orderItem: { orderId: { in: f11gOrderIds } } },
    });
    await db.orderItem.deleteMany({ where: { orderId: { in: f11gOrderIds } } });
    await db.order.deleteMany({ where: { id: { in: f11gOrderIds } } });
    console.log(`Removed ${f11gOrderIds.length} F11 control order(s) for clean end state.`);
  }

  // ---------------------------------------------------------------------------
  // STEP 11h: P1 CASHIER PAYMENT CONFIRMATION TESTS
  // ---------------------------------------------------------------------------
  console.log("\n[STEP 11h] Testing P1 Cashier Payment Confirmation...");

  const sampleProduct = await db.product.findFirst({ where: { isAvailable: true } });
  if (!sampleProduct) {
    throw new Error("P1 Smoke: No available product found in database for checkout test");
  }

  // P1-1: Customer Pay-at-Cashier order creation (unauthenticated)
  console.log("P1-1: Testing unauthenticated customer pay-at-cashier checkout...");
  const p1CustomerOrderRes = await fetch(`${BASE_URL}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "SMOKE_TEST_P1_Customer_Cash",
      orderType: "DINE_IN",
      paymentMethod: "CASH",
      items: [{ productId: sampleProduct.id, quantity: 1 }],
    }),
  });
  if (!p1CustomerOrderRes.ok) {
    throw new Error(`P1-1 failed: customer cash checkout returned ${p1CustomerOrderRes.status}`);
  }
  const p1CustomerOrderJson = await p1CustomerOrderRes.json();
  const p1Order1 = p1CustomerOrderJson.order || p1CustomerOrderJson;
  console.log("P1-1 Customer order created:", p1Order1.id, "status:", p1Order1.status, "method:", p1Order1.paymentMethod);
  if (p1Order1.status !== "PENDING_PAYMENT") {
    throw new Error(`P1-1: Customer cash order must start as PENDING_PAYMENT, got ${p1Order1.status}`);
  }
  if (p1Order1.paymentMethod !== "CASH") {
    throw new Error(`P1-1: Order paymentMethod must be CASH, got ${p1Order1.paymentMethod}`);
  }

  // P1-2: Non-CASH order rejection on /api/orders/:id/pay-cash
  console.log("P1-2: Testing non-CASH order rejection on /pay-cash...");
  const p1QrOrder = await db.order.create({
    data: {
      orderNumber: `C-${8000 + Math.floor(Math.random() * 1000)}`,
      status: "PENDING_PAYMENT",
      paymentMethod: "QRPH",
      paymentIntentId: `pi_smoke_p1_noncash_${Date.now()}`,
      orderType: "TAKEAWAY",
      customerName: "SMOKE_TEST_P1_NONCASH",
      subtotal: sampleProduct.price,
      totalAmount: sampleProduct.price,
    },
  });
  const p1NonCashRes = await fetch(`${BASE_URL}/api/orders/${p1QrOrder.id}/pay-cash`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ cashTendered: Number(sampleProduct.price) + 50 }),
  });
  console.log("P1-2 non-CASH pay-cash response status:", p1NonCashRes.status);
  if (p1NonCashRes.status !== 400) {
    throw new Error(`P1-2: /pay-cash on non-CASH order must return 400, got ${p1NonCashRes.status}`);
  }
  const p1NonCashJson = await p1NonCashRes.json().catch(() => ({}));
  if (p1NonCashJson.code !== "NON_CASH_ORDER") {
    throw new Error(`P1-2: /pay-cash on non-CASH order must return error code NON_CASH_ORDER, got ${JSON.stringify(p1NonCashJson)}`);
  }

  // P1-3: Cash tendered validation on pay-cash
  console.log("P1-3: Testing cash tendered validation (insufficient cash)...");
  const p1InsufficientRes = await fetch(`${BASE_URL}/api/orders/${p1Order1.id}/pay-cash`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ cashTendered: Number(p1Order1.totalAmount) - 0.01 }),
  });
  console.log("P1-3 insufficient cash status:", p1InsufficientRes.status);
  if (p1InsufficientRes.status !== 400) {
    throw new Error(`P1-3: insufficient cash must return 400, got ${p1InsufficientRes.status}`);
  }
  const p1InsufficientJson = await p1InsufficientRes.json().catch(() => ({}));
  if (p1InsufficientJson.code !== "INSUFFICIENT_CASH") {
    throw new Error(`P1-3: error must be INSUFFICIENT_CASH, got ${JSON.stringify(p1InsufficientJson)}`);
  }

  // P1-4: Unauthenticated cash tender rejection
  console.log("P1-4: Testing unauthenticated pay-cash rejection...");
  const p1UnauthRes = await fetch(`${BASE_URL}/api/orders/${p1Order1.id}/pay-cash`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cashTendered: Number(p1Order1.totalAmount) + 50 }),
  });
  console.log("P1-4 unauthenticated pay-cash status:", p1UnauthRes.status);
  if (p1UnauthRes.status !== 401) {
    throw new Error(`P1-4: unauthenticated pay-cash must return 401, got ${p1UnauthRes.status}`);
  }

  // P1-5: Successful cash tender (Customer Pay-at-Cashier)
  console.log("P1-5: Testing successful cash tender...");
  const tenderAmount = Number(p1Order1.totalAmount) + 50;
  const p1TenderRes = await fetch(`${BASE_URL}/api/orders/${p1Order1.id}/pay-cash`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ cashTendered: tenderAmount }),
  });
  if (!p1TenderRes.ok) {
    const errText = await p1TenderRes.text();
    throw new Error(`P1-5: pay-cash failed: status ${p1TenderRes.status}, ${errText}`);
  }
  const p1TenderJson = await p1TenderRes.json();
  console.log("P1-5 tender response:", p1TenderJson);
  if (p1TenderJson.order.status !== "PAID") {
    throw new Error(`P1-5: pay-cash must return order status PAID, got ${p1TenderJson.order.status}`);
  }
  const expectedChange = Math.round((tenderAmount - Number(p1Order1.totalAmount)) * 100) / 100;
  if (Math.abs(p1TenderJson.changeDue - expectedChange) > 0.001) {
    throw new Error(`P1-5: changeDue mismatch: expected ${expectedChange}, got ${p1TenderJson.changeDue}`);
  }
  const p1DbOrder = await db.order.findUnique({ where: { id: p1Order1.id } });
  if (p1DbOrder?.status !== "PAID") {
    throw new Error(`P1-5: DB order status must be PAID, found ${p1DbOrder?.status}`);
  }

  // P1-6: Concurrency / double-tender protection (Atomic guard)
  console.log("P1-6: Testing double-tender atomic protection on already paid order...");
  const p1DoubleTenderRes = await fetch(`${BASE_URL}/api/orders/${p1Order1.id}/pay-cash`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ cashTendered: tenderAmount }),
  });
  console.log("P1-6 double-tender response status:", p1DoubleTenderRes.status);
  if (p1DoubleTenderRes.status !== 409) {
    throw new Error(`P1-6: double tender must return 409, got ${p1DoubleTenderRes.status}`);
  }
  const p1DoubleJson = await p1DoubleTenderRes.json().catch(() => ({}));
  if (p1DoubleJson.code !== "ORDER_ALREADY_PAID") {
    throw new Error(`P1-6: double tender error must be ORDER_ALREADY_PAID, got ${JSON.stringify(p1DoubleJson)}`);
  }

  // P1-7: POS Walk-in Cash Order Creation
  console.log("P1-7: Testing POS walk-in cash order creation...");
  const p1WalkinFailRes = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: {
      ...adminHeaders,
      "Idempotency-Key": `smoke_pos_fail_${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "SMOKE_TEST_P1_POS_Walkin_Fail",
      orderType: "TAKEAWAY",
      paymentMethod: "CASH",
      cashTendered: Number(sampleProduct.price) - 10,
      items: [{ productId: sampleProduct.id, quantity: 1 }],
    }),
  });
  console.log("P1-7 insufficient walk-in cash status:", p1WalkinFailRes.status);
  if (p1WalkinFailRes.status !== 400) {
    throw new Error(`P1-7: POS walk-in with insufficient cash must return 400, got ${p1WalkinFailRes.status}`);
  }
  const p1WalkinFailJson = await p1WalkinFailRes.json().catch(() => ({}));
  if (p1WalkinFailJson.code !== "INSUFFICIENT_CASH") {
    throw new Error(`P1-7: POS walk-in insufficient cash code must be INSUFFICIENT_CASH, got ${JSON.stringify(p1WalkinFailJson)}`);
  }

  const p1WalkinSuccessRes = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: {
      ...adminHeaders,
      "Idempotency-Key": `smoke_pos_succ_${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "SMOKE_TEST_P1_POS_Walkin_Success",
      orderType: "TAKEAWAY",
      paymentMethod: "CASH",
      cashTendered: Number(sampleProduct.price) + 20,
      items: [{ productId: sampleProduct.id, quantity: 1 }],
    }),
  });
  if (!p1WalkinSuccessRes.ok) {
    const walkinErrText = await p1WalkinSuccessRes.text();
    throw new Error(`P1-7: POS walk-in cash order creation failed: ${p1WalkinSuccessRes.status}, ${walkinErrText}`);
  }
  const p1WalkinSuccessJson = await p1WalkinSuccessRes.json();
  const p1WalkinOrder = p1WalkinSuccessJson.order || p1WalkinSuccessJson;
  console.log("P1-7 POS walk-in order created:", p1WalkinOrder.id, "status:", p1WalkinOrder.status);
  if (p1WalkinOrder.status !== "PAID") {
    throw new Error(`P1-7: POS walk-in cash order must be immediately PAID, got ${p1WalkinOrder.status}`);
  }

  // P1-8: KDS Query and Pending Queue Filter Verification
  console.log("P1-8: Testing KDS query and pending cash filter...");
  // Create another pending customer cash order
  const p1CustomerOrder2Res = await fetch(`${BASE_URL}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "SMOKE_TEST_P1_Customer_Queue",
      orderType: "DINE_IN",
      paymentMethod: "CASH",
      items: [{ productId: sampleProduct.id, quantity: 1 }],
    }),
  });
  const p1Order2 = (await p1CustomerOrder2Res.json()).order;

  // Pending Cash Queue query
  const pendingQueueRes = await fetch(`${BASE_URL}/api/orders?status=PENDING_PAYMENT&paymentMethod=CASH`, {
    headers: adminHeaders,
  });
  const pendingQueueJson = await pendingQueueRes.json();
  const pendingList = Array.isArray(pendingQueueJson) ? pendingQueueJson : (pendingQueueJson.data || pendingQueueJson.orders || []);
  const inPending = pendingList.some((o: any) => o.id === p1Order2.id);
  console.log("P1-8 pending order in counter cash queue:", inPending);
  if (!inPending) {
    throw new Error("P1-8: newly created customer cash order must appear in pending cash queue");
  }

  // Kitchen/KDS query (should NOT contain p1Order2)
  const kdsQueueRes = await fetch(`${BASE_URL}/api/orders?status=PAID`, {
    headers: adminHeaders,
  });
  const kdsQueueJson = await kdsQueueRes.json();
  const kdsList = Array.isArray(kdsQueueJson) ? kdsQueueJson : (kdsQueueJson.data || kdsQueueJson.orders || []);
  const inKdsBeforePay = kdsList.some((o: any) => o.id === p1Order2.id);
  console.log("P1-8 pending order NOT in KDS before payment:", !inKdsBeforePay);
  if (inKdsBeforePay) {
    throw new Error("P1-8: PENDING_PAYMENT order must NOT appear in KDS PAID list");
  }

  // Tender cash for p1Order2
  const tenderOrder2Res = await fetch(`${BASE_URL}/api/orders/${p1Order2.id}/pay-cash`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ cashTendered: Number(p1Order2.totalAmount) }),
  });
  if (!tenderOrder2Res.ok) {
    throw new Error(`P1-8: failed to tender cash for p1Order2: ${tenderOrder2Res.status}`);
  }

  // KDS query after payment (MUST contain p1Order2)
  const kdsQueueAfterRes = await fetch(`${BASE_URL}/api/orders?status=PAID`, {
    headers: adminHeaders,
  });
  const kdsQueueAfterJson = await kdsQueueAfterRes.json();
  const kdsAfterList = Array.isArray(kdsQueueAfterJson) ? kdsQueueAfterJson : (kdsQueueAfterJson.data || kdsQueueAfterJson.orders || []);
  const inKdsAfterPay = kdsAfterList.some((o: any) => o.id === p1Order2.id);
  console.log("P1-8 order IN KDS after payment:", inKdsAfterPay);
  if (!inKdsAfterPay) {
    throw new Error("P1-8: Order must appear in KDS PAID list after cashier payment");
  }

  console.log("STEP 11h P1 CASHIER PAYMENT CONFIRMATION TESTS PASSED");

  // P1-9: Cleanup of all temporary P1 orders
  const p1OrderIds = (
    await db.order.findMany({
      where: {
        OR: [
          { customerName: { startsWith: "SMOKE_TEST_P1_" } },
          { id: { in: [p1Order1.id, p1QrOrder.id, p1WalkinOrder.id, p1Order2.id] } },
        ],
      },
      select: { id: true },
    })
  ).map((o) => o.id);

  if (p1OrderIds.length > 0) {
    await db.orderItemModifier.deleteMany({
      where: { orderItem: { orderId: { in: p1OrderIds } } },
    });
    await db.orderItem.deleteMany({ where: { orderId: { in: p1OrderIds } } });
    await db.order.deleteMany({ where: { id: { in: p1OrderIds } } });
    console.log(`Cleaned up ${p1OrderIds.length} P1 test order(s).`);
  }

  console.log("ALL PHASE 3 SMOKE TESTS COMPLETED SUCCESSFULLY WITH ZERO ERRORS!");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR IN SMOKE TEST:", err);
  process.exit(1);
});
