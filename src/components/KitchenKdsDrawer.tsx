import React, { useState, useEffect, useCallback } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { Order, OrderStatus } from "../types";
import { formatPrice, formatDateTime } from "../lib/utils";
import { Badge } from "./ui/Badge";
import {
  ChefHat,
  Check,
  RotateCcw,
  Clock,
  AlertCircle,
  Sparkles,
  Coffee,
  Volume2,
  VolumeX,
  Radio,
  Zap,
  CheckCircle2,
  Timer,
  Play,
  ArrowRight,
} from "lucide-react";
import { playOrderChime, playOrderReadyChime } from "../lib/audio";
import { useKitchenRealtime, emitLocalOrderEvent } from "../lib/realtime";

interface KitchenKdsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderStatusUpdated?: (order: Order) => void;
}

export const KitchenKdsDrawer: React.FC<KitchenKdsDrawerProps> = ({
  isOpen,
  onClose,
  onOrderStatusUpdated,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [simulatingWebhookId, setSimulatingWebhookId] = useState<string | null>(null);
  const [lastNotificationMsg, setLastNotificationMsg] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load KDS orders", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load when drawer opens
  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen, fetchOrders]);

  // Real-time listener via Supabase Realtime channel `kitchen-orders` + SSE
  const handleRealtimeEvent = useCallback(
    ({
      event,
      order,
    }: {
      event: "order_created" | "order_paid" | "order_status_updated";
      order: Order;
    }) => {
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === order.id);
        if (exists) {
          return prev.map((o) => (o.id === order.id ? order : o));
        }
        return [order, ...prev];
      });

      if (soundEnabled) {
        if (event === "order_created" || event === "order_paid") {
          playOrderChime();
        } else if (order.status === "READY") {
          playOrderReadyChime();
        }
      }

      if (event === "order_paid") {
        setLastNotificationMsg(`⚡ Webhook: Order #${order.orderNumber} paid & brewing!`);
        setTimeout(() => setLastNotificationMsg(null), 4000);
      } else if (event === "order_created") {
        setLastNotificationMsg(`🔔 New incoming order: #${order.orderNumber}`);
        setTimeout(() => setLastNotificationMsg(null), 4000);
      }

      if (onOrderStatusUpdated) {
        onOrderStatusUpdated(order);
      }
    },
    [soundEnabled, onOrderStatusUpdated]
  );

  useKitchenRealtime(handleRealtimeEvent);

  // Status update handler (Mark as Ready -> READY, Complete Order -> COMPLETED)
  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedOrder = data.order || { id: orderId, status: nextStatus };
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
        );
        emitLocalOrderEvent("order_status_updated", updatedOrder);
        if (onOrderStatusUpdated && data.order) {
          onOrderStatusUpdated(data.order);
        }
        if (soundEnabled && nextStatus === "READY") {
          playOrderReadyChime();
        }
      }
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  // Simulate PayMongo Webhook (payment.paid)
  const handleSimulateWebhook = async (order: Order) => {
    setSimulatingWebhookId(order.id);
    try {
      const res = await fetch("/api/webhooks/paymongo/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          paymentIntentId: order.paymentIntentId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.order) {
          setOrders((prev) =>
            prev.map((o) => (o.id === data.order.id ? data.order : o))
          );
          emitLocalOrderEvent("order_paid", data.order);
          if (soundEnabled) playOrderChime();
          setLastNotificationMsg(`⚡ Webhook simulated for #${data.order.orderNumber}`);
          setTimeout(() => setLastNotificationMsg(null), 4000);
        }
      }
    } catch (e) {
      console.error("Failed to simulate webhook:", e);
    } finally {
      setSimulatingWebhookId(null);
    }
  };

  if (!isOpen) return null;

  const filteredOrders = orders.filter((o) => {
    if (filter === "ALL") return true;
    return o.status === filter;
  });

  const pendingCount = orders.filter((o) => o.status === "PENDING_PAYMENT").length;
  const preparingCount = orders.filter((o) => o.status === "PREPARING" || o.status === "PAID").length;
  const readyCount = orders.filter((o) => o.status === "READY").length;
  const completedCount = orders.filter((o) => o.status === "COMPLETED").length;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxHeight="full"
      maxWidth="3xl"
      title={
        <div className="flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-[#00A86B]" />
          <span>Kitchen Display System (KDS)</span>
        </div>
      }
      description="Live cafe order queue powered by Supabase Realtime & PayMongo Webhooks"
      headerRight={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playOrderChime();
            }}
            className={`h-9 px-2.5 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
              soundEnabled
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                : "bg-stone-100 text-stone-500 hover:bg-stone-200"
            }`}
            title={soundEnabled ? "Audio Chimes Active" : "Audio Muted"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-600" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden sm:inline">{soundEnabled ? "Chime On" : "Muted"}</span>
          </button>

          <button
            type="button"
            onClick={fetchOrders}
            className="h-9 w-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors active:scale-95 cursor-pointer shadow-2xs"
            title="Refresh queue"
          >
            <RotateCcw className={`h-4 w-4 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Realtime Live Pulse Banner */}
        <div className="bg-stone-900 text-white p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-stone-200">Supabase Realtime Sync:</span>
            <span className="text-xs font-mono bg-stone-800 px-2 py-0.5 rounded-md text-emerald-400 font-semibold">
              channel: kitchen-orders
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-stone-300">
            <div>
              <span className="text-stone-400">Brewing:</span>{" "}
              <strong className="text-emerald-400 font-mono">{preparingCount}</strong>
            </div>
            <div>
              <span className="text-stone-400">Ready:</span>{" "}
              <strong className="text-amber-400 font-mono">{readyCount}</strong>
            </div>
          </div>
        </div>

        {/* Live Notification Toast Banner if an event just fired */}
        {lastNotificationMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-500 text-white text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 animate-pulse" />
              <span>{lastNotificationMsg}</span>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-200">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "ALL", label: `All (${orders.length})` },
              {
                id: "PENDING_PAYMENT",
                label: `Pending Payment (${pendingCount})`,
              },
              {
                id: "PREPARING",
                label: `Brewing (${preparingCount})`,
              },
              {
                id: "READY",
                label: `Ready for Pickup (${readyCount})`,
              },
              {
                id: "COMPLETED",
                label: `Completed (${completedCount})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  filter === tab.id
                    ? "bg-[#00A86B] text-white shadow-xs"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Order Cards Grid */}
        {filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-stone-500">
            <Coffee className="h-10 w-10 mx-auto text-stone-300 mb-2" />
            <p className="text-sm font-semibold">No active orders in this queue view</p>
            <p className="text-xs text-stone-400 mt-1">
              Orders placed by customers will stream and appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[58vh] overflow-y-auto pr-1">
            {filteredOrders.map((order) => {
              const isUrgent =
                order.status === "PREPARING" || order.status === "PAID";
              const isReady = order.status === "READY";
              const isPending = order.status === "PENDING_PAYMENT";

              return (
                <div
                  key={order.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between transition-all relative ${
                    isReady
                      ? "bg-amber-50/40 border-amber-300 ring-1 ring-amber-200"
                      : isUrgent
                      ? "bg-white border-emerald-400 shadow-xs ring-1 ring-emerald-300"
                      : isPending
                      ? "bg-stone-50/90 border-stone-200"
                      : "bg-stone-50/60 border-stone-200 opacity-80"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Ticket Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-stone-200/60">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xl text-stone-900 tracking-wide">
                            {order.orderNumber}
                          </span>
                          <Badge status={order.status} />
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {order.customerName || "Guest"} · {order.orderType === "DINE_IN" ? "Dine-in" : "Takeaway"}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-stone-800 font-display">
                          {formatPrice(order.totalAmount)}
                        </span>
                        <div className="text-[10px] text-stone-400 font-medium">
                          {order.paymentMethod === "QRPH" ? "PayMongo QR Ph" : "Cash at Counter"}
                        </div>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-2 text-xs">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-stone-100/70 border border-stone-200/40"
                        >
                          <div className="flex justify-between font-bold text-stone-900">
                            <span>
                              {item.quantity}x {item.productName}
                            </span>
                          </div>

                          {item.customizations && (
                            <div className="text-[11px] text-stone-600 mt-1 space-x-1">
                              {item.customizations.iceLevel && (
                                <span className="font-semibold text-emerald-800">
                                  {item.customizations.iceLevel}
                                </span>
                              )}
                              {item.customizations.sweetness && (
                                <span>· {item.customizations.sweetness}</span>
                              )}
                              {item.customizations.milkOption && (
                                <span>· {item.customizations.milkOption}</span>
                              )}
                              {item.customizations.addOns && item.customizations.addOns.length > 0 && (
                                <span className="text-stone-700">
                                  · {item.customizations.addOns.join(", ")}
                                </span>
                              )}
                            </div>
                          )}

                          {item.customizations?.specialInstructions && (
                            <div className="text-[11px] text-amber-800 font-medium italic mt-1 bg-amber-100/60 p-1 rounded-md">
                              "{item.customizations.specialInstructions}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <div className="text-[11px] bg-amber-50 p-2 rounded-xl text-amber-800 border border-amber-200/60">
                        <strong>Customer Note:</strong> {order.notes}
                      </div>
                    )}
                  </div>

                  {/* KDS Action Controls Footer */}
                  <div className="mt-4 pt-3 border-t border-stone-200/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[11px] text-stone-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(order.createdAt)}
                      </span>
                      {order.status === "PREPARING" && (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <Timer className="h-3 w-3 animate-spin" /> Brewing in progress
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      {/* Webhook Simulation Trigger for QR Ph pending orders */}
                      {order.status === "PENDING_PAYMENT" && order.paymentMethod === "QRPH" && (
                        <button
                          type="button"
                          onClick={() => handleSimulateWebhook(order)}
                          disabled={simulatingWebhookId === order.id}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Simulate PayMongo payment.paid webhook event"
                        >
                          <Zap className="h-3 w-3" />
                          <span>
                            {simulatingWebhookId === order.id ? "Firing..." : "Simulate PayMongo Paid"}
                          </span>
                        </button>
                      )}

                      {/* Cash Payment confirmation */}
                      {order.status === "PENDING_PAYMENT" && order.paymentMethod === "CASH" && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Accept Cash & Brew</span>
                        </button>
                      )}

                      {/* Transition to Brewing if marked paid */}
                      {order.status === "PAID" && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                          className="px-3 py-1.5 rounded-xl bg-[#00A86B] hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <ChefHat className="h-3.5 w-3.5" />
                          <span>Start Brewing</span>
                        </button>
                      )}

                      {/* Required Button: "Mark as Ready" -> Updates status to READY */}
                      {order.status === "PREPARING" && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, "READY")}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                        >
                          <Coffee className="h-3.5 w-3.5" />
                          <span>Mark as Ready</span>
                        </button>
                      )}

                      {/* Required Button: "Complete Order" -> Updates status to COMPLETED */}
                      {order.status === "READY" && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, "COMPLETED")}
                          className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Complete Order</span>
                        </button>
                      )}

                      {order.status === "COMPLETED" && (
                        <span className="text-xs text-stone-400 font-semibold px-2 py-1 bg-stone-200/60 rounded-lg">
                          Served & Completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
