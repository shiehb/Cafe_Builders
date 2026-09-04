import { useState, useEffect, useCallback } from "react";

/**
 * Lightweight browser pathname hook supporting pushState, replaceState,
 * and popstate events without external heavy routing dependencies.
 */

// Custom event to notify all components when history navigation occurs
const NAVIGATE_EVENT = "applet_router_navigate";

export function navigate(path: string, options?: { replace?: boolean }) {
  if (typeof window === "undefined") return;

  const targetPath = path.startsWith("/") ? path : `/${path}`;
  if (options?.replace) {
    window.history.replaceState({}, "", targetPath);
  } else {
    window.history.pushState({}, "", targetPath);
  }

  // Dispatch custom event so all usePath hooks re-render
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { path: targetPath } }));
}

export function usePath(): string {
  // Keep SSR and the first client render deterministic. The browser path is
  // read after mount, then the route transitions without a hydration mismatch.
  const [currentPath, setCurrentPath] = useState<string>("/");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleLocationChange = () => {
      const cleanPath = window.location.pathname || "/";
      setCurrentPath(cleanPath);
    };

    handleLocationChange();
    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener(NAVIGATE_EVENT, handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener(NAVIGATE_EVENT, handleLocationChange);
    };
  }, []);

  return currentPath;
}

export type RouteInfo =
  | { type: "home" }
  | { type: "item"; id: string }
  | { type: "cart" }
  | { type: "cart_edit"; id: string }
  | { type: "checkout" }
  | { type: "order"; id: string }
  | { type: "kds" }
  | { type: "pos" }
  | { type: "admin" }
  | { type: "admin_product_new" }
  | { type: "admin_product_edit"; id: string }
  | { type: "unknown"; path: string };

export function parseRoute(pathname: string): RouteInfo {
  const clean = (pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";
  const lower = clean.toLowerCase();

  if (lower === "" || lower === "/") {
    return { type: "home" };
  }
  if (lower === "/cart") {
    return { type: "cart" };
  }
  // /cart/edit/:id
  const cartEditMatch = clean.match(/^\/cart\/edit\/(.+)$/i);
  if (cartEditMatch) {
    return { type: "cart_edit", id: decodeURIComponent(cartEditMatch[1]) };
  }
  if (lower === "/checkout") {
    return { type: "checkout" };
  }
  if (lower === "/kds") {
    return { type: "kds" };
  }
  if (lower === "/pos") {
    return { type: "pos" };
  }
  if (lower === "/admin") {
    return { type: "admin" };
  }
  if (lower === "/admin/products/new") {
    return { type: "admin_product_new" };
  }

  // /admin/products/:id/edit
  const adminEditMatch = clean.match(/^\/admin\/products\/([^/]+)\/edit$/i);
  if (adminEditMatch) {
    return { type: "admin_product_edit", id: adminEditMatch[1] };
  }

  // /item/:id
  const itemMatch = clean.match(/^\/item\/([^/]+)$/i);
  if (itemMatch) {
    return { type: "item", id: itemMatch[1] };
  }

  // /order/:id
  const orderMatch = clean.match(/^\/order\/([^/]+)$/i);
  if (orderMatch) {
    return { type: "order", id: orderMatch[1] };
  }

  return { type: "unknown", path: clean };
}

export function useParsedRoute(): RouteInfo {
  const path = usePath();
  return parseRoute(path);
}

/**
 * Returns URL query parameter by key
 */
export function getQueryParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}
