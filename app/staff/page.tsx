"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Order, OrderStatus } from "@/src/types";
import { formatPrice, formatDateTime } from "@/src/lib/utils";
import { Badge } from "@/src/components/ui/Badge";
import {
  ChefHat,
  Check,
  RotateCcw,
  Clock,
  Volume2,
  VolumeX,
  Radio,
  Zap,
  CheckCircle2,
  Coffee,
  Sparkles,
  Timer,
} from "lucide-react";
import { playOrderChime, playOrderReadyChime } from "@/src/lib/audio";
import { useKitchenRealtime, emitLocalOrderEvent } from "@/src/lib/realtime";

export default function StaffKitchenKdsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastNotification, setLastNotification] = useState<string | null>(null);

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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time synchronization via Supabase Realtime channel `kitchen-orders` + SSE
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
        setLastNotification(`⚡ Webhook: Order #${order.orderNumber} paid & brewing!`);
        setTimeout(() => setLastNotification(null), 4000);
      } else if (event === "order_created") {
        setLastNotification(`🔔 New Order #${order.orderNumber}`);
        setTimeout(() => setLastNotification(null), 4000);
      }
    },
    [soundEnabled]
  );

  useKitchenRealtime(handleRealtimeEvent);

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
        if (soundEnabled && nextStatus === "READY") {
          playOrderReadyChime();
        }
      }
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === "ALL") return true;
    return o.status === filter;
  });

  const preparingCount = orders.filter((o) => o.status === "PREPARING" || o.status === "PAID").length;
  const readyCount = orders.filter((o) => o.status === "READY").length;

  return (
    <div className="min-h-screen bg-stone-100 p-4 md:p-8 font-sans text-stone-900">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black font-display tracking-tight text-stone-900">
                Kitchen Display System (KDS)
              </h1>
              <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Supabase Realtime Synced · Channel: <code>kitchen-orders</code></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playOrderChime();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                soundEnabled
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                  : "bg-stone-100 text-stone-500"
              }`}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-600" /> : <VolumeX className="h-4 w-4" />}
              <span>{soundEnabled ? "Audio Chime Active" : "Muted"}</span>
            </button>

            <button
              onClick={fetchOrders}
              className="px-3.5 py-2 rounded-xl bg-stone-900 text-white hover:bg-black text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <RotateCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {lastNotification && (
          <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
            <Radio className="h-4 w-4 animate-pulse" />
            <span>{lastNotification}</span>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: "ALL", label: `All Orders (${orders.length})` },
            { id: "PREPARING", label: `Brewing / Preparing (${preparingCount})` },
            { id: "READY", label: `Ready for Pickup (${readyCount})` },
            { id: "COMPLETED", label: `Completed` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filter === tab.id
                  ? "bg-stone-900 text-white shadow-xs"
                  : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className={`bg-white rounded-2xl p-5 border flex flex-col justify-between shadow-xs transition-all ${
                order.status === "READY"
                  ? "border-amber-300 ring-2 ring-amber-200"
                  : order.status === "PREPARING"
                  ? "border-emerald-400 ring-2 ring-emerald-200"
                  : "border-stone-200"
              }`}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start border-b border-stone-100 pb-2">
                  <div>
                    <span className="font-mono font-black text-2xl text-stone-900">
                      {order.orderNumber}
                    </span>
                    <p className="text-xs text-stone-500">
                      {order.customerName || "Guest"} · {order.orderType === "DINE_IN" ? "Dine-in" : "Takeaway"}
                    </p>
                  </div>
                  <Badge status={order.status} />
                </div>

                <div className="space-y-2">
                  {order.items.map((it, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-stone-50 border border-stone-100 text-xs">
                      <div className="font-bold text-stone-900">
                        {it.quantity}x {it.productName}
                      </div>
                      {it.customizations && (
                        <div className="text-[11px] text-stone-600 mt-1">
                          {it.customizations.iceLevel} · {it.customizations.sweetness} · {it.customizations.milkOption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                <span className="text-xs text-stone-400 font-mono">
                  {formatDateTime(order.createdAt)}
                </span>

                <div className="flex items-center gap-1.5">
                  {order.status === "PREPARING" && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, "READY")}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Mark as Ready
                    </button>
                  )}
                  {order.status === "READY" && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, "COMPLETED")}
                      className="px-3.5 py-1.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Complete Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
