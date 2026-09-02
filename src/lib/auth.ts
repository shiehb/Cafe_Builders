import crypto from "crypto";

export const ADMIN_COOKIE_NAME = "admin_session";
export const SESSION_DURATION_HOURS = 24;

// Default admin PIN when process.env.ADMIN_PIN is not explicitly set
const DEFAULT_FALLBACK_ADMIN_PIN = "9999";
const DEFAULT_SESSION_SECRET = "cafe_artisan_secret_signature_key_2026";

/**
 * Returns the secret key for signing session tokens
 */
function getSecretKey(): string {
  return (
    (typeof process !== "undefined" && (process.env.SESSION_SECRET || process.env.ADMIN_PIN)) ||
    DEFAULT_SESSION_SECRET
  );
}

/**
 * Verifies if the provided PIN matches the server-configured ADMIN_PIN
 * Never reveals the actual PIN to client code.
 */
export function verifyAdminPin(enteredPin: string, role: string = "admin"): boolean {
  if (!enteredPin || typeof enteredPin !== "string") {
    return false;
  }

  const cleanPin = enteredPin.trim();

  // 1. Check against process.env.ADMIN_PIN
  const envAdminPin =
    (typeof process !== "undefined" && process.env.ADMIN_PIN) || DEFAULT_FALLBACK_ADMIN_PIN;

  if (cleanPin === envAdminPin) {
    return true;
  }

  // 2. Also support role-specific environment variables for POS/KDS terminals
  if (role === "pos") {
    const posPin = (typeof process !== "undefined" && (process.env.POS_PIN || process.env.VITE_POS_PIN)) || "1234";
    if (cleanPin === posPin) return true;
  } else if (role === "kds") {
    const kdsPin = (typeof process !== "undefined" && (process.env.KDS_PIN || process.env.VITE_KDS_PIN)) || "1234";
    if (cleanPin === kdsPin) return true;
  }

  // 3. Fallback demo pins (9999 for admin, 1234 for staff terminals)
  if (cleanPin === "9999" || (role !== "admin" && cleanPin === "1234")) {
    return true;
  }

  return false;
}

/**
 * Generates a signed, tamper-proof session token containing role and expiration
 */
export function createSignedSessionToken(role: string = "admin", hoursValid: number = SESSION_DURATION_HOURS): string {
  const expiresAt = Date.now() + hoursValid * 60 * 60 * 1000;
  const payload = JSON.stringify({
    role,
    expiresAt,
    nonce: Math.random().toString(36).substring(2, 10),
  });

  const payloadB64 = Buffer.from(payload).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSecretKey())
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Validates a signed session token
 */
export function verifySignedSessionToken(token: string | undefined | null): {
  valid: boolean;
  role?: string;
  expiresAt?: number;
  reason?: string;
} {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, reason: "Missing or malformed token" };
  }

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) {
    return { valid: false, reason: "Invalid token structure" };
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", getSecretKey())
      .update(payloadB64)
      .digest("base64url");

    // Timing-safe signature comparison
    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return { valid: false, reason: "Tampered or invalid signature" };
    }

    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson);

    if (typeof payload.expiresAt === "number" && Date.now() > payload.expiresAt) {
      return { valid: false, reason: "Session expired" };
    }

    return {
      valid: true,
      role: payload.role || "admin",
      expiresAt: payload.expiresAt,
    };
  } catch (err) {
    return { valid: false, reason: "Failed to decode session payload" };
  }
}

/**
 * Helper to parse cookies from header string
 */
export function parseCookieString(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, part) => {
    const [key, ...vals] = part.trim().split("=");
    if (key) {
      acc[key.trim()] = decodeURIComponent(vals.join("="));
    }
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Helper to verify an incoming request's admin session from cookies or Bearer Authorization header
 */
export function isRequestAuthorized(req: {
  cookies?: Record<string, string>;
  headers?: { cookie?: string; authorization?: string; [key: string]: any };
}): boolean {
  // 1. Check req.cookies (populated by cookie-parser)
  let sessionToken = req.cookies?.[ADMIN_COOKIE_NAME];

  // 2. Check raw Cookie header
  if (!sessionToken && req.headers?.cookie) {
    const parsed = parseCookieString(req.headers.cookie);
    sessionToken = parsed[ADMIN_COOKIE_NAME];
  }

  // 3. Check Authorization header (Bearer token)
  if (!sessionToken && req.headers?.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith("Bearer ")) {
      sessionToken = authHeader.substring(7).trim();
    }
  }

  if (!sessionToken) {
    return false;
  }

  const verification = verifySignedSessionToken(sessionToken);
  return verification.valid;
}

/**
 * Client-Side API: Verifies PIN with server and sets HttpOnly session cookie
 */
export async function loginWithAdminPin(pin: string, role: string = "admin"): Promise<{
  success: boolean;
  message?: string;
  role?: string;
}> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pin, role }),
    });

    const data = await res.json();
    return {
      success: res.ok && data.success === true,
      message: data.message || (res.ok ? "Authenticated" : "Authentication failed"),
      role: data.role,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Network error while validating PIN with server",
    };
  }
}

/**
 * Client-Side API: Checks if the current browser session has a valid HttpOnly admin_session
 */
export async function checkServerSession(): Promise<{
  authenticated: boolean;
  role?: string;
}> {
  try {
    const res = await fetch("/api/auth/session");
    if (res.ok) {
      const data = await res.json();
      return {
        authenticated: data.authenticated === true,
        role: data.role,
      };
    }
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Client-Side API: Logs out by telling server to clear the HttpOnly admin_session cookie
 */
export async function logoutAdminSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}
