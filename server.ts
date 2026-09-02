import express, { Response } from "express";
import path from "path";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createPayMongoQRPhPayment } from "./src/lib/paymongo";
import { Order, OrderStatus, CheckoutPayload, Product } from "./src/types";
import { CATEGORIES, PRODUCTS } from "./src/data/menuData";
import { broadcastKitchenOrder, broadcastProductUpdate, getSupabaseClient, getSupabaseAdminClient } from "./src/lib/supabase";
import { getPrismaClient, seedDatabaseIfEmpty } from "./src/lib/prisma";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminPin,
  createSignedSessionToken,
  isRequestAuthorized,
} from "./src/lib/auth";
import { expressAdminAuthMiddleware } from "./src/middleware";

dotenv.config();

const app = express();
const PORT = 3000;

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

// In-memory database stores with persistence during server lifecycle
let orderSequence = 1;
const ordersStore: Map<string, Order> = new Map();

// In-memory products store initialized from static catalog
const productsStore: Map<string, Product> = new Map(
  PRODUCTS.map((p) => [p.id, { ...p }])
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
  res.json({ data: CATEGORIES });
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

  let list = Array.from(productsStore.values());

  if (availableOnly) {
    list = list.filter((p) => p.isAvailable === true);
  }

  if (categoryId && categoryId !== "all") {
    list = list.filter((p) => p.categoryId === categoryId || p.categoryName === categoryId);
  }

  res.json({ data: list });
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

  const list = Array.from(productsStore.values());
  res.json({ data: list });
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
    product.isAvailable = updates.isAvailable;
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

    const subtotal = items.reduce((sum, it) => sum + (it.subtotal || it.unitPrice * it.quantity), 0);
    const serviceFee = 0;
    const totalAmount = subtotal + serviceFee;

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

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      status: "PENDING_PAYMENT",
      paymentMethod,
      paymentIntentId,
      paymentMethodId,
      qrCodeUrl,
      customerName: customerName?.trim() ? customerName.trim() : "Guest",
      orderType: orderType || "DINE_IN",
      notes: notes || null,
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
            status: "PENDING_PAYMENT",
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

// 9. Simulation Endpoint: /api/webhooks/paymongo/simulate
// Allows one-click testing of PayMongo payment.paid webhook in sandbox preview
app.post("/api/webhooks/paymongo/simulate", (req, res) => {
  const { orderId, paymentIntentId } = req.body;

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

  res.json({
    success: true,
    message: `Simulated PayMongo payment.paid webhook for Order #${targetOrder.orderNumber}`,
    order: targetOrder,
  });
});

// Express fallback for unmatched /api/* routes: Always return JSON 404 instead of HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({
    error: `API route ${req.method} ${req.path} not found.`,
  });
});

// Vite Middleware for Frontend Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Cafe Ordering API] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
