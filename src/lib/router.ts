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
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.location.pathname.toLowerCase() || "/";
    }
    return "/";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleLocationChange = () => {
      const cleanPath = window.location.pathname.toLowerCase() || "/";
      setCurrentPath(cleanPath);
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener(NAVIGATE_EVENT, handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener(NAVIGATE_EVENT, handleLocationChange);
    };
  }, []);

  return currentPath;
}

/**
 * Returns URL query parameter by key
 */
export function getQueryParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}
