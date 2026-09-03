import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Order } from "../types";

let supabaseClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

/**
 * Returns the public Supabase client (using anon key, subject to Row Level Security)
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url =
    (typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined) ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined);

  const anonKey =
    (typeof process !== "undefined" ? process.env.SUPABASE_ANON_KEY : undefined) ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);

  if (url && anonKey && !url.includes("placeholder") && !anonKey.includes("placeholder")) {
    try {
      supabaseClient = createClient(url, anonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
      return supabaseClient;
    } catch (e) {
      console.warn("Could not create public Supabase client:", e);
    }
  }

  return null;
}

/**
 * Returns the privileged Supabase Admin client (using service_role key, bypassing RLS for server writes)
 * MUST only be used on server-side in API routes with verified admin credentials.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (supabaseAdminClient) return supabaseAdminClient;

  const url = typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined;
  const serviceKey =
    typeof process !== "undefined"
      ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
      : undefined;

  if (url && serviceKey && !url.includes("placeholder") && !serviceKey.includes("placeholder")) {
    try {
      supabaseAdminClient = createClient(url, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      return supabaseAdminClient;
    } catch (e) {
      console.warn("Could not create Supabase admin client:", e);
    }
  }

  return null;
}

/**
 * Realtime Event Types for Cafe Ordering
 */
export type RealtimeOrderEvent = "order_paid" | "order_created" | "order_status_updated";
export type RealtimeMenuEvent = "product_updated" | "inventory_changed";

export interface RealtimeOrderPayload {
  event: RealtimeOrderEvent;
  order: Order;
  timestamp: string;
}

/**
 * Broadcasts an order event across Supabase Realtime channel `kitchen-orders`
 */
export async function broadcastKitchenOrder(
  event: RealtimeOrderEvent,
  order: Order
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const channel = supabase.channel("kitchen-orders");
    await channel.send({
      type: "broadcast",
      event,
      payload: {
        event,
        order,
        timestamp: new Date().toISOString(),
      },
    });
    return true;
  } catch (err) {
    console.warn("Failed to broadcast to Supabase Realtime:", err);
    return false;
  }
}

/**
 * Broadcasts a product update event across Supabase Realtime channel `menu-updates`
 */
export async function broadcastProductUpdate(product: any): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const channel = supabase.channel("menu-updates");
    await channel.send({
      type: "broadcast",
      event: "product_updated",
      payload: {
        event: "product_updated",
        product,
        timestamp: new Date().toISOString(),
      },
    });
    return true;
  } catch (err) {
    console.warn("Failed to broadcast product update to Supabase Realtime:", err);
    return false;
  }
}
