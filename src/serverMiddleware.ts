import { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from "express";
import { requireRole, parseCookieString, verifySignedSessionToken, ADMIN_COOKIE_NAME } from "./lib/auth";

/**
 * Protected routes config
 */
export const PROTECTED_STAFF_ROUTES = ["/admin", "/pos", "/kds"];
export const PROTECTED_API_PREFIX = "/api/admin";

/**
 * Express-compatible Middleware for server.ts
 * Enforces admin_session cookie verification on /api/admin/* routes
 */
export function expressAdminAuthMiddleware(
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction
) {
  // If not accessing an admin API, allow through
  if (!req.path.startsWith(PROTECTED_API_PREFIX)) {
    return next();
  }

  const { allowed, role } = requireRole(req, ["admin"]);

  if (role === null) {
    return res.status(401).json({
      error: "Unauthorized: Invalid or missing admin session credentials",
      code: "AUTH_REQUIRED",
      message: "Please enter your 4-digit PIN to authenticate this session.",
    });
  }

  if (!allowed) {
    return res.status(403).json({
      error: "Insufficient role: admin access required",
      code: "FORBIDDEN_ROLE",
      message: "Your session role does not permit management access.",
    });
  }

  return next();
}

/**
 * Standard Next.js Edge Middleware Implementation
 * Blocks unauthenticated requests to /admin, /pos, /kds and /api/admin/*
 */
export async function middleware(request: any) {
  // Extract pathname
  const url = new URL(request.url || "http://localhost:3000", "http://localhost:3000");
  const pathname = url.pathname;

  // 1. Check if route is protected
  const isProtectedPage = PROTECTED_STAFF_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isProtectedApi = pathname.startsWith(PROTECTED_API_PREFIX);

  if (!isProtectedPage && !isProtectedApi) {
    return; // Allow through
  }

  // 2. Extract cookie from standard Request or NextRequest headers
  const cookieHeader = request.headers?.get?.("cookie") || request.headers?.cookie || "";
  const cookies = parseCookieString(cookieHeader);
  const token = cookies[ADMIN_COOKIE_NAME];

  // 3. Verify signature
  const verification = verifySignedSessionToken(token);

  if (!verification.valid) {
    // If it's an API route, return 401 JSON
    if (isProtectedApi) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized: Admin session required",
          code: "AUTH_REQUIRED",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // If it's a page route (/admin, /pos, /kds), redirect to login with callback URL
    const loginUrl = new URL("/", url.origin);
    loginUrl.searchParams.set("login", "required");
    loginUrl.searchParams.set("redirect", pathname);

    if (typeof Response !== "undefined" && typeof Response.redirect === "function") {
      return Response.redirect(loginUrl.toString(), 307);
    }
  }

  return;
}

export const config = {
  matcher: ["/admin/:path*", "/pos/:path*", "/kds/:path*", "/api/admin/:path*"],
};
