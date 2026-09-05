import crypto from "crypto";

export const ADMIN_COOKIE_NAME = "admin_session";
export const SESSION_DURATION_HOURS = 24;

// ---------------------------------------------------------------------------
// F9 — session revocation (in-memory jti denylist) and restart-safe epoch.
//
// A token carries a unique `jti` and an `epoch`. Two independent mechanisms
// combine to make the stateless cookie stays-revocable-for-the-monolith:
//   1. Logout adds the token's jti to an in-memory TTL denylist, so that exact
//      session is denied until its natural expiry (<= 24h).
//   2. SESSION_EPOCH is embedded in every token. Bumping it (an integer) at
//      deploy time invalidates ALL previously issued tokens on next start —
//      a restart-safe, multi-instance-safe global logout with no database.
// ---------------------------------------------------------------------------

const SESSION_EPOCH_ENV = "SESSION_EPOCH";

// jti -> ms timestamp until which that jti stays denied. Entries never exceed
// the source token's own expiry (max 24h), bounding memory naturally.
const revokedJtiExpiry = new Map<string, number>();
let lastRevocationSweep = Date.now();
const REVOCATION_MAX_ENTRIES = 10_000;
const REVOCATION_SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1h

function getSessionEpoch(): number {
  if (typeof process === "undefined") return 0;
  const raw = process.env[SESSION_EPOCH_ENV];
  if (raw === undefined || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function isRevokedJti(jti: string): boolean {
  sweepRevokedJti(Date.now());
  const expiry = revokedJtiExpiry.get(jti);
  if (expiry === undefined) return false;
  if (Date.now() > expiry) {
    revokedJtiExpiry.delete(jti);
    return false;
  }
  return true;
}

function sweepRevokedJti(now: number): void {
  if (revokedJtiExpiry.size < 500 || now - lastRevocationSweep < REVOCATION_SWEEP_INTERVAL_MS) return;
  for (const [jti, expiry] of revokedJtiExpiry) {
    if (now > expiry) revokedJtiExpiry.delete(jti);
  }
  lastRevocationSweep = now;
}

/**
 * Revokes the session represented by `token`. Only a currently-valid token
 * (correct signature, not expired, matching epoch, not already revoked) can be
 * revoked. Returns whether the jti was newly denied.
 */
export function revokeSessionToken(token: string): { revoked: boolean; jti?: string } {
  const verification = verifySignedSessionToken(token);
  if (!verification.valid || !verification.jti) {
    return { revoked: false };
  }
  const now = Date.now();
  revokedJtiExpiry.set(verification.jti, verification.expiresAt ?? now + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  while (revokedJtiExpiry.size > REVOCATION_MAX_ENTRIES) {
    const oldestJti = revokedJtiExpiry.keys().next().value as string | undefined;
    if (oldestJti === undefined) break;
    revokedJtiExpiry.delete(oldestJti);
  }
  return { revoked: true, jti: verification.jti };
}

/** Diagnostic/test helper: whether a jti is currently denied. */
export function isSessionRevoked(jti: string): boolean {
  return isRevokedJti(jti);
}

/** Diagnostic/test helper: number of revoked jtis currently tracked. */
export function revokedSessionCount(): number {
  return revokedJtiExpiry.size;
}

// Supported session roles. A login role is validated against this list and the
// submitted PIN is always checked against that role's configured env PIN only.
export const SUPPORTED_ROLES = ["admin", "pos", "kds"] as const;
export type SessionRole = (typeof SUPPORTED_ROLES)[number];

/**
 * Returns the secret key for signing session tokens.
 *
 * SESSION_SECRET is the ONLY accepted source. There is deliberately no
 * hardcoded or derived fallback: if it is missing the server fails closed,
 * so that deployment misconfiguration can never yield a predictable signing
 * key (e.g. a source-visible constant or a low-entropy 4-digit PIN).
 */
function getSecretKey(): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env.SESSION_SECRET || undefined;
}

/**
 * Resolves the configured PIN for a role. There is deliberately no hardcoded or
 * demo fallback: a missing/blank PIN variable denies login for that role.
 */
function getConfiguredRolePin(role: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  if (role === "admin") return process.env.ADMIN_PIN || undefined;
  if (role === "pos") return process.env.POS_PIN || undefined;
  if (role === "kds") return process.env.KDS_PIN || undefined;
  return undefined;
}

/**
 * Verifies if the provided PIN matches the configured PIN for the requested role.
 * Never reveals the actual PIN to client code. Fails closed when the role is
 * unknown or its PIN is not configured.
 */
export function verifyAdminPin(enteredPin: string, role: string = "admin"): boolean {
  if (!enteredPin || typeof enteredPin !== "string") {
    return false;
  }

  const configuredPin = getConfiguredRolePin(role);
  if (!configuredPin) {
    return false;
  }

  return enteredPin.trim() === configuredPin;
}

/**
 * Generates a signed, tamper-proof session token containing role and expiration
 */
export function createSignedSessionToken(role: string = "admin", hoursValid: number = SESSION_DURATION_HOURS): string {
  const secretKey = getSecretKey();
  if (!secretKey) {
    throw new Error("SESSION_SECRET is not configured; session tokens cannot be signed.");
  }

  const expiresAt = Date.now() + hoursValid * 60 * 60 * 1000;
  const payload = JSON.stringify({
    role,
    expiresAt,
    iat: Date.now(),
    jti: crypto.randomUUID(),
    epoch: getSessionEpoch(),
    nonce: crypto.randomUUID(),
  });

  const payloadB64 = Buffer.from(payload).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secretKey)
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
  jti?: string;
  reason?: string;
} {
  const secretKey = getSecretKey();
  if (!secretKey) {
    return { valid: false, reason: "Server session secret is not configured" };
  }

  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, reason: "Missing or malformed token" };
  }

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) {
    return { valid: false, reason: "Invalid token structure" };
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
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

    // Epoch gate: tokens minted under a different SESSION_EPOCH are dead. A
    // legacy (pre-F9) token with no epoch claim is valid only while the server
    // epoch is the default 0 — matching the pre-F9 behavior.
    const serverEpoch = getSessionEpoch();
    const tokenEpoch = typeof payload.epoch === "number" ? payload.epoch : 0;
    if (tokenEpoch !== serverEpoch) {
      return { valid: false, reason: "Session epoch revoked" };
    }

    const jti = typeof payload.jti === "string" ? payload.jti : undefined;
    if (jti && isRevokedJti(jti)) {
      return { valid: false, reason: "Session revoked" };
    }

    return {
      valid: true,
      role: payload.role || "admin",
      expiresAt: payload.expiresAt,
      jti,
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

type AuthRequestLike = {
  cookies?: Record<string, string>;
  headers?: { cookie?: string; authorization?: string; [key: string]: any };
};

/**
 * Extracts the admin_session token from cookies or Bearer Authorization header
 */
export function extractSessionToken(req: AuthRequestLike): string | undefined {
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

  return sessionToken || undefined;
}

type AuthRequest = AuthRequestLike;

/**
 * Helper to verify an incoming request's admin session from cookies or Bearer Authorization header
 */
export function isRequestAuthorized(req: AuthRequest): boolean {
  const sessionToken = extractSessionToken(req);
  if (!sessionToken) {
    return false;
  }
  const verification = verifySignedSessionToken(sessionToken);
  return verification.valid;
}

/**
 * Centralized role authorization.
 *
 * Returns the verified role of the caller or null when there is no valid
 * session. Role checks must go through requireRole() so that "authenticated"
 * never implicitly means "admin".
 */
export function getVerifiedSessionRole(req: AuthRequest): string | null {
  const sessionToken = extractSessionToken(req);
  if (!sessionToken) return null;
  const verification = verifySignedSessionToken(sessionToken);
  if (!verification.valid) return null;
  return verification.role || "admin";
}

/**
 * Centralized role gate. `allowed` is true only when the caller holds a valid
 * session AND its verified role is in `allowedRoles`. `role` is null when the
 * request has no valid/authoritative session.
 */
export function requireRole(
  req: AuthRequest,
  allowedRoles: SessionRole[]
): { allowed: boolean; role: string | null } {
  const role = getVerifiedSessionRole(req);
  if (role === null) {
    return { allowed: false, role: null };
  }
  return { allowed: (allowedRoles as readonly string[]).includes(role), role };
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
