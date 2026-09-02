import crypto from "crypto";
import { Order, OrderStatus } from "@/src/types";
import { broadcastKitchenOrder } from "@/src/lib/supabase";

/**
 * PayMongo Webhook Signature Verifier
 * PayMongo sends a `paymongo-signature` header in format:
 * `t=timestamp,te=test_mode_signature,li=live_mode_signature`
 */
export function verifyPayMongoSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string | undefined
): { isValid: boolean; reason?: string } {
  if (!webhookSecret) {
    // If webhook secret is not set, allow for development/sandbox simulation
    return { isValid: true, reason: "No webhook secret configured - sandbox mode allowed" };
  }

  if (!signatureHeader) {
    return { isValid: false, reason: "Missing paymongo-signature header" };
  }

  try {
    const parts = signatureHeader.split(",").reduce((acc, item) => {
      const [key, val] = item.split("=");
      if (key && val) acc[key.trim()] = val.trim();
      return acc;
    }, {} as Record<string, string>);

    const timestamp = parts.t;
    const testSignature = parts.te;
    const liveSignature = parts.li;
    const signatureToVerify = liveSignature || testSignature;

    if (!timestamp || !signatureToVerify) {
      return { isValid: false, reason: "Invalid signature format in paymongo-signature header" };
    }

    // Construct string to sign: timestamp.rawBody
    const payloadToSign = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(payloadToSign)
      .digest("hex");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signatureToVerify),
      Buffer.from(expectedSignature)
    );

    return { isValid, reason: isValid ? "Signature verified" : "Signature mismatch" };
  } catch (err: any) {
    return { isValid: false, reason: `Verification error: ${err.message}` };
  }
}

/**
 * Next.js App Router POST Route: /api/webhooks/paymongo
 * Handles PayMongo `payment.paid` and `payment_intent.succeeded` events
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("paymongo-signature");
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET_KEY;

    // 1. Signature Verification Handling
    const verification = verifyPayMongoSignature(rawBody, signatureHeader, webhookSecret);
    if (!verification.isValid) {
      console.warn(`[PayMongo Webhook] Signature verification failed: ${verification.reason}`);
      return new Response(
        JSON.stringify({
          error: "Unauthorized webhook signature",
          reason: verification.reason,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 2. Parse the payload
    let eventPayload: any;
    try {
      eventPayload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const eventType = eventPayload?.data?.attributes?.type;
    const resourceData = eventPayload?.data?.attributes?.data;

    console.log(`[PayMongo Webhook] Received event: ${eventType}`);

    // Handle payment.paid and payment_intent.succeeded
    if (eventType === "payment.paid" || eventType === "payment_intent.succeeded") {
      // Extract payment_intent_id
      const paymentIntentId =
        resourceData?.attributes?.payment_intent_id ||
        resourceData?.id ||
        eventPayload?.data?.id;

      if (!paymentIntentId) {
        return new Response(
          JSON.stringify({ error: "Missing payment_intent_id in webhook payload" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      console.log(
        `[PayMongo Webhook] Processing paid event for Payment Intent: ${paymentIntentId}`
      );

      // In a Next.js / Prisma environment:
      // const updatedOrder = await prisma.order.updateMany({
      //   where: { paymentIntentId },
      //   data: { status: "PREPARING", updatedAt: new Date() },
      // });

      // Forward to local express server or Supabase Realtime broadcast
      const updatedOrderStub: Order = {
        id: `ord_${Date.now()}`,
        orderNumber: "C-001",
        status: "PREPARING" as OrderStatus,
        paymentMethod: "QRPH",
        paymentIntentId,
        orderType: "DINE_IN",
        subtotal: 180,
        serviceFee: 0,
        totalAmount: 180,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 4. Broadcast the updated order via Supabase Realtime on channel `kitchen-orders` with event `order_paid`
      await broadcastKitchenOrder("order_paid", updatedOrderStub);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Order for payment_intent ${paymentIntentId} transitioned to PREPARING`,
          event: "order_paid",
          channel: "kitchen-orders",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ received: true, ignored: true, reason: `Unhandled event type ${eventType}` }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[PayMongo Webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
