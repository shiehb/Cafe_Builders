import express, { Response } from "express";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import next from "next";
import dotenv from "dotenv";
import { createPayMongoQRPhPayment } from "./src/lib/paymongo";
import { Category, CustomizationGroupConfig, CustomizationOptionConfig, Order, OrderStatus, CheckoutPayload, Product, Ingredient } from "./src/types";
import { CATEGORIES, PRODUCTS } from "./src/data/menuData";
import { broadcastKitchenOrder, broadcastProductUpdate, getSupabaseClient, getSupabaseAdminClient } from "./src/lib/supabase";
import { getPrismaClient, seedDatabaseIfEmpty } from "./src/lib/prisma";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminPin,
  createSignedSessionToken,
  isRequestAuthorized,
} from "./src/lib/auth";
import { expressAdminAuthMiddleware } from "./src/serverMiddleware";

dotenv.config();

const app = express();
const PORT = 3000;
export { app };

// Initialize & seed database if empty
seedDatabaseIfEmpty().catch((err) => {
  console.warn("Prisma startup seeding skipped:", (err as Error)?.message || err);
});

// Parse cookies for secure HttpOnly admin_session validation
app.use(cookieParser());

// Capture raw body for webhook signature verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

const ingredientsStore: Map<string, Ingredient> = new Map([
  ["ingredient_matcha", { id: "ingredient_matcha", name: "Matcha", isAvailable: true, productIds: PRODUCTS.filter((p) => p.categoryId === "cat_matcha").map((p) => p.id) }],
  ["ingredient_milk", { id: "ingredient_milk", name: "Whole Milk", isAvailable: true, productIds: PRODUCTS.filter((p) => p.milkOptionsAvailable).map((p) => p.id) }],
  ["ingredient_oat_milk", { id: "ingredient_oat_milk", name: "Oat Milk", isAvailable: true, productIds: ["prod_emerald_mint", "prod_oat_flat_white"] }],
  ["ingredient_almond_milk", { id: "ingredient_almond_milk", name: "Almond Milk", isAvailable: true, productIds: [] }],
  ["ingredient_soy_milk", { id: "ingredient_soy_milk", name: "Soy Milk", isAvailable: true, productIds: [] }],
  ["ingredient_coffee_beans", { id: "ingredient_coffee_beans", name: "Coffee Beans", isAvailable: true, productIds: PRODUCTS.filter((p) => p.categoryId === "cat_coffee").map((p) => p.id) }],
]);
const categoriesStore = new Map<string, Category>(CATEGORIES.map((category) => [category.id, { ...category, isActive: true }]));
const customizationGroupsStore = new Map<string, CustomizationGroupConfig>([
  ["group_ice", { id: "group_ice", name: "Ice Level", selectionMode: "SINGLE", isActive: true }],
  ["group_sugar", { id: "group_sugar", name: "Sugar Level", selectionMode: "SINGLE", isActive: true }],
  ["group_milk", { id: "group_milk", name: "Milk Choices", selectionMode: "SINGLE", isActive: true }],
  ["group_addons", { id: "group_addons", name: "Add-ons", selectionMode: "MULTIPLE", isActive: true }],
]);
const customizationOptionsStore = new Map<string, CustomizationOptionConfig>([
  ["option_ice_less", { id: "option_ice_less", groupId: "group_ice", name: "Less", priceModifier: 0, isActive: true }],
  ["option_ice_regular", { id: "option_ice_regular", groupId: "group_ice", name: "Regular", priceModifier: 0, isActive: true }],
  ["option_ice_extra", { id: "option_ice_extra", groupId: "group_ice", name: "Extra", priceModifier: 0, isActive: true }],
  ["option_sugar_less", { id: "option_sugar_less", groupId: "group_sugar", name: "Less Sweet", priceModifier: 0, isActive: true }],
  ["option_sugar_regular", { id: "option_sugar_regular", groupId: "group_sugar", name: "Regular", priceModifier: 0, isActive: true }],
  ["option_sugar_more", { id: "option_sugar_more", groupId: "group_sugar", name: "More Sweet", priceModifier: 0, isActive: true }],
  ["option_milk_whole", { id: "option_milk_whole", groupId: "group_milk", name: "Whole Milk", priceModifier: 0, isActive: true }],
  ["option_milk_oat", { id: "option_milk_oat", groupId: "group_milk", name: "Oat Milk", priceModifier: 25, isActive: true }],
  ["option_milk_almond", { id: "option_milk_almond", groupId: "group_milk", name: "Almond Milk", priceModifier: 25, isActive: true }],
  ["option_milk_soy", { id: "option_milk_soy", groupId: "group_milk", name: "Soy Milk", priceModifier: 20, isActive: true }],
  ["option_addon_shot", { id: "option_addon_shot", groupId: "group_addons", name: "Extra Shot", priceModifier: 30, isActive: true }],
  ["option_addon_jelly", { id: "option_addon_jelly", groupId: "group_addons", name: "Coffee Jelly", priceModifier: 25, isActive: true }],
  ["option_addon_vanilla", { id: "option_addon_vanilla", groupId: "group_addons", name: "Vanilla Syrup", priceModifier: 20, isActive: true }],
]);

function recomputeProductAvailability(product: Product): Product {
  const linked = (product.ingredientIds || []).map((id) => ingredientsStore.get(id));
  const ingredientUnavailable = linked.find((ingredient) => ingredient && !ingredient.isAvailable);
  product.isAvailable = product.manualAvailability !== false && !ingredientUnavailable;
  return product;
}

function recomputeAllProductAvailability() {
  for (const product of productsStore.values()) recomputeProductAvailability(product);
}

// In-memory database stores with persistence during server lifecycle
let orderSequence = 1;
const ordersStore: Map<string, Order> = new Map();
const orderIdempotencyStore: Map<string, string> = new Map();

// In-memory products store initialized from static catalog
const productsStore: Map<string, Product> = new Map(
  PRODUCTS.map((p) => [p.id, {
    ...p,
    ingredientIds: p.ingredientIds || [
      ...(p.categoryId === "cat_matcha" ? ["ingredient_matcha"] : []),
      ...(p.categoryId === "cat_coffee" ? ["ingredient_coffee_beans"] : []),
      ...(p.milkOptionsAvailable ? ["ingredient_milk", "ingredient_oat_milk"] : []),
    ],
  }])
);

// SSE Connected clients for instant low-latency real-time updates
const sseClients: Set<Response> = new Set();

/**
 * Broadcasts an order event to all active SSE client streams and Supabase Realtime
 */
function broadcastRealtime(
  type: "order_created" | "order_paid" | "order_status_updated",
  order: Order
) {
  // 1. Broadcast to Supabase Realtime channel `kitchen-orders`
  broadcastKitchenOrder(type, order).catch((err) =>
    console.warn("Supabase Realtime broadcast warning:", err)
  );

  // 2. Broadcast to connected SSE clients
  const payload = JSON.stringify({
    type,
    order,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    timestamp: new Date().toISOString(),
  });

  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

/**
 * Broadcasts a product inventory update event to all active SSE streams and Supabase Realtime
 */
function broadcastProductRealtime(type: "product_updated", product: Product) {
  // 1. Broadcast to Supabase Realtime channel `menu-updates`
  broadcastProductUpdate(product).catch((err) =>
    console.warn("Supabase Realtime product broadcast warning:", err)
  );

  // 2. Broadcast to connected SSE clients
  const payload = JSON.stringify({
    type,
    product,
    timestamp: new Date().toISOString(),
  });

  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Helper to format order number
function getNextOrderNumber(): string {
  const num = String(orderSequence++).padStart(3, "0");
  return `C-${num}`;
}

// 1. Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "Cafe Web Ordering App (Admin & Inventory Security System)",
    time: new Date().toISOString(),
    ordersCount: ordersStore.size,
    productsCount: productsStore.size,
    connectedClients: sseClients.size,
  });
});

// 2. Real-time Server-Sent Events stream for Kitchen Display & Live Customer Tracking
app.get("/api/realtime/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  res.write(`data: ${JSON.stringify({ type: "ping", timestamp: new Date().toISOString() })}\n\n`);

  sseClients.add(res);

  req.on("close", () => {
    sseClients.delete(res);
  });
});

// ==============================================================================
// SERVER-SIDE AUTH & PIN GUARD ENDPOINTS
// ==============================================================================

/**
 * POST /api/auth/login
 * Verifies 4-digit PIN against server-side process.env.ADMIN_PIN (never exposed to browser)
 * On success, issues a cryptographically signed, HttpOnly, SameSite cookie: `admin_session`
 */
app.post("/api/auth/login", (req, res) => {
  const { pin, role = "admin" } = req.body || {};

  if (!pin || typeof pin !== "string") {
    return res.status(400).json({ success: false, error: "4-digit PIN is required" });
  }

  const isValid = verifyAdminPin(pin, role);

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: "Incorrect PIN. Access denied.",
      code: "INVALID_CREDENTIALS",
    });
  }

  // Generate signed session token with 24h validity
  const sessionToken = createSignedSessionToken(role, 24);

  // Set HttpOnly, Secure session cookie (tamper-proof)
  res.cookie(ADMIN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: "/",
  });

  return res.json({
    success: true,
    role,
    message: "Admin session authenticated successfully with HttpOnly cookie",
  });
});

/**
 * GET /api/auth/session
 * Checks whether the current caller presents a valid HttpOnly `admin_session`
 */
app.get("/api/auth/session", (req, res) => {
  const authorized = isRequestAuthorized(req);
  res.json({
    authenticated: authorized,
    role: authorized ? "admin" : null,
  });
});

/**
 * POST /api/auth/logout
 * Clears the HttpOnly `admin_session` cookie
 */
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
  res.json({ success: true, message: "Admin session cleared successfully" });
});

// ==============================================================================
// PUBLIC MENU & PRODUCT ENDPOINTS (RLS COMPLIANT)
// ==============================================================================

// Categories API
app.get("/api/categories", (_req, res) => {
  res.json({ data: Array.from(categoriesStore.values()).filter((category) => category.isActive && !category.isArchived) });
});

/**
 * Public Customer Products API
 * In compliance with RLS constraints:
 * Reads from public store or Supabase public anon client.
 * Returns products with current isAvailable status. If availableOnly query is set,
 * returns only `isAvailable === true` items.
 */
app.get("/api/products", async (req, res) => {
  const categoryId = req.query.category as string;
  const availableOnly = req.query.availableOnly === "true";

  // Check Supabase public anon client if available
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      let query = supabase.from("products").select("*");
      // Public customer RLS policy: only is_available = true
      if (availableOnly) {
        query = query.eq("is_available", true);
      }
      if (categoryId && categoryId !== "all") {
        query = query.eq("category_id", categoryId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return res.json({ data });
      }
    } catch (err) {
      console.warn("Supabase public products read error, falling back to local store:", err);
    }
  }

  recomputeAllProductAvailability();
  let list = Array.from(productsStore.values()).filter((p) => !p.isArchived);

  if (availableOnly) {
    list = list.filter((p) => p.isAvailable === true);
  }

  if (categoryId && categoryId !== "all") {
    list = list.filter((p) => p.categoryId === categoryId || p.categoryName === categoryId);
  }

  res.json({ data: list });
});

// Single Product Public Endpoint
app.get("/api/products/:id", (req, res) => {
  const { id } = req.params;
  const product = productsStore.get(id);
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }
  res.json({ product: recomputeProductAvailability(product) });
});

// Canonical catalog contract consumed by Customer and POS. The current in-memory
// catalog is normalized here so both clients receive the same availability shape.
app.get("/api/catalog", (req, res) => {
    recomputeAllProductAvailability();
  const availableOnly = req.query.availableOnly === "true";
  const data = Array.from(productsStore.values())
    .filter((product) => !product.isArchived && (!availableOnly || product.isAvailable))
    .map((product) => ({
      ...product,
      basePrice: product.price,
      productType: product.categoryName?.toLowerCase().includes("food") || product.categoryName?.toLowerCase().includes("pastr") ? "FOOD" : "BEVERAGE",
      categories: [{ id: product.categoryId, name: product.categoryName || product.categoryId }],
      customizationGroups: (product.enabledCustomizationGroups || []).map((group) => ({
        id: `group_${group}`,
        name: group === "ice" ? "Ice Level" : group === "sugar" ? "Sugar Level" : group === "milk" ? "Milk Choices" : "Add-ons",
        selectionMode: group === "addons" ? "MULTIPLE" : "SINGLE",
        required: group !== "addons",
        options: group === "milk" ? product.milkOptions || [] : group === "addons" ? product.addonOptions || [] : [],
      })),
      availabilityReason: product.isAvailable ? null : "MANUAL_UNAVAILABLE",
    }));
  res.json({ data });
});

// ==============================================================================
// PROTECTED ADMIN INVENTORY & PRODUCT MANAGEMENT ENDPOINTS
// Enforced by expressAdminAuthMiddleware (Valid HttpOnly admin_session required)
// ==============================================================================

app.use(expressAdminAuthMiddleware);

/**
 * GET /api/admin/products
 * Returns all products with complete inventory & availability attributes
 */
app.get("/api/admin/products", async (_req, res) => {
  try {
    // If Supabase Admin client exists, query directly using service_role
    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from("products")
        .select("*")
        .order("name", { ascending: true });
      if (!error && data && data.length > 0) {
        return res.json({ data });
      }
    }
  } catch (err) {
    console.warn("Supabase admin fetch products fallback:", err);
  }

  recomputeAllProductAvailability();
  const list = Array.from(productsStore.values());
  res.json({ data: list });
});

app.get("/api/admin/ingredients", (_req, res) => {
  res.json({ data: Array.from(ingredientsStore.values()).map((ingredient) => ({
    ...ingredient,
    productIds: Array.from(productsStore.values()).filter((product) => product.ingredientIds?.includes(ingredient.id)).map((product) => product.id),
  })) });
});

app.get("/api/admin/categories", (_req, res) => res.json({ data: Array.from(categoriesStore.values()) }));
app.post("/api/admin/categories", (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Category name is required" });
  const id = `cat_${Date.now()}`;
  const category: Category = { id, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), sortOrder: Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : categoriesStore.size, productType: req.body?.productType === "FOOD" ? "FOOD" : "BEVERAGE", isActive: req.body?.isActive !== false };
  categoriesStore.set(id, category);
  return res.status(201).json({ success: true, category });
});
app.patch("/api/admin/categories/:id", (req, res) => {
  const category = categoriesStore.get(req.params.id);
  if (!category) return res.status(404).json({ error: "Category not found" });
  if (typeof req.body?.name === "string" && req.body.name.trim()) category.name = req.body.name.trim();
  if (req.body?.productType === "BEVERAGE" || req.body?.productType === "FOOD") category.productType = req.body.productType;
  if (Number.isFinite(Number(req.body?.sortOrder))) category.sortOrder = Number(req.body.sortOrder);
  if (typeof req.body?.isArchived === "boolean") category.isArchived = req.body.isArchived;
  if (typeof req.body?.isActive === "boolean") category.isActive = req.body.isActive;
  return res.json({ success: true, category });
});
app.delete("/api/admin/categories/:id", (req, res) => {
  const category = categoriesStore.get(req.params.id);
  if (!category) return res.status(404).json({ error: "Category not found" });
  category.isArchived = true;
  category.isActive = false;
  return res.json({ success: true, category });
});

app.get("/api/admin/customization-groups", (_req, res) => res.json({ data: Array.from(customizationGroupsStore.values()) }));
app.post("/api/admin/customization-groups", (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Customization group name is required" });
  const id = `group_${Date.now()}`;
  const group: CustomizationGroupConfig = { id, name, selectionMode: req.body?.selectionMode === "MULTIPLE" ? "MULTIPLE" : "SINGLE", isRequired: req.body?.isRequired === true, sortOrder: Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : customizationGroupsStore.size, isActive: req.body?.isActive !== false };
  customizationGroupsStore.set(id, group);
  return res.status(201).json({ success: true, group });
});
app.patch("/api/admin/customization-groups/:id", (req, res) => {
  const group = customizationGroupsStore.get(req.params.id);
  if (!group) return res.status(404).json({ error: "Customization group not found" });
  if (typeof req.body?.name === "string" && req.body.name.trim()) group.name = req.body.name.trim();
  if (req.body?.selectionMode === "SINGLE" || req.body?.selectionMode === "MULTIPLE") group.selectionMode = req.body.selectionMode;
  if (typeof req.body?.isRequired === "boolean") group.isRequired = req.body.isRequired;
  if (Number.isFinite(Number(req.body?.sortOrder))) group.sortOrder = Number(req.body.sortOrder);
  if (typeof req.body?.isArchived === "boolean") group.isArchived = req.body.isArchived;
  if (typeof req.body?.isActive === "boolean") group.isActive = req.body.isActive;
  return res.json({ success: true, group });
});
app.delete("/api/admin/customization-groups/:id", (req, res) => {
  const group = customizationGroupsStore.get(req.params.id);
  if (!group) return res.status(404).json({ error: "Customization group not found" });
  group.isArchived = true;
  group.isActive = false;
  return res.json({ success: true, group });
});

app.get("/api/admin/customization-options", (_req, res) => res.json({ data: Array.from(customizationOptionsStore.values()) }));
app.post("/api/admin/customization-options", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const groupId = String(req.body?.groupId || "");
  if (!name || !customizationGroupsStore.has(groupId)) return res.status(400).json({ error: "Option name and group are required" });
  const id = `option_${Date.now()}`;
  const option: CustomizationOptionConfig = { id, groupId, name, priceModifier: Number(req.body?.priceModifier) || 0, isActive: true };
  customizationOptionsStore.set(id, option);
  return res.status(201).json({ success: true, option });
});
app.patch("/api/admin/customization-options/:id", (req, res) => {
  const option = customizationOptionsStore.get(req.params.id);
  if (!option) return res.status(404).json({ error: "Customization option not found" });
  if (typeof req.body?.name === "string" && req.body.name.trim()) option.name = req.body.name.trim();
  if (typeof req.body?.priceModifier === "number" && req.body.priceModifier >= 0) option.priceModifier = req.body.priceModifier;
  if (typeof req.body?.isActive === "boolean") option.isActive = req.body.isActive;
  if (typeof req.body?.isArchived === "boolean") option.isArchived = req.body.isArchived;
  return res.json({ success: true, option });
});
app.delete("/api/admin/customization-options/:id", (req, res) => {
  const option = customizationOptionsStore.get(req.params.id);
  if (!option) return res.status(404).json({ error: "Customization option not found" });
  option.isArchived = true;
  option.isActive = false;
  return res.json({ success: true, option });
});

app.post("/api/admin/ingredients", (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Ingredient name is required" });
  const id = `ingredient_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const ingredient: Ingredient = { id, name, isAvailable: req.body?.isAvailable !== false, productIds: [] };
  ingredientsStore.set(id, ingredient);
  return res.status(201).json({ success: true, ingredient });
});

app.patch("/api/admin/ingredients/:id", (req, res) => {
  const ingredient = ingredientsStore.get(req.params.id);
  if (!ingredient) return res.status(404).json({ error: "Ingredient not found" });
  if (typeof req.body?.name === "string" && req.body.name.trim()) ingredient.name = req.body.name.trim();
  if (typeof req.body?.isAvailable === "boolean") ingredient.isAvailable = req.body.isAvailable;
  if (typeof req.body?.isArchived === "boolean") ingredient.isArchived = req.body.isArchived;
  const affectedProducts: string[] = [];
  recomputeAllProductAvailability();
  for (const product of productsStore.values()) {
    if (product.ingredientIds?.includes(ingredient.id)) {
      affectedProducts.push(product.id);
      broadcastProductRealtime("product_updated", product);
    }
  }
  return res.json({ success: true, ingredient, affectedProducts, affectedOptions: [] });
});

app.delete("/api/admin/ingredients/:id", (req, res) => {
  const ingredient = ingredientsStore.get(req.params.id);
  if (!ingredient) return res.status(404).json({ error: "Ingredient not found" });
  ingredient.isArchived = true;
  ingredient.isAvailable = false;
  recomputeAllProductAvailability();
  return res.json({ success: true, ingredient });
});

/**
 * POST /api/admin/products
 * Creates a new product in the catalog and broadcasts update
 */
app.post("/api/admin/products", async (req, res) => {
  try {
    const {
      name,
      categoryId,
      categoryIds = [],
      categoryName,
      productType,
      price,
      description = "",
      imageUrl,
      popular = false,
      isAvailable = true,
      sweetnessAdjustable = true,
      enabledCustomizationGroups,
      milkOptions,
      addonOptions,
      allowedOptionIds,
      tags = [],
      ingredientIds = [],
      isArchived = false,
    } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Product name is required" });
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: "Valid price in PHP is required" });
    }

    const newId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const matchedCategory = CATEGORIES.find((c) => c.id === categoryId);

    const newProduct: Product = {
      id: newId,
      name: name.trim(),
      categoryId: categoryId || (matchedCategory ? matchedCategory.id : "cat_coffee"),
      categoryIds: Array.isArray(categoryIds) && categoryIds.length ? categoryIds : [categoryId || (matchedCategory ? matchedCategory.id : "cat_coffee")],
      categoryName: categoryName || (matchedCategory ? matchedCategory.name : "Artisan Coffee"),
      productType: productType === "FOOD" ? "FOOD" : "BEVERAGE",
      price: numericPrice,
      description: description?.trim() || "",
      imageUrl: imageUrl?.trim() || "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
      popular: Boolean(popular),
      isAvailable: isAvailable !== false,
      manualAvailability: isAvailable !== false,
      sweetnessAdjustable: sweetnessAdjustable !== false,
      enabledCustomizationGroups: Array.isArray(enabledCustomizationGroups) ? enabledCustomizationGroups : undefined,
      milkOptions: Array.isArray(milkOptions) ? milkOptions : undefined,
      addonOptions: Array.isArray(addonOptions) ? addonOptions : undefined,
      allowedOptionIds: Array.isArray(allowedOptionIds) ? allowedOptionIds.filter((id: unknown) => customizationOptionsStore.has(String(id))) : [],
      tags: Array.isArray(tags) ? tags : ["Handcrafted", "Featured"],
      ingredientIds: Array.isArray(ingredientIds) ? ingredientIds.filter((id: unknown) => ingredientsStore.has(String(id))) : [],
      isArchived: Boolean(isArchived),
    };

    productsStore.set(newId, newProduct);

    // Sync to Supabase if configured
    try {
      const supabaseAdmin = getSupabaseAdminClient();
      if (supabaseAdmin) {
        await supabaseAdmin.from("products").insert([
          {
            id: newProduct.id,
            name: newProduct.name,
            category_id: newProduct.categoryId,
            price: newProduct.price,
            description: newProduct.description,
            image_url: newProduct.imageUrl,
            popular: newProduct.popular,
            is_available: newProduct.isAvailable,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (dbErr) {
      console.warn("Supabase admin insert warning:", dbErr);
    }

    // Broadcast realtime update
    broadcastProductRealtime("product_updated", newProduct);

    return res.status(201).json({
      success: true,
      product: newProduct,
      message: `Product "${newProduct.name}" created successfully`,
    });
  } catch (error: any) {
    console.error("Failed to create product:", error);
    return res.status(500).json({ error: error?.message || "Failed to create product" });
  }
});

/**
 * DELETE /api/admin/products/:id
 * Permanently removes product from catalog
 */
app.delete("/api/admin/products/:id", async (req, res) => {
  const { id } = req.params;
  const product = productsStore.get(id);
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  productsStore.delete(id);

  // Sync to Supabase if configured
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin) {
      await supabaseAdmin.from("products").delete().eq("id", id);
    }
  } catch (dbErr) {
    console.warn("Supabase admin delete warning:", dbErr);
  }

  // Broadcast deletion / update (availability false)
  broadcastProductRealtime("product_updated", { ...product, isAvailable: false });

  return res.json({
    success: true,
    message: `Product "${product.name}" deleted successfully`,
    id,
  });
});

/**
 * PATCH /api/admin/products/:id
 * Updates product availability (In Stock / Sold Out), price, description, popular badge
 * Broadcasts instant updates to connected clients via SSE & Supabase Realtime
 */
app.patch("/api/admin/products/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  const product = productsStore.get(id);
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  // Apply updates
  if (typeof updates.isAvailable === "boolean") {
    product.manualAvailability = updates.isAvailable;
  }
  if (typeof updates.price === "number" && !isNaN(updates.price) && updates.price >= 0) {
    product.price = updates.price;
  }
  if (typeof updates.description === "string") {
    product.description = updates.description.trim();
  }
  if (typeof updates.popular === "boolean") {
    product.popular = updates.popular;
  }
  if (typeof updates.name === "string" && updates.name.trim()) {
    product.name = updates.name.trim();
  }
  if (updates.productType === "BEVERAGE" || updates.productType === "FOOD") product.productType = updates.productType;
  if (Array.isArray(updates.categoryIds) && updates.categoryIds.length) {
    product.categoryIds = updates.categoryIds;
    product.categoryId = String(updates.categoryIds[0]);
    product.categoryName = categoriesStore.get(product.categoryId)?.name || product.categoryName;
  }
  if (Array.isArray(updates.enabledCustomizationGroups)) {
    product.enabledCustomizationGroups = updates.enabledCustomizationGroups.filter(
      (group: unknown) => ["ice", "sugar", "milk", "addons"].includes(String(group))
    );
  }
  if (Array.isArray(updates.milkOptions)) product.milkOptions = updates.milkOptions;
  if (Array.isArray(updates.addonOptions)) product.addonOptions = updates.addonOptions;
  if (Array.isArray(updates.allowedOptionIds)) product.allowedOptionIds = updates.allowedOptionIds.map(String);
  if (Array.isArray(updates.ingredientIds)) {
    product.ingredientIds = updates.ingredientIds.filter((ingredientId: unknown) => ingredientsStore.has(String(ingredientId)));
  }
  if (typeof updates.isArchived === "boolean") product.isArchived = updates.isArchived;

  recomputeProductAvailability(product);
  productsStore.set(id, product);

  // Sync to Supabase table using Service Role key (RLS bypass on authenticated server)
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin) {
      await supabaseAdmin
        .from("products")
        .update({
          is_available: product.isAvailable,
          price: product.price,
          description: product.description,
          popular: product.popular,
          name: product.name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }
  } catch (err) {
    console.warn("Supabase admin write warning:", err);
  }

  // Broadcast realtime update to kitchen KDS, POS, and public customer storefront
  broadcastProductRealtime("product_updated", product);

  return res.json({
    success: true,
    product,
    message: `Updated ${product.name} (${product.isAvailable ? "In Stock" : "86'd / Sold Out"})`,
  });
});


// 4. Checkout API (PayMongo Dynamic QR Ph / Cash at Counter)
app.post("/api/checkout", async (req, res) => {
  try {
    const body = req.body as CheckoutPayload;
    const { items, customerName, orderType = "DINE_IN", paymentMethod, notes } = body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty. Please add items before checking out." });
    }

    // Cart data is a client-side snapshot. Re-check the canonical catalog immediately
    // before payment so an item sold out after it was added can never be submitted.
    const unavailable = items
      .map((item) => ({ item, product: productsStore.get(item.productId) }))
      .filter(({ product }) => !product || product.isAvailable === false);
    if (unavailable.length > 0) {
      return res.status(409).json({
        success: false,
        code: "PRODUCT_UNAVAILABLE",
        error: `Unavailable item: ${unavailable[0].item.productName || "This product"}. Please remove it or choose a replacement.`,
        message: `Unavailable item: ${unavailable[0].item.productName || "This product"}. Please remove it or choose a replacement.`,
        unavailableProductIds: unavailable.map(({ item }) => item.productId),
      });
    }
    const invalidQuantity = items.find((item) => !Number.isInteger(item.quantity) || item.quantity < 1);
    if (invalidQuantity) {
      return res.status(400).json({ error: "Each cart item must have a valid quantity." });
    }

    const subtotal = items.reduce((sum, it) => sum + (it.subtotal || it.unitPrice * it.quantity), 0);
    const discount = Math.max(0, Number(body.discount) || 0);
    const serviceFee = 0;
    const totalAmount = Math.max(0, Math.round((subtotal - discount + serviceFee) * 100) / 100);

    if (paymentMethod === "CASH" && body.paymentStatus === "PAID" && Number(body.cashTendered || 0) < totalAmount) {
      return res.status(400).json({ success: false, code: "INSUFFICIENT_CASH", message: "Cash tendered is less than the order total." });
    }

    const orderNumber = getNextOrderNumber();
    let qrCodeUrl: string | null = null;
    let paymentIntentId: string | null = null;
    let paymentMethodId: string | null = null;

    if (paymentMethod === "QRPH") {
      const qrRes = await createPayMongoQRPhPayment(
        totalAmount,
        orderNumber,
        `Artisan Cafe - Order ${orderNumber}`
      );
      qrCodeUrl = qrRes.qrImageUrl;
      paymentIntentId = qrRes.paymentIntentId;
      paymentMethodId = qrRes.paymentMethodId;
    }

    const now = new Date().toISOString();
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const orderNotes = [
      notes,
      body.promoCode ? `Promo: ${body.promoCode} (-₱${discount.toFixed(2)})` : null,
    ]
      .filter(Boolean)
      .join(" • ");

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      status: paymentMethod === "CASH" && body.paymentStatus === "PAID" ? "PAID" : "PENDING_PAYMENT",
      paymentMethod,
      paymentIntentId,
      paymentMethodId,
      qrCodeUrl,
      customerName: customerName?.trim() ? customerName.trim() : "Guest",
      orderType: orderType || "DINE_IN",
      notes: orderNotes || null,
      subtotal,
      serviceFee,
      totalAmount,
      items: items.map((item, index) => ({
        id: `item_${index + 1}`,
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
        customizations: item.customizations,
        notes: item.notes,
      })),
      createdAt: now,
      updatedAt: now,
      estimatedReadyTime: "7 - 10 mins",
    };

    ordersStore.set(orderId, newOrder);

    // Persist to Prisma database if configured
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.order.create({
          data: {
            id: orderId,
            orderNumber,
            status: newOrder.status,
            paymentMethod,
            paymentIntentId,
            paymentMethodId,
            qrCodeUrl,
            customerName: newOrder.customerName,
            orderType,
            notes,
            subtotal,
            serviceFee,
            totalAmount,
            items: {
              create: items.map((it) => ({
                productName: it.productName,
                unitPrice: it.unitPrice,
                quantity: it.quantity,
                subtotal: it.subtotal,
                customizations: it.customizations ? JSON.parse(JSON.stringify(it.customizations)) : undefined,
                notes: it.notes,
              })),
            },
          },
        });
      } catch (dbErr) {
        console.warn("⚠️ Prisma order persistence warning (using active store):", (dbErr as Error)?.message || dbErr);
      }
    }

    // Broadcast new order to Kitchen Display System (KDS)
    broadcastRealtime("order_created", newOrder);

    return res.status(201).json({
      success: true,
      orderNumber,
      order: newOrder,
      qrCodeUrl,
      paymentIntentId,
      message:
        paymentMethod === "QRPH"
          ? "Dynamic QR Ph generated. Scan using any QR Ph compliant app."
          : `Order #${orderNumber} registered. Please proceed to payment counter.`,
    });
  } catch (error: any) {
    console.error("Error in /api/checkout:", error);
    return res.status(500).json({
      error: error?.message || "Internal server error during checkout",
    });
  }
});
// 5. Get all orders (for staff / KDS dashboard)
// Canonical order contract. It delegates to the established checkout pipeline so
// availability, pricing, payment, persistence, and KDS broadcasting stay identical.
app.post("/api/orders", async (req, res) => {
  try {
    const idempotencyKey = req.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key header is required." });
    }
    const existingOrderId = orderIdempotencyStore.get(idempotencyKey);
    if (existingOrderId) {
      const existingOrder = ordersStore.get(existingOrderId);
      return res.status(409).json({ success: false, code: "DUPLICATE_REQUEST", message: "This order request has already been processed.", order: existingOrder });
    }
    const upstream = await fetch(`http://127.0.0.1:${PORT}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const payload = await upstream.json();
    if (upstream.ok && payload.order?.id) orderIdempotencyStore.set(idempotencyKey, payload.order.id);
    return res.status(upstream.status).json(payload);
  } catch (error) {
    return res.status(502).json({ success: false, code: "ORDER_SERVICE_UNAVAILABLE", message: "Order service is unavailable." });
  }
});

app.get("/api/orders", (_req, res) => {
  const list = Array.from(ordersStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json({ data: list });
});

// 6. Get single order by ID or orderNumber
app.get("/api/orders/:idOrNumber", (req, res) => {
  const { idOrNumber } = req.params;
  const order =
    ordersStore.get(idOrNumber) ||
    Array.from(ordersStore.values()).find(
      (o) => o.orderNumber === idOrNumber || o.id === idOrNumber
    );

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  res.json({ data: order });
});

// 7. Update order status (Staff / KDS buttons: "Mark as Ready" -> READY, "Complete Order" -> COMPLETED)
app.patch("/api/orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: OrderStatus };

  const order =
    ordersStore.get(id) ||
    Array.from(ordersStore.values()).find(
      (o) => o.orderNumber === id || o.id === id
    );

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  const validStatuses: OrderStatus[] = [
    "PENDING_PAYMENT",
    "PAID",
    "PREPARING",
    "READY",
    "COMPLETED",
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status provided" });
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  ordersStore.set(order.id, order);

  // Broadcast status update to Kitchen KDS and Live Customer Receipt in real-time
  broadcastRealtime("order_status_updated", order);

  res.json({
    success: true,
    order,
    message: `Order ${order.orderNumber} status updated to ${status}`,
  });
});

/**
 * PayMongo Signature Verification Helper
 */
function verifySignature(
  rawBody: string,
  sigHeader: string | undefined,
  secretKey: string | undefined
): boolean {
  if (!secretKey) return true; // development / sandbox mode
  if (!sigHeader) return false;

  try {
    const parts = sigHeader.split(",").reduce((acc, part) => {
      const [k, v] = part.split("=");
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {} as Record<string, string>);

    const timestamp = parts.t;
    const signature = parts.li || parts.te;

    if (!timestamp || !signature) return false;

    const payloadToSign = `${timestamp}.${rawBody}`;
    const expectedSig = crypto
      .createHmac("sha256", secretKey)
      .update(payloadToSign)
      .digest("hex");

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
  } catch (e) {
    console.warn("Signature verification error:", e);
    return false;
  }
}

// 8. PayMongo Webhook API Endpoint: /api/webhooks/paymongo & /api/paymongo-webhook
const handlePayMongoWebhook = (req: any, res: Response) => {
  const signatureHeader = req.headers["paymongo-signature"] as string | undefined;
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET_KEY;
  const rawBody = req.rawBody || JSON.stringify(req.body);

  if (webhookSecret && !verifySignature(rawBody, signatureHeader, webhookSecret)) {
    console.warn("[PayMongo Webhook] Invalid webhook signature rejected");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = req.body;
  const eventType = event?.data?.attributes?.type;
  const resource = event?.data?.attributes?.data;

  console.log(`[PayMongo Webhook] Processing event type: ${eventType}`);

  if (eventType === "payment.paid" || eventType === "payment_intent.succeeded") {
    const paymentIntentId = resource?.attributes?.payment_intent_id || resource?.id;
    if (paymentIntentId) {
      let matchedOrder: Order | null = null;

      for (const [id, order] of ordersStore.entries()) {
        if (order.paymentIntentId === paymentIntentId || order.id === paymentIntentId) {
          // As required: Transition from PENDING_PAYMENT to PREPARING
          order.status = "PREPARING";
          order.updatedAt = new Date().toISOString();
          ordersStore.set(id, order);
          matchedOrder = order;
          break;
        }
      }

      if (matchedOrder) {
        console.log(
          `[PayMongo Webhook] Order ${matchedOrder.orderNumber} successfully updated to PREPARING`
        );
        // Broadcast via Supabase Realtime and SSE on channel kitchen-orders with event order_paid
        broadcastRealtime("order_paid", matchedOrder);

        return res.json({
          success: true,
          matchedOrderNumber: matchedOrder.orderNumber,
          status: matchedOrder.status,
          message: "Order updated to PREPARING and broadcast to Kitchen KDS",
        });
      }
    }
  }

  res.json({ received: true });
};

app.post("/api/webhooks/paymongo", handlePayMongoWebhook);
app.post("/api/paymongo-webhook", handlePayMongoWebhook);

// 9. Simulation Endpoint: /api/webhooks/paymongo/simulate, /api/simulate-webhook, /api/simulate/webhook-payment
// Allows one-click testing of PayMongo payment.paid webhook in sandbox preview
const handleSimulateWebhook = (req: any, res: Response) => {
  const { orderId, paymentIntentId } = req.body || {};

  let targetOrder: Order | undefined = undefined;

  if (orderId) {
    targetOrder = ordersStore.get(orderId);
  }
  if (!targetOrder && paymentIntentId) {
    targetOrder = Array.from(ordersStore.values()).find(
      (o) => o.paymentIntentId === paymentIntentId
    );
  }
  if (!targetOrder) {
    // Pick the latest pending QRPH order
    targetOrder = Array.from(ordersStore.values())
      .reverse()
      .find((o) => o.status === "PENDING_PAYMENT" && o.paymentMethod === "QRPH");
  }

  if (!targetOrder) {
    return res.status(404).json({ error: "No matching pending QR Ph order found to simulate" });
  }

  // Update order to PREPARING (as specified in requirement)
  targetOrder.status = "PREPARING";
  targetOrder.updatedAt = new Date().toISOString();
  ordersStore.set(targetOrder.id, targetOrder);

  // Broadcast to kitchen-orders and customer live receipt
  broadcastRealtime("order_paid", targetOrder);

  return res.json({
    success: true,
    message: `Simulated PayMongo payment.paid webhook for Order #${targetOrder.orderNumber}`,
    order: targetOrder,
  });
};

app.post("/api/webhooks/paymongo/simulate", handleSimulateWebhook);
app.post("/api/simulate-webhook", handleSimulateWebhook);
app.post("/api/simulate/webhook-payment", handleSimulateWebhook);

async function startServer() {
  const nextApp = next({ dev: process.env.NODE_ENV !== "production" });
  await nextApp.prepare();
  const nextHandler = nextApp.getRequestHandler();
  app.all("*", (req, res) => nextHandler(req, res));

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Cafe Ordering API] Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
