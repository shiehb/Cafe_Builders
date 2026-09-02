import { useEffect, useCallback } from "react";
import { Order, OrderStatus } from "../types";
import { getSupabaseClient, RealtimeOrderPayload } from "./supabase";

export interface RealtimeMessage {
  type: "order_created" | "order_paid" | "order_status_updated" | "ping";
  order?: Order;
  orderId?: string;
  orderNumber?: string;
  status?: OrderStatus;
  timestamp: string;
}

type OrderEventCallback = (payload: {
  event: "order_created" | "order_paid" | "order_status_updated";
  order: Order;
}) => void;

/**
 * Hook to subscribe to live Kitchen Orders (Supabase Realtime + Server-Sent Stream + Local Events)
 */
export function useKitchenRealtime(onOrderEvent: OrderEventCallback) {
  useEffect(() => {
    let sseSource: EventSource | null = null;
    let isSubscribed = true;

    // 1. Listen via Supabase Realtime Channel 'kitchen-orders'
    const supabase = getSupabaseClient();
    let supabaseChannel: any = null;

    if (supabase) {
      try {
        supabaseChannel = supabase
          .channel("kitchen-orders")
          .on("broadcast", { event: "order_paid" }, (res: any) => {
            if (isSubscribed && res?.payload?.order) {
              onOrderEvent({ event: "order_paid", order: res.payload.order });
            }
          })
          .on("broadcast", { event: "order_created" }, (res: any) => {
            if (isSubscribed && res?.payload?.order) {
              onOrderEvent({ event: "order_created", order: res.payload.order });
            }
          })
          .on("broadcast", { event: "order_status_updated" }, (res: any) => {
            if (isSubscribed && res?.payload?.order) {
              onOrderEvent({ event: "order_status_updated", order: res.payload.order });
            }
          })
          .subscribe();
      } catch (err) {
        console.warn("Supabase Realtime subscription error:", err);
      }
    }

    // 2. Listen via Server-Sent Events (SSE) from express backend
    try {
      sseSource = new EventSource("/api/realtime/stream");
      sseSource.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const data = JSON.parse(event.data) as RealtimeMessage;
          if (data && data.order && data.type !== "ping") {
            onOrderEvent({
              event: data.type as any,
              order: data.order,
            });
          }
        } catch {}
      };
      sseSource.onerror = () => {
        // SSE auto-reconnects
      };
    } catch (e) {
      console.warn("SSE connection error:", e);
    }

    // 3. Local In-Window Event Listener for instant zero-latency UI update
    const handleLocalEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ event: any; order: Order }>;
      if (isSubscribed && customEvent.detail?.order) {
        onOrderEvent({
          event: customEvent.detail.event || "order_status_updated",
          order: customEvent.detail.order,
        });
      }
    };

    window.addEventListener("cafe_realtime_order", handleLocalEvent);

    return () => {
      isSubscribed = false;
      if (supabase && supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
      if (sseSource) {
        sseSource.close();
      }
      window.removeEventListener("cafe_realtime_order", handleLocalEvent);
    };
  }, [onOrderEvent]);
}

/**
 * Hook to subscribe to live status updates for a specific Customer Order ID
 */
export function useOrderTrackingRealtime(
  orderId: string | null | undefined,
  onOrderUpdated: (order: Order) => void
) {
  useEffect(() => {
    if (!orderId) return;
    let isSubscribed = true;

    // 1. Supabase Realtime Channel for specific order
    const supabase = getSupabaseClient();
    let supabaseChannel: any = null;

    if (supabase) {
      try {
        supabaseChannel = supabase
          .channel(`order-${orderId}`)
          .on("broadcast", { event: "status_changed" }, (res: any) => {
            if (isSubscribed && res?.payload?.order) {
              onOrderUpdated(res.payload.order);
            }
          })
          .subscribe();
      } catch (err) {
        console.warn("Supabase order channel error:", err);
      }
    }

    // 2. Server-Sent Events stream
    let sseSource: EventSource | null = null;
    try {
      sseSource = new EventSource("/api/realtime/stream");
      sseSource.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const data = JSON.parse(event.data) as RealtimeMessage;
          if (data && data.order && (data.order.id === orderId || data.order.orderNumber === orderId)) {
            onOrderUpdated(data.order);
          }
        } catch {}
      };
    } catch {}

    // 3. Local custom event
    const handleLocalEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ event: any; order: Order }>;
      if (
        isSubscribed &&
        customEvent.detail?.order &&
        (customEvent.detail.order.id === orderId || customEvent.detail.order.orderNumber === orderId)
      ) {
        onOrderUpdated(customEvent.detail.order);
      }
    };

    window.addEventListener("cafe_realtime_order", handleLocalEvent);

    return () => {
      isSubscribed = false;
      if (supabase && supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
      if (sseSource) {
        sseSource.close();
      }
      window.removeEventListener("cafe_realtime_order", handleLocalEvent);
    };
  }, [orderId, onOrderUpdated]);
}

export const useOrderRealtime = useOrderTrackingRealtime;

/**
 * Dispatches an instant local window event to synchronize all active drawer components
 */
export function emitLocalOrderEvent(
  event: "order_created" | "order_paid" | "order_status_updated",
  order: Order
) {
  if (typeof window === "undefined") return;
  const ev = new CustomEvent("cafe_realtime_order", {
    detail: { event, order },
  });
  window.dispatchEvent(ev);
}

/**
 * Hook to subscribe to live Product Inventory & Availability Updates (Supabase Realtime + SSE + Local)
 */
export function useProductInventoryRealtime(onProductUpdated: (product: any) => void) {
  useEffect(() => {
    let sseSource: EventSource | null = null;
    let isSubscribed = true;

    // 1. Supabase Realtime channel `menu-updates`
    const supabase = getSupabaseClient();
    let supabaseChannel: any = null;

    if (supabase) {
      try {
        supabaseChannel = supabase
          .channel("menu-updates")
          .on("broadcast", { event: "product_updated" }, (res: any) => {
            if (isSubscribed && res?.payload?.product) {
              onProductUpdated(res.payload.product);
            }
          })
          .subscribe();
      } catch (err) {
        console.warn("Supabase product updates subscription error:", err);
      }
    }

    // 2. Server-Sent Events (SSE) stream from backend
    try {
      sseSource = new EventSource("/api/realtime/stream");
      sseSource.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === "product_updated" && data.product) {
            onProductUpdated(data.product);
          }
        } catch {}
      };
    } catch (e) {
      console.warn("SSE product inventory connection error:", e);
    }

    // 3. Local In-Window Event
    const handleLocalEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ product: any }>;
      if (isSubscribed && customEvent.detail?.product) {
        onProductUpdated(customEvent.detail.product);
      }
    };

    window.addEventListener("cafe_realtime_product", handleLocalEvent);

    return () => {
      isSubscribed = false;
      if (supabase && supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
      if (sseSource) {
        sseSource.close();
      }
      window.removeEventListener("cafe_realtime_product", handleLocalEvent);
    };
  }, [onProductUpdated]);
}

/**
 * Dispatches an instant local window event for product updates
 */
export function emitLocalProductEvent(product: any) {
  if (typeof window === "undefined") return;
  const ev = new CustomEvent("cafe_realtime_product", {
    detail: { product },
  });
  window.dispatchEvent(ev);
}
