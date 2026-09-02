/**
 * Next.js App Router Checkout Route
 * File path: app/api/checkout/route.ts
 *
 * Handles Order creation with PayMongo Dynamic QR Ph or Cash at Counter
 */

import { createPayMongoQRPhPayment } from "@/src/lib/paymongo";
import { CheckoutPayload, Order } from "@/src/types";

// In a Next.js production environment with Prisma Client:
// import { PrismaClient } from "@prisma/client";
// const prisma = new PrismaClient();

let orderCounter = 1;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutPayload;
    const { items, customerName, orderType = "DINE_IN", paymentMethod, notes } = body;

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No items provided in cart" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Calculate subtotal
    const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0);
    const serviceFee = 0; // Configurable cafe service charge
    const totalAmount = subtotal + serviceFee;

    // Generate Order Number, e.g., C-001, C-002
    const paddedIndex = String(orderCounter++).padStart(3, "0");
    const orderNumber = `C-${paddedIndex}`;

    let qrCodeUrl: string | null = null;
    let paymentIntentId: string | null = null;
    let paymentMethodId: string | null = null;

    if (paymentMethod === "QRPH") {
      // 1. Create PayMongo dynamic QR Ph payment intent & attach payment method
      const paymongoResult = await createPayMongoQRPhPayment(
        totalAmount,
        orderNumber,
        `Cafe Order for ${customerName || "Customer"}`
      );

      qrCodeUrl = paymongoResult.qrImageUrl;
      paymentIntentId = paymongoResult.paymentIntentId;
      paymentMethodId = paymongoResult.paymentMethodId;
    }

    // Prepare order model object (Prisma schema mapped)
    const now = new Date().toISOString();
    const newOrder: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderNumber,
      status: "PENDING_PAYMENT",
      paymentMethod,
      paymentIntentId,
      paymentMethodId,
      qrCodeUrl,
      customerName: customerName || "Guest",
      orderType,
      notes: notes || null,
      subtotal,
      serviceFee,
      totalAmount,
      items: items.map((item, idx) => ({
        id: `item_${idx + 1}`,
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
      estimatedReadyTime: "8 - 12 mins",
    };

    // Return response with order and QR code if QRPH
    return new Response(
      JSON.stringify({
        success: true,
        orderNumber,
        order: newOrder,
        qrCodeUrl,
        paymentIntentId,
        message:
          paymentMethod === "QRPH"
            ? "Dynamic QR Ph generated. Scan using GCash, Maya, ShopeePay, or any banking app."
            : `Order ${orderNumber} placed. Please pay at counter upon calling.`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Checkout API error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to process checkout",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
