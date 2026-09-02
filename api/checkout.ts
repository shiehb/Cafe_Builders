import { createPayMongoQRPhPayment } from "../src/lib/paymongo";
import { CheckoutPayload, Order } from "../src/types";
import { getPrismaClient } from "../src/lib/prisma";

let orderCounter = Math.floor(Math.random() * 50) + 1;

function getNextOrderNumber(): string {
  const num = orderCounter++;
  return `C-${String(num).padStart(3, "0")}`;
}

/**
 * Shared order processor for both Vercel Serverless Function and Web API
 */
export async function processCheckout(payload: CheckoutPayload) {
  const { items, customerName, orderType = "DINE_IN", paymentMethod = "QRPH", notes } = payload;

  if (!items || items.length === 0) {
    throw new Error("Cart is empty. Please add items before checking out.");
  }

  // Calculate subtotal
  const subtotal = items.reduce(
    (sum, it) => sum + (it.subtotal || it.unitPrice * it.quantity),
    0
  );
  const serviceFee = 0;
  const totalAmount = subtotal + serviceFee;

  const orderNumber = getNextOrderNumber();
  let qrCodeUrl: string | null = null;
  let paymentIntentId: string | null = null;
  let paymentMethodId: string | null = null;

  if (paymentMethod === "QRPH") {
    // Generate PayMongo dynamic QR Ph payment intent
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

  // Optional: Persist to Prisma database if configured
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
              customizations: it.customizations
                ? JSON.parse(JSON.stringify(it.customizations))
                : undefined,
              notes: it.notes,
            })),
          },
        },
      });
    } catch (dbErr) {
      console.warn("⚠️ Prisma order persistence warning:", (dbErr as Error)?.message || dbErr);
    }
  }

  return {
    success: true,
    orderNumber,
    order: newOrder,
    qrCodeUrl,
    paymentIntentId,
    message:
      paymentMethod === "QRPH"
        ? "Dynamic QR Ph generated. Scan using any QR Ph compliant app."
        : `Order #${orderNumber} registered. Please proceed to payment counter.`,
  };
}

/**
 * 1. Vercel Serverless Function Handler (Node.js runtime)
 * Handles POST /api/checkout deployed on Vercel
 */
export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Please use POST." });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: "Invalid JSON payload in request body" });
      }
    }

    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Missing or invalid checkout payload" });
    }

    const result = await processCheckout(body);
    return res.status(201).json(result);
  } catch (error: any) {
    console.error("Vercel Serverless Checkout error:", error);
    return res.status(500).json({
      error: error?.message || "Internal server error processing checkout",
    });
  }
}

/**
 * 2. Web Standards Route Handler (Edge runtime / Next.js app router compatibility)
 */
export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await processCheckout(body);
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Web POST Checkout error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to process checkout" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
