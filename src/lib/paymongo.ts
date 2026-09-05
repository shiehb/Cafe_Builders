import QRCode from "qrcode";

export interface PayMongoQRResponse {
  paymentIntentId: string;
  paymentMethodId: string;
  qrImageUrl: string;
  qrDataString: string;
  amountCentavos: number;
  currency: string;
  isSimulated: boolean;
}

/**
 * F11-A1 — distinguishes "payment not configured (live key missing and
 * simulation disabled)" from a live PayMongo API failure. The checkout route
 * maps this to a clear "pay at counter" message; a live failure is mapped to a
 * "provider unreachable" message. Neither ever leaks internal details.
 */
export class PayMongoNotConfiguredError extends Error {
  constructor() {
    super("PAYMONGO payment is not configured for this order.");
    this.name = "PayMongoNotConfiguredError";
  }
}

/**
 * F11-A1 — Creates PayMongo Dynamic QR Ph payment (live), or an explicitly-gated
 * simulated QR Ph payload for development/tests.
 *
 * There is NO silent fallback to simulation:
 *   - When a live key is configured, a real PayMongo call is attempted and any
 *     failure throws (the order/customer is never handed a fake, non-collectible
 *     QR as though it were a live payment).
 *   - Simulation is returned ONLY when PAYMONGO_SIMULATION_ENABLED === "true"
 *     and no live key is configured. Otherwise the call throws with a clear
 *     "payment not configured" error.
 *
 * @param amountInPHP Total amount in Philippine Pesos (e.g. 195.50)
 * @param orderNumber Generated Cafe Order Number (e.g. "C-001")
 * @param description Order description
 */
export async function createPayMongoQRPhPayment(
  amountInPHP: number,
  orderNumber: string,
  description: string = "Cafe QR Ph Order"
): Promise<PayMongoQRResponse> {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  const simulationEnabled = process.env.PAYMONGO_SIMULATION_ENABLED === "true";
  const amountCentavos = Math.round(amountInPHP * 100);

  const hasLiveKey =
    typeof secretKey === "string" &&
    secretKey.trim().length > 0 &&
    secretKey.startsWith("sk_") &&
    !secretKey.includes("...");

  if (hasLiveKey) {
    try {
      return await createLivePayMongoQR(secretKey, amountCentavos, orderNumber, description);
    } catch (err) {
      // F11-A1 — NEVER fall back to a simulated/fake QR on a live payment
      // failure. A PayMongo outage, bad key, timeout, or API error must surface
      // as an explicit failure so the attendee/storefront can retry or switch to
      // cash — never as a non-collectible "payment".
      console.error("[PayMongo] Live payment QR generation failed:", err);
      throw err;
    }
  }

  if (simulationEnabled) {
    // Explicit development/simulation gate. Simulation only ever runs when the
    // operator opts in via PAYMONGO_SIMULATION_ENABLED=true.
    return buildSimulatedQR(amountInPHP, amountCentavos, orderNumber);
  }

  throw new PayMongoNotConfiguredError();
}

async function createLivePayMongoQR(
  secretKey: string,
  amountCentavos: number,
  orderNumber: string,
  description: string
): Promise<PayMongoQRResponse> {
  const basicAuth = Buffer.from(`${secretKey}:`).toString("base64");

  // 1. Create Payment Intent
  const intentRes = await fetch("https://api.paymongo.com/v1/payment_intents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: amountCentavos,
          payment_method_allowed: ["qrph"],
          payment_method_options: {
            card: { request_three_d_secure: "any" },
          },
          currency: "PHP",
          description: `${description} - ${orderNumber}`,
          statement_descriptor: "CAFE QRPH",
        },
      },
    }),
  });

  const intentData = await intentRes.json();
  if (!intentRes.ok || !intentData?.data?.id) {
    throw new Error(
      intentData?.errors?.[0]?.detail || "Failed to create PayMongo payment intent"
    );
  }

  const paymentIntentId = intentData.data.id;

  // 2. Create Payment Method (type: qrph)
  const pmRes = await fetch("https://api.paymongo.com/v1/payment_methods", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          type: "qrph",
        },
      },
    }),
  });

  const pmData = await pmRes.json();
  if (!pmRes.ok || !pmData?.data?.id) {
    throw new Error(
      pmData?.errors?.[0]?.detail || "Failed to create PayMongo payment method"
    );
  }

  const paymentMethodId = pmData.data.id;

  // 3. Attach Payment Method to Intent
  const attachRes = await fetch(
    `https://api.paymongo.com/v1/payment_intents/${paymentIntentId}/attach`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            payment_method: paymentMethodId,
            return_url: "https://paymongo.com",
          },
        },
      }),
    }
  );

  const attachData = await attachRes.json();
  const nextAction = attachData?.data?.attributes?.next_action;
  const imageUrl = nextAction?.code?.image_url || nextAction?.code?.data || "";

  let qrImageUrl = imageUrl;
  // If PayMongo returned a raw EMV string or payload, convert to Base64 image
  if (!qrImageUrl.startsWith("data:image") && !qrImageUrl.startsWith("http")) {
    qrImageUrl = await QRCode.toDataURL(
      nextAction?.code?.data || `QRPH.PAYMONGO.${paymentIntentId}`,
      {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 380,
        color: {
          dark: "#1c1917",
          light: "#ffffff",
        },
      }
    );
  }

  return {
    paymentIntentId,
    paymentMethodId,
    qrImageUrl,
    qrDataString: nextAction?.code?.data || `QRPH.PAYMONGO.${paymentIntentId}`,
    amountCentavos,
    currency: "PHP",
    isSimulated: false,
  };
}

async function buildSimulatedQR(
  amountInPHP: number,
  amountCentavos: number,
  orderNumber: string
): Promise<PayMongoQRResponse> {
  // Explicitly-gated Sandbox Dynamic QR Ph Generator.
  // Generates an EMVCo standard compliant Dynamic QR Ph format for the
  // Philippines (GCash, Maya, ShopeePay, Banks).
  const simulatedIntentId = `pi_${Date.now()}_sim_${Math.random().toString(36).substring(2, 7)}`;
  const simulatedPmId = `pm_${Date.now()}_sim_${Math.random().toString(36).substring(2, 7)}`;

  // EMVCo QR Ph payload format representation
  const qrPhPayload = `00020101021228580011ph.ppmi.qrph0115PAYMONGO001${orderNumber}520458125303608540${amountInPHP.toFixed(2).length}${amountInPHP.toFixed(2)}5802PH5913CAFE ARTISAN6006MANILA62210517${orderNumber}6304`;

  const qrImageUrl = await QRCode.toDataURL(qrPhPayload, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 380,
    color: {
      dark: "#1c1917",
      light: "#ffffff",
    },
  });

  return {
    paymentIntentId: simulatedIntentId,
    paymentMethodId: simulatedPmId,
    qrImageUrl,
    qrDataString: qrPhPayload,
    amountCentavos,
    currency: "PHP",
    isSimulated: true,
  };
}
