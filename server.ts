import express, { Response } from "express";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import next from "next";
import dotenv from "dotenv";
import { createPayMongoQRPhPayment, PayMongoNotConfiguredError } from "./src/lib/paymongo";
import { AppError } from "./src/services/errors";
import { CATEGORIES, PRODUCTS } from "./src/data/menuData";
import { Order, OrderStatus, CheckoutPayload, Product } from "./src/types";
import { broadcastKitchenOrder, broadcastProductUpdate } from "./src/lib/supabase";
import { getDb } from "./src/lib/prisma";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminPin,
  createSignedSessionToken,
  isRequestAuthorized,
} from "./src/lib/auth";
import { expressAdminAuthMiddleware } from "./src/serverMiddleware";
import {
  catalogService,
  inventoryService,
  orderService,
  adminService,
} from "./src/services";

dotenv.config();

const app = express();
const PORT = 3000;
export { app };

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

// Format product for client backward-compatibility
function formatProductForClient(product: any) {
  if (!product) return null;
  const priceNum = typeof product.price === "number" ? product.price : Number(product.price) || 0;
  return {
    ...product,
    price: priceNum,
    basePrice: priceNum,
    categoryName: product.category?.name || product.categoryId,
    categoryIds: [product.categoryId],
    ingredientIds: Array.isArray(product.ingredients)
      ? product.ingredients.map((i: any) => i.ingredientId)
      : (product.ingredientIds || []),
    enabledCustomizationGroups: Array.isArray(product.customizationGroups)
      ? product.customizationGroups.map((cg: any) => {
          const n = (cg.group?.name || "").toLowerCase();
          return n.includes("ice") ? "ice" : n.includes("sugar") ? "sugar" : n.includes("milk") ? "milk" : "addons";
        })
      : (product.enabledCustomizationGroups || []),
    milkOptions: Array.isArray(product.allowedOptions)
      ? product.allowedOptions
          .filter((ao: any) => ao.option?.group?.name?.toLowerCase().includes("milk"))
          .map((ao: any) => ({ name: ao.option.name, price: Number(ao.option.priceModifier) || 0 }))
      : (product.milkOptions || []),
    addonOptions: Array.isArray(product.allowedOptions)
      ? product.allowedOptions
          .filter((ao: any) => !ao.option?.group?.name?.toLowerCase().includes("milk"))
          .map((ao: any) => ({ name: ao.option.name, price: Number(ao.option.priceModifier) || 0 }))
      : (product.addonOptions || []),
    allowedOptionIds: Array.isArray(product.allowedOptions)
      ? product.allowedOptions.map((ao: any) => ao.optionId)
      : (product.allowedOptionIds || []),
  };
}

// In-memory idempotency store for orders
const orderIdempotencyStore: Map<string, string> = new Map();

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

// 1. Health check
app.get("/api/health", async (_req, res) => {
  try {
    const db = getDb();
    const [ordersCount, productsCount] = await Promise.all([
      db.order.count().catch(() => 0),
      db.product.count().catch(() => 0),
    ]);
    res.json({
      status: "ok",
      app: "Cafe Web Ordering App (Admin & Inventory Security System)",
      time: new Date().toISOString(),
      ordersCount,
      productsCount,
      connectedClients: sseClients.size,
    });
  } catch {
    res.json({
      status: "ok",
      time: new Date().toISOString(),
      connectedClients: sseClients.size,
    });
  }
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
// PUBLIC MENU & PRODUCT ENDPOINTS (AUTHORITATIVE PRISMA SERVICES)
// ==============================================================================

// Categories API
app.get("/api/categories", async (_req, res) => {
  try {
    const categories = await adminService.listCategories();
    if (!categories || categories.length === 0) {
      return res.json({
        data: CATEGORIES.map((c) => ({
          ...c,
          iconName: c.icon || undefined,
          isActive: true,
        })),
      });
    }
    res.json({
      data: categories.map((c) => ({
        ...c,
        iconName: c.icon || undefined,
        isActive: true,
      })),
    });
  } catch (error: any) {
    console.error("Failed to list categories, using fallback:", error);
    res.json({
      data: CATEGORIES.map((c) => ({
        ...c,
        iconName: c.icon || undefined,
        isActive: true,
      })),
    });
  }
});

/**
 * Public Customer Products API
 * Returns products with current isAvailable status calculated by catalogService.
 */
app.get("/api/products", async (req, res) => {
  try {
    const categoryId = req.query.category as string;
    const availableOnly = req.query.availableOnly === "true";

    const products = await catalogService.listProducts({
      categoryId: categoryId && categoryId !== "all" ? categoryId : undefined,
      isAvailable: availableOnly ? true : undefined,
    });

    if (!products || products.length === 0) {
      const filtered = PRODUCTS.filter((item) => {
        const matchesCategory =
          !categoryId ||
          categoryId === "all" ||
          item.categoryId === categoryId ||
          item.categoryName === categoryId;
        const matchesAvailable = !availableOnly || item.isAvailable;
        return matchesCategory && matchesAvailable;
      });
      return res.json({ data: filtered.map(formatProductForClient) });
    }

    res.json({ data: products.map(formatProductForClient) });
  } catch (error: any) {
    console.error("Failed to list products, using fallback:", error);
    const categoryId = req.query.category as string;
    const availableOnly = req.query.availableOnly === "true";
    const filtered = PRODUCTS.filter((item) => {
      const matchesCategory =
        !categoryId ||
        categoryId === "all" ||
        item.categoryId === categoryId ||
        item.categoryName === categoryId;
      const matchesAvailable = !availableOnly || item.isAvailable;
      return matchesCategory && matchesAvailable;
    });
    res.json({ data: filtered.map(formatProductForClient) });
  }
});

// Single Product Public Endpoint
app.get("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let product = await catalogService.getProductById(id);
    if (!product) {
      const staticProd = PRODUCTS.find((p) => p.id === id);
      if (staticProd) {
        return res.json({ product: formatProductForClient(staticProd) });
      }
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ product: formatProductForClient(product) });
  } catch (error: any) {
    console.error("Failed to get product, checking fallback:", error);
    const { id } = req.params;
    const staticProd = PRODUCTS.find((p) => p.id === id);
    if (staticProd) {
      return res.json({ product: formatProductForClient(staticProd) });
    }
    res.status(500).json({ error: error?.message || "Failed to get product" });
  }
});

// Canonical catalog contract consumed by Customer and POS.
app.get("/api/catalog", async (req, res) => {
  try {
    const availableOnly = req.query.availableOnly === "true";
    let products = await catalogService.listProducts({
      isAvailable: availableOnly ? true : undefined,
    });

    if (!products || products.length === 0) {
      products = (PRODUCTS as any[]).map((p) => ({
        ...p,
        manualAvailability: p.isAvailable,
        category: { id: p.categoryId, name: p.categoryName || p.categoryId },
        customizationGroups: [],
        allowedOptions: [],
      }));
    }

    const data = products.map((product) => {
      const formatted = formatProductForClient(product);
      return {
        ...formatted,
        basePrice: product.price,
        productType: product.category?.name?.toLowerCase().includes("food") || product.category?.name?.toLowerCase().includes("pastr") ? "FOOD" : "BEVERAGE",
        categories: [{ id: product.categoryId, name: product.category?.name || product.categoryId }],
        customizationGroups: (product.customizationGroups || []).map((cg: any) => ({
          id: cg.groupId,
          name: cg.group?.name || cg.groupId,
          selectionMode: cg.group?.selectionMode || "SINGLE",
          required: cg.group?.isRequired || false,
          options: (cg.group?.options || []).map((o: any) => ({
            id: o.id,
            name: o.name,
            price: o.priceModifier,
          })),
        })),
        availabilityReason: product.isAvailable ? null : "MANUAL_UNAVAILABLE",
      };
    });

    res.json({ data });
  } catch (error: any) {
    console.error("Failed to get catalog, using fallback:", error);
    const data = PRODUCTS.map((product) => {
      const formatted = formatProductForClient(product);
      return {
        ...formatted,
        basePrice: product.price,
        productType: product.categoryName?.toLowerCase().includes("food") || product.categoryName?.toLowerCase().includes("pastr") ? "FOOD" : "BEVERAGE",
        categories: [{ id: product.categoryId, name: product.categoryName || product.categoryId }],
        customizationGroups: [],
        availabilityReason: product.isAvailable ? null : "MANUAL_UNAVAILABLE",
      };
    });
    res.json({ data });
  }
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
    const products = await catalogService.listProducts({ includeArchived: true });
    res.json({ data: products.map(formatProductForClient) });
  } catch (error: any) {
    console.error("Failed to list admin products:", error);
    res.status(500).json({ error: error?.message || "Failed to list admin products" });
  }
});

app.get("/api/admin/ingredients", async (_req, res) => {
  try {
    const data = await inventoryService.listIngredients({ includeArchived: true });
    res.json({ data });
  } catch (error: any) {
    console.error("Failed to list admin ingredients:", error);
    res.status(500).json({ error: error?.message || "Failed to list ingredients" });
  }
});

app.get("/api/admin/categories", async (_req, res) => {
  try {
    const data = await adminService.listCategories();
    res.json({ data });
  } catch (error: any) {
    console.error("Failed to list admin categories:", error);
    res.status(500).json({ error: error?.message || "Failed to list categories" });
  }
});

app.post("/api/admin/categories", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Category name is required" });
    const category = await adminService.createCategory({
      name,
      sortOrder: Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : undefined,
      icon: req.body?.icon,
    });
    return res.status(201).json({ success: true, category, data: category });
  } catch (error: any) {
    console.error("Failed to create category:", error);
    return res.status(500).json({ error: error?.message || "Failed to create category" });
  }
});

app.patch("/api/admin/categories/:id", async (req, res) => {
  try {
    const category = await adminService.updateCategory(req.params.id, {
      name: typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim() : undefined,
      sortOrder: Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : undefined,
      icon: req.body?.icon,
    });
    return res.json({ success: true, category, data: category });
  } catch (error: any) {
    console.error("Failed to update category:", error);
    return res.status(500).json({ error: error?.message || "Failed to update category" });
  }
});

app.delete("/api/admin/categories/:id", async (req, res) => {
  try {
    const category = await adminService.deleteCategory(req.params.id);
    return res.json({ success: true, category, data: category });
  } catch (error: any) {
    console.error("Failed to delete category:", error);
    return res.status(500).json({ error: error?.message || "Failed to delete category" });
  }
});

app.get("/api/admin/customization-groups", async (_req, res) => {
  try {
    const data = await adminService.listCustomizationGroups();
    res.json({ data });
  } catch (error: any) {
    console.error("Failed to list customization groups:", error);
    res.status(500).json({ error: error?.message || "Failed to list customization groups" });
  }
});

app.post("/api/admin/customization-groups", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Customization group name is required" });
    const group = await adminService.createCustomizationGroup({
      name,
      selectionMode: req.body?.selectionMode === "MULTIPLE" ? "MULTIPLE" : "SINGLE",
      isRequired: req.body?.isRequired === true,
      sortOrder: Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : undefined,
      isActive: req.body?.isActive !== false,
    });
    return res.status(201).json({ success: true, group, data: group });
  } catch (error: any) {
    console.error("Failed to create customization group:", error);
    return res.status(500).json({ error: error?.message || "Failed to create customization group" });
  }
});

app.patch("/api/admin/customization-groups/:id", async (req, res) => {
  try {
    const group = await adminService.updateCustomizationGroup(req.params.id, {
      name: typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim() : undefined,
      selectionMode: req.body?.selectionMode,
      isRequired: typeof req.body?.isRequired === "boolean" ? req.body.isRequired : undefined,
      sortOrder: Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : undefined,
      isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined,
      isArchived: typeof req.body?.isArchived === "boolean" ? req.body.isArchived : undefined,
    });
    return res.json({ success: true, group, data: group });
  } catch (error: any) {
    console.error("Failed to update customization group:", error);
    return res.status(500).json({ error: error?.message || "Failed to update customization group" });
  }
});

app.delete("/api/admin/customization-groups/:id", async (req, res) => {
  try {
    const group = await adminService.archiveCustomizationGroup(req.params.id);
    return res.json({ success: true, group, data: group });
  } catch (error: any) {
    console.error("Failed to archive customization group:", error);
    return res.status(500).json({ error: error?.message || "Failed to delete customization group" });
  }
});

app.get("/api/admin/customization-options", async (req, res) => {
  try {
    const groupId = req.query.groupId as string | undefined;
    const data = await adminService.listCustomizationOptions({ groupId });
    res.json({ data });
  } catch (error: any) {
    console.error("Failed to list customization options:", error);
    res.status(500).json({ error: error?.message || "Failed to list customization options" });
  }
});

app.post("/api/admin/customization-options", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const groupId = String(req.body?.groupId || "");
    if (!name || !groupId) return res.status(400).json({ error: "Option name and groupId are required" });
    const option = await adminService.createCustomizationOption({
      name,
      groupId,
      priceModifier: Number(req.body?.priceModifier) || 0,
      isActive: req.body?.isActive !== false,
    });
    return res.status(201).json({ success: true, option, data: option });
  } catch (error: any) {
    console.error("Failed to create customization option:", error);
    return res.status(500).json({ error: error?.message || "Failed to create customization option" });
  }
});

app.patch("/api/admin/customization-options/:id", async (req, res) => {
  try {
    const option = await adminService.updateCustomizationOption(req.params.id, {
      name: typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim() : undefined,
      groupId: typeof req.body?.groupId === "string" ? req.body.groupId : undefined,
      priceModifier: typeof req.body?.priceModifier === "number" ? req.body.priceModifier : undefined,
      isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined,
      isArchived: typeof req.body?.isArchived === "boolean" ? req.body.isArchived : undefined,
    });
    return res.json({ success: true, option, data: option });
  } catch (error: any) {
    console.error("Failed to update customization option:", error);
    return res.status(500).json({ error: error?.message || "Failed to update customization option" });
  }
});

app.delete("/api/admin/customization-options/:id", async (req, res) => {
  try {
    const option = await adminService.archiveCustomizationOption(req.params.id);
    return res.json({ success: true, option, data: option });
  } catch (error: any) {
    console.error("Failed to archive customization option:", error);
    return res.status(500).json({ error: error?.message || "Failed to delete customization option" });
  }
});

app.post("/api/admin/ingredients", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Ingredient name is required" });
    const ingredient = await inventoryService.createIngredient({
      name,
      isAvailable: req.body?.isAvailable !== false,
    });
    return res.status(201).json({ success: true, ingredient, data: ingredient });
  } catch (error: any) {
    console.error("Failed to create ingredient:", error);
    return res.status(500).json({ error: error?.message || "Failed to create ingredient" });
  }
});

app.patch("/api/admin/ingredients/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const ingredient = await inventoryService.updateIngredient(id, {
      name: typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim() : undefined,
      isAvailable: typeof req.body?.isAvailable === "boolean" ? req.body.isAvailable : undefined,
      isArchived: typeof req.body?.isArchived === "boolean" ? req.body.isArchived : undefined,
    });

    // Broadcast updated products that depend on this ingredient
    const db = getDb();
    const relations = await db.productIngredient.findMany({
      where: { ingredientId: id },
      select: { productId: true },
    });
    const affectedProducts = Array.from(new Set(relations.map((r) => r.productId)));
    for (const pId of affectedProducts) {
      const p = await catalogService.getProductById(pId);
      if (p) {
        broadcastProductRealtime("product_updated", formatProductForClient(p) as any);
      }
    }

    return res.json({ success: true, ingredient, data: ingredient, affectedProducts, affectedOptions: [] });
  } catch (error: any) {
    console.error("Failed to update ingredient:", error);
    return res.status(500).json({ error: error?.message || "Failed to update ingredient" });
  }
});

app.delete("/api/admin/ingredients/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const ingredient = await inventoryService.archiveIngredient(id);
    return res.json({ success: true, ingredient, data: ingredient });
  } catch (error: any) {
    console.error("Failed to delete ingredient:", error);
    return res.status(500).json({ error: error?.message || "Failed to delete ingredient" });
  }
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
      price,
      description = "",
      imageUrl,
      popular = false,
      isAvailable = true,
      ingredientIds = [],
      customizationGroupIds = [],
      allowedOptionIds = [],
    } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Product name is required" });
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: "Valid price in PHP is required" });
    }

    const newProduct = await catalogService.createProduct({
      name: name.trim(),
      description: description?.trim() || "",
      price: numericPrice,
      imageUrl: imageUrl?.trim() || "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
      categoryId: categoryId || "cat_coffee",
      manualAvailability: isAvailable !== false,
      popular: Boolean(popular),
      ingredients: Array.isArray(ingredientIds) ? ingredientIds.map((id: string) => ({ ingredientId: id, isRequired: true })) : [],
      customizationGroupIds: Array.isArray(customizationGroupIds) ? customizationGroupIds : [],
      allowedOptionIds: Array.isArray(allowedOptionIds) ? allowedOptionIds : [],
    });

    const formatted = formatProductForClient(newProduct);
    broadcastProductRealtime("product_updated", formatted as any);

    return res.status(201).json({
      success: true,
      product: formatted,
      message: `Product "${formatted.name}" created successfully`,
    });
  } catch (error: any) {
    console.error("Failed to create product:", error);
    return res.status(500).json({ error: error?.message || "Failed to create product" });
  }
});

/**
 * DELETE /api/admin/products/:id
 * Permanently removes / archives product from catalog
 */
app.delete("/api/admin/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const archived = await catalogService.archiveProduct(id);
    const formatted = formatProductForClient(archived);
    broadcastProductRealtime("product_updated", { ...formatted, isAvailable: false } as any);

    return res.json({
      success: true,
      product: formatted,
      message: `Product "${formatted.name}" deleted successfully`,
      id,
    });
  } catch (error: any) {
    console.error("Failed to delete product:", error);
    return res.status(500).json({ error: error?.message || "Failed to delete product" });
  }
});

/**
 * PATCH /api/admin/products/:id
 * Updates product availability (In Stock / Sold Out), price, description, popular badge
 */
app.patch("/api/admin/products/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  try {
    const updated = await catalogService.updateProduct(id, {
      name: typeof updates.name === "string" && updates.name.trim() ? updates.name.trim() : undefined,
      description: typeof updates.description === "string" ? updates.description.trim() : undefined,
      price: typeof updates.price === "number" && !isNaN(updates.price) && updates.price >= 0 ? updates.price : undefined,
      imageUrl: typeof updates.imageUrl === "string" ? updates.imageUrl.trim() : undefined,
      categoryId: typeof updates.categoryId === "string" ? updates.categoryId : (Array.isArray(updates.categoryIds) && updates.categoryIds[0] ? String(updates.categoryIds[0]) : undefined),
      manualAvailability: typeof updates.isAvailable === "boolean" ? updates.isAvailable : undefined,
      popular: typeof updates.popular === "boolean" ? updates.popular : undefined,
      isArchived: typeof updates.isArchived === "boolean" ? updates.isArchived : undefined,
      ingredients: Array.isArray(updates.ingredientIds) ? updates.ingredientIds.map((ingId: string) => ({ ingredientId: ingId, isRequired: true })) : undefined,
      customizationGroupIds: Array.isArray(updates.customizationGroupIds) ? updates.customizationGroupIds : undefined,
      allowedOptionIds: Array.isArray(updates.allowedOptionIds) ? updates.allowedOptionIds.map(String) : undefined,
    });

    const formatted = formatProductForClient(updated);
    broadcastProductRealtime("product_updated", formatted as any);

    return res.json({
      success: true,
      product: formatted,
      message: `Updated ${formatted.name} (${formatted.isAvailable ? "In Stock" : "86'd / Sold Out"})`,
    });
  } catch (error: any) {
    console.error("Failed to update product:", error);
    return res.status(500).json({ error: error?.message || "Failed to update product" });
  }
});

// ==============================================================================
// CHECKOUT & ORDER PIPELINE (AUTHORITATIVE PRISMA ORDER SERVICE)
// ==============================================================================

async function processCheckout(body: CheckoutPayload) {
  const { items, customerName, orderType = "DINE_IN", paymentMethod, notes } = body;

  if (!items || items.length === 0) {
    return {
      status: 400,
      payload: { error: "Cart is empty. Please add items before checking out." },
    };
  }

  const invalidQuantity = items.find((item) => !Number.isInteger(item.quantity) || item.quantity < 1);
  if (invalidQuantity) {
    return {
      status: 400,
      payload: { error: "Each cart item must have a valid quantity." },
    };
  }

  // Pre-validate product existence & availability via catalogService
  const productIds = items.map((i) => i.productId);
  const products = await Promise.all(productIds.map((id) => catalogService.getProductById(id)));
  const unavailable = items
    .map((item, idx) => ({ item, product: products[idx] }))
    .filter(({ product }) => !product || product.isAvailable === false);

  if (unavailable.length > 0) {
    return {
      status: 409,
      payload: {
        success: false,
        code: "PRODUCT_UNAVAILABLE",
        error: `Unavailable item: ${unavailable[0].item.productName || "This product"}. Please remove it or choose a replacement.`,
        message: `Unavailable item: ${unavailable[0].item.productName || "This product"}. Please remove it or choose a replacement.`,
        unavailableProductIds: unavailable.map(({ item }) => item.productId),
      },
    };
  }

  // Resolve option names to DB optionIds
  const db = getDb();
  const allOptions = await db.customizationOption.findMany({
    where: { isActive: true, isArchived: false },
  });
  const optionByName = new Map(allOptions.map((o) => [o.name.toLowerCase().trim(), o]));

  const mappedItems = items.map((it) => {
    const selectedOptionIds: string[] = Array.isArray((it as any).selectedOptionIds)
      ? [...(it as any).selectedOptionIds]
      : [];

    if (it.customizations) {
      if (it.customizations.milkOption) {
        const match = optionByName.get(it.customizations.milkOption.toLowerCase().trim());
        if (match && !selectedOptionIds.includes(match.id)) {
          selectedOptionIds.push(match.id);
        }
      }
      if (Array.isArray(it.customizations.addOns)) {
        for (const addonStr of it.customizations.addOns) {
          const cleanName = addonStr.replace(/\s*\(\+.*?\)/, "").trim().toLowerCase();
          const match = optionByName.get(cleanName);
          if (match && !selectedOptionIds.includes(match.id)) {
            selectedOptionIds.push(match.id);
          }
        }
      }
    }

    return {
      productId: it.productId,
      quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
      customizations: it.customizations,
      notes: it.notes?.trim() || undefined,
      selectedOptionIds,
      modifiers: (it as any).modifiers,
    };
  });

  const orderNotes = [
    notes,
    body.promoCode ? `Promo: ${body.promoCode}` : null,
  ].filter(Boolean).join(" • ") || undefined;

  // Authoritative creation via orderService (calculates pricing server-side)
  let createdOrder;
  let retries = 0;
  while (true) {
    try {
      createdOrder = await orderService.createOrder({
        customerName: customerName?.trim() || "Guest",
        orderType: orderType || "DINE_IN",
        paymentMethod: paymentMethod === "QRPH" ? "QRPH" : "CASH",
        notes: orderNotes,
        serviceFee: 0,
        items: mappedItems,
      });
      break;
    } catch (err: any) {
      if (err.code === "P2002" && retries < 5) {
        retries++;
        await new Promise((r) => setTimeout(r, Math.random() * 200));
        continue;
      }
      throw err;
    }
  }

  // Handle CASH paid at counter
  if (paymentMethod === "CASH" && body.paymentStatus === "PAID") {
    if (Number(body.cashTendered || 0) < createdOrder.totalAmount) {
      return {
        status: 400,
        payload: { success: false, code: "INSUFFICIENT_CASH", message: "Cash tendered is less than the order total." },
      };
    }
    await orderService.updateOrderStatus(createdOrder.id, "PAID");
    createdOrder.status = "PAID";
  }

  // Handle QRPH PayMongo dynamic generation
  let qrCodeUrl: string | null = null;
  let paymentIntentId: string | null = null;
  let paymentMethodId: string | null = null;

  // F11-A1 — generate the QR BEFORE persisting payment identifiers, and fail
   // explicitly if PayMongo cannot produce a real collectible payment. We never
   // surface a fake/simulated QR as a live payment. createPayMongoQRPhPayment
   // throws on any live failure (or when payment/simulation is not configured).
   // The order row created above is removed so a failed online payment never
   // leaves a phantom, unpayable PENDING_PAYMENT order in the staff queue
   // (it was never broadcast and its payment ids are null, so nothing binding
   // to it can exist).
  if (paymentMethod === "QRPH") {
    let qrRes;
    try {
      qrRes = await createPayMongoQRPhPayment(
        createdOrder.totalAmount,
        createdOrder.orderNumber,
        `Artisan Cafe - Order ${createdOrder.orderNumber}`
      );
      qrCodeUrl = qrRes.qrImageUrl;
    } catch (err) {
      await db.order
        .delete({ where: { id: createdOrder.id } })
        .catch((cleanupErr: unknown) => {
          console.warn("[Checkout] Could not remove unfinalized order after QR failure:", cleanupErr);
        });
      if (err instanceof PayMongoNotConfiguredError) {
        throw new AppError(
          503,
          "PAYMENT_UNAVAILABLE",
          "Online payment is not available for this order. Please pay at the counter."
        );
      }
      throw new AppError(
        503,
        "PAYMENT_PROVIDER_UNAVAILABLE",
        "Payment provider could not be reached. Please try again or pay at the counter."
      );
    }
    paymentIntentId = qrRes.paymentIntentId;
    paymentMethodId = qrRes.paymentMethodId;

    await db.order.update({
      where: { id: createdOrder.id },
      data: {
        qrCodeUrl,
        paymentIntentId,
        paymentMethodId,
      },
    });

    createdOrder.qrCodeUrl = qrCodeUrl;
    createdOrder.paymentIntentId = paymentIntentId;
    createdOrder.paymentMethodId = paymentMethodId;
  }

  // Broadcast realtime order_created to Kitchen KDS and customer live stream.
  // R2: unpaid PENDING_PAYMENT tickets are NEVER announced to the kitchen —
  // only the order's later order_paid/status events (broadcast on payment
  // confirmation) surface them. If a QRPH webhook never fires, the order stays
  // PENDING_PAYMENT and is simply never seen by the KDS (documented
  // operational limitation, no manual workaround by design).
  if (createdOrder.status !== "PENDING_PAYMENT") {
    broadcastRealtime("order_created", createdOrder as any);
  }

  return {
    status: 201,
    order: createdOrder,
    payload: {
      success: true,
      orderNumber: createdOrder.orderNumber,
      order: createdOrder,
      qrCodeUrl: createdOrder.qrCodeUrl,
      paymentIntentId: createdOrder.paymentIntentId,
      message:
        paymentMethod === "QRPH"
          ? "Dynamic QR Ph generated. Scan using any QR Ph compliant app."
          : `Order #${createdOrder.orderNumber} registered. Please proceed to payment counter.`,
    },
  };
}

// 4. Checkout API
app.post("/api/checkout", async (req, res) => {
  try {
    const result = await processCheckout(req.body);
    return res.status(result.status).json(result.payload);
  } catch (error: any) {
    console.error("Error in /api/checkout:", error);
    const msg = error?.message || "Internal server error during checkout";
    if (msg.includes("sold out") || msg.includes("no longer available")) {
      return res.status(409).json({
        success: false,
        code: "PRODUCT_UNAVAILABLE",
        error: msg,
        message: msg,
      });
    }
    return res.status(500).json({ error: msg });
  }
});

// 5. Orders API (Canonical idempotency-protected order creation)
app.post("/api/orders", async (req, res) => {
  try {
    const idempotencyKey = req.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key header is required." });
    }
    const existingOrderId = orderIdempotencyStore.get(idempotencyKey);
    if (existingOrderId) {
      const existingOrder = await orderService.getOrderById(existingOrderId);
      return res.status(409).json({ success: false, code: "DUPLICATE_REQUEST", message: "This order request has already been processed.", order: existingOrder });
    }

    const result = await processCheckout(req.body);
    if (result.order?.id) {
      orderIdempotencyStore.set(idempotencyKey, result.order.id);
    }
    return res.status(result.status).json(result.payload);
  } catch (error: any) {
    console.error("Error in /api/orders:", error);
    const msg = error?.message || "Internal server error during order creation";
    if (msg.includes("sold out") || msg.includes("no longer available")) {
      return res.status(409).json({
        success: false,
        code: "PRODUCT_UNAVAILABLE",
        error: msg,
        message: msg,
      });
    }
    return res.status(500).json({ error: msg });
  }
});

// Get all orders (for staff / KDS dashboard)
app.get("/api/orders", async (req, res) => {
  try {
    // excludeStatus: comma-separated statuses to hide, e.g.
    // ?excludeStatus=PENDING_PAYMENT keeps unpaid tickets off the KDS (R2).
    const excludeStatus = String(req.query.excludeStatus || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as OrderStatus[];
    const list = await orderService.listOrders({
      status: req.query.status as any,
      excludeStatus: excludeStatus.length ? excludeStatus : undefined,
      orderType: req.query.orderType as any,
    });
    res.json({ data: list });
  } catch (error: any) {
    console.error("Failed to list orders:", error);
    res.status(500).json({ error: error?.message || "Failed to list orders" });
  }
});

// Get single order by ID or orderNumber
app.get("/api/orders/:idOrNumber", async (req, res) => {
  try {
    const { idOrNumber } = req.params;
    const order = await orderService.getOrderById(idOrNumber);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({ data: order, order });
  } catch (error: any) {
    console.error("Failed to get order:", error);
    res.status(500).json({ error: error?.message || "Failed to get order" });
  }
});

// Update order status (Staff / KDS buttons)
app.patch("/api/orders/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: OrderStatus };

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

  try {
    const updated = await orderService.updateOrderStatus(id, status);
    broadcastRealtime("order_status_updated", updated as any);
    return res.json({
      success: true,
      order: updated,
      message: `Order ${updated.orderNumber} status updated to ${status}`,
    });
  } catch (error: any) {
    console.error("Failed to update order status:", error);
    return res.status(500).json({ error: error?.message || "Failed to update order status" });
  }
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
const handlePayMongoWebhook = async (req: any, res: Response) => {
  const signatureHeader = req.headers["paymongo-signature"] as string | undefined;
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET_KEY;
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const isProduction = process.env.NODE_ENV === "production";

  // F11-A3 — fail-closed webhook secret policy.
  const allowUnsignedDevOnly =
    !isProduction && process.env.PAYMONGO_ALLOW_UNSIGNED_WEBHOOKS_DEV === "true";

  if (webhookSecret) {
    if (!verifySignature(rawBody, signatureHeader, webhookSecret)) {
      console.warn("[PayMongo Webhook] Invalid webhook signature rejected");
      return res.status(401).json({ error: "Invalid signature" });
    }
  } else if (!allowUnsignedDevOnly) {
    console.warn("[PayMongo Webhook] Rejecting webhook: PAYMONGO_WEBHOOK_SECRET_KEY is not configured");
    return res.status(503).json({
      error: "Webhook signature verification is not configured on this server.",
      code: "WEBHOOK_SECRET_NOT_CONFIGURED",
    });
  }

  if (!webhookSecret && allowUnsignedDevOnly) {
    console.warn(
      "[PayMongo Webhook] WARNING: accepting unsigned webhook in development " +
        "(PAYMONGO_ALLOW_UNSIGNED_WEBHOOKS_DEV=true and no PAYMONGO_WEBHOOK_SECRET_KEY)."
    );
  }

  const event = req.body;
  const eventType = event?.data?.attributes?.type;
  const resource = event?.data?.attributes?.data;

  console.log(`[PayMongo Webhook] Processing event type: ${eventType}`);

  if (eventType === "payment.paid" || eventType === "payment_intent.succeeded") {
    const paymentIntentId = resource?.attributes?.payment_intent_id || resource?.id;
    if (paymentIntentId) {
      try {
        const db = getDb();
        const matched = await db.order.findFirst({
          where: {
            OR: [
              { paymentIntentId },
              { id: paymentIntentId },
            ],
          },
        });

        if (matched) {
          // R1: payment confirmation lands the order on PAID (default).
          // The kitchen starts only after an explicit Start Brewing (PAID ->
          // PREPARING). We never auto-jump straight to PREPARING anymore.
          const updatedOrder = await orderService.recordPayment({
            idOrOrderNumber: matched.id,
            paymentIntentId,
          });

          console.log(
            `[PayMongo Webhook] Order ${updatedOrder.orderNumber} successfully updated to PAID`
          );
          broadcastRealtime("order_paid", updatedOrder as any);

          return res.json({
            success: true,
            matchedOrderNumber: updatedOrder.orderNumber,
            status: updatedOrder.status,
            message: "Order updated to PAID and broadcast to Kitchen KDS",
          });
        }
      } catch (err) {
        console.error("[PayMongo Webhook] Error recording payment:", err);
      }
    }
  }

  res.json({ received: true });
};

app.post("/api/webhooks/paymongo", handlePayMongoWebhook);
app.post("/api/paymongo-webhook", handlePayMongoWebhook);

// 9. Simulation Endpoint: /api/webhooks/paymongo/simulate, /api/simulate-webhook, /api/simulate/webhook-payment
const handleSimulateWebhook = async (req: any, res: Response) => {
  const { orderId, paymentIntentId } = req.body || {};

  try {
    const db = getDb();
    let targetOrder: any = null;

    if (orderId) {
      targetOrder = await db.order.findFirst({
        where: {
          OR: [{ id: orderId }, { orderNumber: orderId }],
        },
      });
    }

    if (!targetOrder && paymentIntentId) {
      targetOrder = await db.order.findFirst({
        where: { paymentIntentId },
      });
    }

    if (!targetOrder) {
      targetOrder = await db.order.findFirst({
        where: { status: "PENDING_PAYMENT", paymentMethod: "QRPH" },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!targetOrder) {
      return res.status(404).json({ error: "No matching pending QR Ph order found to simulate" });
    }

    const updated = await orderService.recordPayment({
      idOrOrderNumber: targetOrder.id,
    });

    broadcastRealtime("order_paid", updated as any);

    return res.json({
      success: true,
      message: `Simulated PayMongo payment.paid webhook for Order #${updated.orderNumber}`,
      order: updated,
    });
  } catch (error: any) {
    console.error("Error in simulate webhook:", error);
    return res.status(500).json({ error: error?.message || "Failed to simulate webhook" });
  }
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
