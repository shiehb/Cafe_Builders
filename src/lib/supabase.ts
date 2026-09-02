import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Order } from "../types";

let supabaseClient: SupabaseClient | null = null;

/**
 * Returns the active Supabase client or null if not configured
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const metaEnv = typeof import.meta !== "undefined" ? (import.meta as Record<string, any>).env : undefined;

  const url =
    (typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined) ||
    metaEnv?.VITE_SUPABASE_URL;

  const anonKey =
    (typeof process !== "undefined"
      ? process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
      : undefined) ||
    metaEnv?.VITE_SUPABASE_ANON_KEY;

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
      console.warn("Could not create Supabase client:", e);
    }
  }

  return null;
}

/**
 * Realtime Event Types for Cafe Ordering
 */
export type RealtimeOrderEvent = "order_paid" | "order_created" | "order_status_updated";

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
