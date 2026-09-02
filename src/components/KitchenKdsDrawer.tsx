import React, { useState, useEffect, useCallback } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { Order, OrderStatus } from "../types";
import { formatPrice, formatDateTime, cn } from "../lib/utils";
import { Badge } from "./ui/Badge";
import {
  ChefHat,
  Check,
  RotateCcw,
  Clock,
  Sparkles,
  Coffee,
  Volume2,
  VolumeX,
  Radio,
  Zap,
  CheckCircle2,
  Timer,
  AlertCircle,
  Inbox,
  ArrowRight,
  UtensilsCrossed,
} from "lucide-react";
import { playOrderChime, playOrderReadyChime } from "../lib/audio";
import { useKitchenRealtime, emitLocalOrderEvent } from "../lib/realtime";

interface KitchenKdsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderStatusUpdated?: (order: Order) => void;
}

// Elapsed time helper for real-time kitchen ticket timer
function getElapsedMinutes(isoString: string): number {
  try {
    const created = new Date(isoString).getTime();
    return Math.max(0, Math.floor((Date.now() - created) / 60000));
  } catch {
    return 0;
  }
}

function formatTicketTimer(isoString: string): { text: string; isUrgent: boolean; isWarning: boolean } {
  const mins = getElapsedMinutes(isoString);
  if (mins < 1) {
    return { text: "< 1 min", isUrgent: false, isWarning: false };
  }
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    return { text: `${hours}h ${remainder}m`, isUrgent: true, isWarning: true };
  }
  return {
    text: `${mins} min${mins === 1 ? "" : "s"} ago`,
    isUrgent: mins >= 15,
    isWarning: mins >= 8,
  };
}

export const KitchenKdsDrawer: React.FC<KitchenKdsDrawerProps> = ({
  isOpen,
  onClose,
  onOrderStatusUpdated,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [simulatingWebhookId, setSimulatingWebhookId] = useState<string | null>(null);
  const [lastNotificationMsg, setLastNotificationMsg] = useState<string | null>(null);
  
  // Kitchen staff item checklist tracking: record of `orderId-itemKey` -> boolean
  const [checkedItemKeys, setCheckedItemKeys] = useState<Record<string, boolean>>({});

  // Periodic tick to refresh ticket elapsed timers every 30 seconds
  const [, setTimerTick] = useState<number>(Date.now());
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTimerTick(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const toggleItemChecked = (itemKey: string) => {
    setCheckedItemKeys((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }));
  };

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

  // Filter orders into the 4 Kanban columns
  // Column 1: PENDING_PAYMENT / NEW TICKETS
  const pendingOrders = orders.filter((o) => o.status === "PENDING_PAYMENT");
  // Column 2: PREPARING / IN PROGRESS (includes PAID & PREPARING)
  const preparingOrders = orders.filter(
    (o) => o.status === "PREPARING" || o.status === "PAID"
  );
  // Column 3: READY / PLATED
  const readyOrders = orders.filter((o) => o.status === "READY");
  // Column 4: COMPLETED
  const completedOrders = orders.filter((o) => o.status === "COMPLETED");

  // Kanban Column Config
  const kanbanColumns = [
    {
      id: "PENDING_PAYMENT",
      title: "PENDING PAYMENT / NEW TICKETS",
      shortTitle: "New Tickets",
      orders: pendingOrders,
      headerBg: "bg-amber-500/10 border-amber-500/30 text-amber-900",
      pillBg: "bg-amber-100 text-amber-900 border-amber-300",
      dotColor: "bg-amber-500",
      emptyText: "No pending payment tickets",
      columnBorder: "border-amber-200/60",
      icon: Clock,
    },
    {
      id: "PREPARING",
      title: "PREPARING / IN PROGRESS",
      shortTitle: "In Progress",
      orders: preparingOrders,
      headerBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-900",
      pillBg: "bg-emerald-100 text-emerald-900 border-emerald-300",
      dotColor: "bg-emerald-500 animate-pulse",
      emptyText: "No orders currently brewing",
      columnBorder: "border-emerald-200/60",
      icon: ChefHat,
    },
    {
      id: "READY",
      title: "READY / PLATED",
      shortTitle: "Ready",
      orders: readyOrders,
      headerBg: "bg-sky-500/10 border-sky-500/30 text-sky-900",
      pillBg: "bg-sky-100 text-sky-900 border-sky-300",
      dotColor: "bg-sky-500",
      emptyText: "No orders waiting for pickup",
      columnBorder: "border-sky-200/60",
      icon: Sparkles,
    },
    {
      id: "COMPLETED",
      title: "COMPLETED",
      shortTitle: "Completed",
      orders: completedOrders,
      headerBg: "bg-stone-500/10 border-stone-500/20 text-stone-800",
      pillBg: "bg-stone-200 text-stone-800 border-stone-300",
      dotColor: "bg-stone-400",
      emptyText: "No completed orders today",
      columnBorder: "border-stone-200/60",
      icon: CheckCircle2,
    },
  ];

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxHeight="full"
      maxWidth="7xl"
      title={
        <div className="flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-[#00A86B]" />
          <span>Kitchen Display System (KDS)</span>
        </div>
      }
      description="Live 4-column Kanban board powered by Supabase Realtime & PayMongo Webhooks"
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
        {/* Realtime Live Pulse Header Bar */}
        <div className="bg-stone-900 text-white p-3 sm:p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
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
              <span className="text-stone-400">New:</span>{" "}
              <strong className="text-amber-400 font-mono">{pendingOrders.length}</strong>
            </div>
            <div>
              <span className="text-stone-400">Brewing:</span>{" "}
              <strong className="text-emerald-400 font-mono">{preparingOrders.length}</strong>
            </div>
            <div>
              <span className="text-stone-400">Ready:</span>{" "}
              <strong className="text-sky-400 font-mono">{readyOrders.length}</strong>
            </div>
            <div>
              <span className="text-stone-400">Total:</span>{" "}
              <strong className="text-stone-200 font-mono">{orders.length}</strong>
            </div>
          </div>
        </div>

        {/* Live Notification Toast Banner */}
        {lastNotificationMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-500 text-white text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 animate-pulse" />
              <span>{lastNotificationMsg}</span>
            </div>
          </div>
        )}

        {/* 4-COLUMN KANBAN BOARD CONTAINER */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 overflow-x-auto min-h-[580px] bg-stone-50/50 rounded-2xl border border-stone-200/70">
          {kanbanColumns.map((col) => {
            const ColumnIcon = col.icon;
            return (
              <div
                key={col.id}
                className={cn(
                  "flex flex-col bg-white rounded-2xl border shadow-2xs min-w-[280px] md:min-w-0 flex-1 max-h-[calc(90vh-170px)]",
                  col.columnBorder
                )}
              >
                {/* Column Header */}
                <div
                  className={cn(
                    "p-3 rounded-t-2xl border-b flex items-center justify-between gap-2 shrink-0 select-none",
                    col.headerBg
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", col.dotColor)} />
                    <ColumnIcon className="h-4 w-4 shrink-0 opacity-80" />
                    <h2 className="text-xs font-black tracking-tight uppercase truncate" title={col.title}>
                      {col.title}
                    </h2>
                  </div>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-mono font-bold border shrink-0",
                      col.pillBg
                    )}
                  >
                    {col.orders.length}
                  </span>
                </div>

                {/* Tickets List Area */}
                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                  {col.orders.length === 0 ? (
                    <div className="py-12 px-3 text-center border-2 border-dashed border-stone-200/80 rounded-xl my-2">
                      <Inbox className="h-7 w-7 mx-auto text-stone-300 mb-1.5" />
                      <p className="text-xs font-medium text-stone-400">{col.emptyText}</p>
                    </div>
                  ) : (
                    col.orders.map((order) => {
                      const timerInfo = formatTicketTimer(order.createdAt);
                      const isPreparing = order.status === "PREPARING" || order.status === "PAID";
                      const isReady = order.status === "READY";
                      const isPending = order.status === "PENDING_PAYMENT";
                      const isCompleted = order.status === "COMPLETED";

                      return (
                        <div
                          key={order.id}
                          className={cn(
                            "p-3.5 rounded-xl border flex flex-col justify-between transition-all relative shadow-xs group",
                            isReady
                              ? "bg-sky-50/50 border-sky-300 ring-1 ring-sky-200"
                              : isPreparing
                              ? "bg-white border-emerald-400 ring-1 ring-emerald-300"
                              : isPending
                              ? "bg-amber-50/30 border-amber-200"
                              : "bg-stone-50/70 border-stone-200 opacity-90"
                          )}
                        >
                          <div className="space-y-3">
                            {/* Ticket Header: Order Number, Status Badge & Type */}
                            <div className="flex items-start justify-between pb-2 border-b border-stone-200/60 gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-black text-lg text-stone-900 tracking-tight">
                                    {order.orderNumber}
                                  </span>
                                  <Badge status={order.status} className="scale-90 origin-left" />
                                </div>
                                <p className="text-[11px] text-stone-500 mt-0.5 font-medium">
                                  {order.customerName || "Guest"} ·{" "}
                                  <span className="font-semibold text-stone-700">
                                    {order.orderType === "DINE_IN" ? "Dine-in" : "Takeaway"}
                                  </span>
                                </p>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-xs font-bold text-stone-900 font-display block">
                                  {formatPrice(order.totalAmount)}
                                </span>
                                <span className="text-[10px] text-stone-400 block font-medium">
                                  {order.paymentMethod === "QRPH" ? "PayMongo QR Ph" : "Cash at Counter"}
                                </span>
                              </div>
                            </div>

                            {/* Ticket Timer Banner */}
                            <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-stone-100/90 border border-stone-200/50">
                              <span className="flex items-center gap-1 text-stone-600 font-medium">
                                <Clock className="h-3 w-3 text-stone-400" />
                                {formatDateTime(order.createdAt)}
                              </span>
                              <span
                                className={cn(
                                  "flex items-center gap-1 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]",
                                  timerInfo.isUrgent
                                    ? "bg-rose-100 text-rose-800"
                                    : timerInfo.isWarning
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-stone-200/70 text-stone-700"
                                )}
                              >
                                <Timer
                                  className={cn(
                                    "h-3 w-3",
                                    isPreparing && "animate-spin text-emerald-600"
                                  )}
                                />
                                {timerInfo.text}
                              </span>
                            </div>

                            {/* Itemized List with Interactive Checkboxes */}
                            <div className="space-y-2 text-xs">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                                Items ({order.items.length})
                              </p>
                              <div className="space-y-1.5">
                                {order.items.map((item, idx) => {
                                  const itemKey = `${order.id}-${item.id || idx}`;
                                  const isChecked = !!checkedItemKeys[itemKey];

                                  return (
                                    <div
                                      key={idx}
                                      className={cn(
                                        "p-2 rounded-lg border transition-all text-xs",
                                        isChecked
                                          ? "bg-emerald-50/50 border-emerald-200/70 opacity-75"
                                          : "bg-stone-50 border-stone-200/60"
                                      )}
                                    >
                                      <div className="flex items-start gap-2">
                                        <button
                                          type="button"
                                          onClick={() => toggleItemChecked(itemKey)}
                                          className={cn(
                                            "mt-0.5 h-4 w-4 rounded flex items-center justify-center border transition-all shrink-0 cursor-pointer",
                                            isChecked
                                              ? "bg-emerald-600 border-emerald-600 text-white"
                                              : "bg-white border-stone-300 hover:border-emerald-500"
                                          )}
                                          title={isChecked ? "Mark as uncompleted" : "Mark item prepared"}
                                        >
                                          {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                        </button>

                                        <div className="flex-1 min-w-0">
                                          <div
                                            className={cn(
                                              "flex justify-between font-bold text-stone-900 leading-tight",
                                              isChecked && "line-through text-stone-400 font-normal"
                                            )}
                                          >
                                            <span className="truncate">
                                              {item.quantity}x {item.productName}
                                            </span>
                                          </div>

                                          {/* Customizations */}
                                          {item.customizations && (
                                            <div className="text-[11px] text-stone-600 mt-1 flex flex-wrap gap-x-1 gap-y-0.5">
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

                                          {/* Item Special Instructions */}
                                          {item.customizations?.specialInstructions && (
                                            <div className="text-[10px] text-amber-800 font-medium italic mt-1 bg-amber-100/60 px-1.5 py-0.5 rounded">
                                              "{item.customizations.specialInstructions}"
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Ticket Customer Special Notes */}
                            {order.notes && (
                              <div className="text-[11px] bg-amber-50 p-2 rounded-lg text-amber-900 border border-amber-200/70">
                                <strong className="text-amber-950">Note:</strong> {order.notes}
                              </div>
                            )}
                          </div>

                          {/* Primary Status Update Action Button at Bottom of Ticket */}
                          <div className="mt-3 pt-2.5 border-t border-stone-200/70 flex flex-col gap-1.5">
                            {/* Column 1 Action: Cash Accept OR PayMongo Webhook Simulation */}
                            {order.status === "PENDING_PAYMENT" && (
                              <div className="flex flex-col gap-1.5">
                                {order.paymentMethod === "CASH" ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Accept Cash & Brew</span>
                                  </button>
                                ) : (
                                  <div className="space-y-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleSimulateWebhook(order)}
                                      disabled={simulatingWebhookId === order.id}
                                      className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                                      title="Simulate PayMongo payment.paid webhook event"
                                    >
                                      <Zap className="h-3.5 w-3.5" />
                                      <span>
                                        {simulatingWebhookId === order.id
                                          ? "Firing Webhook..."
                                          : "Simulate PayMongo Paid"}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                                      className="w-full py-1.5 px-3 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                                    >
                                      <span>Manual Override & Brew</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Column 2 Action: PAID -> PREPARING or PREPARING -> READY */}
                            {order.status === "PAID" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                                className="w-full py-2 px-3 rounded-xl bg-[#00A86B] hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                              >
                                <ChefHat className="h-3.5 w-3.5" />
                                <span>Start Brewing</span>
                              </button>
                            )}

                            {order.status === "PREPARING" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(order.id, "READY")}
                                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                              >
                                <Coffee className="h-3.5 w-3.5" />
                                <span>Mark as Ready</span>
                              </button>
                            )}

                            {/* Column 3 Action: READY -> COMPLETED */}
                            {order.status === "READY" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(order.id, "COMPLETED")}
                                className="w-full py-2 px-3 rounded-xl bg-stone-900 hover:bg-black active:scale-98 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Complete Order</span>
                              </button>
                            )}

                            {/* Column 4 Action: COMPLETED (Option to re-open if needed) */}
                            {order.status === "COMPLETED" && (
                              <div className="flex items-center justify-between pt-0.5">
                                <span className="text-[11px] text-stone-500 font-semibold flex items-center gap-1">
                                  <Check className="h-3 w-3 text-emerald-600" /> Served & Closed
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(order.id, "READY")}
                                  className="text-[10px] text-stone-400 hover:text-stone-700 underline cursor-pointer"
                                >
                                  Reopen
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
};

