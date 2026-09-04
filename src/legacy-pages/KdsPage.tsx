import React, { useState, useEffect, useCallback } from "react";
import { StaffGuard } from "../components/staff/StaffGuard";
import { StaffLayout } from "../components/staff/StaffLayout";
import { Order, OrderStatus } from "../types";
import { formatPrice, formatDateTime, cn } from "../lib/utils";
import { Badge } from "../components/ui/Badge";
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
  Filter,
} from "lucide-react";
import { playOrderChime, playOrderReadyChime } from "../lib/audio";
import { useKitchenRealtime, emitLocalOrderEvent } from "../lib/realtime";

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

export function KdsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [simulatingWebhookId, setSimulatingWebhookId] = useState<string | null>(null);
  const [lastNotificationMsg, setLastNotificationMsg] = useState<string | null>(null);
  const [checkedItemKeys, setCheckedItemKeys] = useState<Record<string, boolean>>({});

  // Refresh elapsed timers every 30 seconds
  const [, setTimerTick] = useState<number>(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerTick(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time synchronization
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
        setLastNotificationMsg(`⚡ PayMongo Paid: Order #${order.orderNumber} is ready to brew!`);
        setTimeout(() => setLastNotificationMsg(null), 5000);
      } else if (event === "order_created") {
        setLastNotificationMsg(`🔔 New Incoming Order #${order.orderNumber}`);
        setTimeout(() => setLastNotificationMsg(null), 5000);
      } else if (event === "order_status_updated" && order.status === "READY") {
        setLastNotificationMsg(`Order #${order.orderNumber} marked Ready for Pickup!`);
        setTimeout(() => setLastNotificationMsg(null), 4000);
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

  const handleSimulateWebhook = async (order: Order) => {
    setSimulatingWebhookId(order.id);
    try {
      const res = await fetch("/api/simulate-webhook", {
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
            prev.map((o) => (o.id === order.id ? data.order : o))
          );
          emitLocalOrderEvent("order_paid", data.order);
        }
        if (soundEnabled) playOrderChime();
      }
    } catch (err) {
      console.error("Failed to simulate webhook", err);
    } finally {
      setSimulatingWebhookId(null);
    }
  };

  // 4 Kanban Columns
  const pendingOrders = orders.filter((o) => o.status === "PENDING_PAYMENT");
  const preparingOrders = orders.filter(
    (o) => o.status === "PREPARING" || o.status === "PAID"
  );
  const readyOrders = orders.filter((o) => o.status === "READY");
  const completedOrders = orders.filter((o) => o.status === "COMPLETED");

  const activeTicketsCount = pendingOrders.length + preparingOrders.length;

  const kanbanColumns = [
    {
      id: "PENDING_PAYMENT",
      title: "PENDING PAYMENT / NEW TICKETS",
      shortTitle: "New Tickets",
      orders: pendingOrders,
      headerBg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
      pillBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      dotColor: "bg-amber-400",
      emptyText: "No pending payment tickets",
      columnBorder: "border-amber-500/30",
      icon: Clock,
    },
    {
      id: "PREPARING",
      title: "PREPARING / IN PROGRESS",
      shortTitle: "In Progress",
      orders: preparingOrders,
      headerBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
      pillBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      dotColor: "bg-emerald-400 animate-pulse",
      emptyText: "No orders currently brewing",
      columnBorder: "border-emerald-500/30",
      icon: ChefHat,
    },
    {
      id: "READY",
      title: "READY / PLATED",
      shortTitle: "Ready",
      orders: readyOrders,
      headerBg: "bg-sky-500/10 border-sky-500/30 text-sky-300",
      pillBg: "bg-sky-500/20 text-sky-300 border-sky-500/40",
      dotColor: "bg-sky-400",
      emptyText: "No orders waiting for pickup",
      columnBorder: "border-sky-500/30",
      icon: Sparkles,
    },
    {
      id: "COMPLETED",
      title: "COMPLETED",
      shortTitle: "Completed",
      orders: completedOrders,
      headerBg: "bg-[#F7F9FA] border-[#D1D5DB] text-[#374151]",
      pillBg: "bg-[#F7F9FA] text-[#374151] border-[#D1D5DB]",
      dotColor: "bg-stone-500",
      emptyText: "No completed orders today",
      columnBorder: "border-[#E5E7EB]",
      icon: CheckCircle2,
    },
  ];

  return (
    <StaffGuard
      pinEnvKey="KDS_PIN"
      title="Kitchen Display System"
      subtitle="Enter 4-digit PIN to access live kitchen order queue"
      roleName="Kitchen Staff Terminal"
      defaultPin="1234"
    >
      <StaffLayout
        activeTab="kds"
        title="Kitchen Display System"
        subtitle="Real-time 4-column order queue with PayMongo webhooks"
        pinEnvKey="KDS_PIN"
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        activeOrderCount={activeTicketsCount}
        headerRight={
          <button
            type="button"
            onClick={fetchOrders}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white hover:bg-[#F7F9FA] text-[#374151] border border-[#E5E7EB] transition-all cursor-pointer"
            title="Refresh order queue"
          >
            <RotateCcw className={cn("h-4 w-4", isLoading && "animate-spin text-[#00A86B]")} />
          </button>
        }
      >
        <div className="space-y-4 flex-1 flex flex-col">
          {/* Notification Banner */}
          {lastNotificationMsg && (
            <div className="p-3 rounded-2xl bg-[#00A86B] text-white text-xs font-bold flex items-center justify-between shadow-lg shadow-[#00A86B]/20 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span>{lastNotificationMsg}</span>
              </div>
            </div>
          )}

          {/* Sub-bar: Status metrics */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 border border-[#E5E7EB]/80 p-3 rounded-2xl text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-[#6B7280]">
                Tickets in Queue:{" "}
                <strong className="text-white font-mono text-sm">{orders.length}</strong>
              </span>
              <span className="text-[#6B7280]">|</span>
              <span className="text-amber-400">
                Pending: <strong className="font-mono">{pendingOrders.length}</strong>
              </span>
              <span className="text-emerald-400">
                Brewing: <strong className="font-mono">{preparingOrders.length}</strong>
              </span>
              <span className="text-sky-400">
                Ready: <strong className="font-mono">{readyOrders.length}</strong>
              </span>
              <span className="text-[#6B7280]">
                Completed: <strong className="font-mono">{completedOrders.length}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 text-[#6B7280] text-[11px]">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime Connected</span>
            </div>
          </div>

          {/* 4-COLUMN KANBAN BOARD CONTAINER */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto min-h-[600px] flex-1 pb-4">
            {kanbanColumns.map((col) => {
              const ColumnIcon = col.icon;
              return (
                <div
                  key={col.id}
                  className={cn(
                    "flex flex-col bg-white/60 rounded-2xl border min-w-[280px] md:min-w-0 flex-1 shadow-sm backdrop-blur-xs",
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

                  {/* Column Ticket Items */}
                  <div className="p-3 flex-1 overflow-y-auto space-y-3 max-h-[calc(85vh-160px)]">
                    {col.orders.length === 0 ? (
                      <div className="py-14 px-3 text-center border border-dashed border-[#E5E7EB] rounded-xl my-2">
                        <Inbox className="h-7 w-7 mx-auto text-[#9CA3AF] mb-1.5" />
                        <p className="text-xs font-medium text-[#6B7280]">{col.emptyText}</p>
                      </div>
                    ) : (
                      col.orders.map((order) => {
                        const timerInfo = formatTicketTimer(order.createdAt);
                        const isPreparing = order.status === "PREPARING" || order.status === "PAID";
                        const isReady = order.status === "READY";
                        const isPending = order.status === "PENDING_PAYMENT";

                        return (
                          <div
                            key={order.id}
                            className={cn(
                              "p-3.5 rounded-xl border flex flex-col justify-between transition-all relative shadow-sm",
                              isReady
                                ? "bg-sky-950/30 border-sky-600/50 ring-1 ring-sky-500/30"
                                : isPreparing
                                ? "bg-white border-emerald-500/50 ring-1 ring-emerald-500/30"
                                : isPending
                                ? "bg-white/90 border-amber-500/30"
                                : "bg-white/40 border-[#E5E7EB] opacity-85"
                            )}
                          >
                            <div className="space-y-3">
                              {/* Header */}
                              <div className="flex items-start justify-between pb-2 border-b border-[#E5E7EB] gap-2">
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-black text-lg text-white tracking-tight">
                                      {order.orderNumber}
                                    </span>
                                    <Badge status={order.status} className="scale-90 origin-left" />
                                  </div>
                                  <p className="text-[11px] text-[#6B7280] mt-0.5 font-medium">
                                    {order.customerName || "Guest"} ·{" "}
                                    <span className="font-semibold text-[#374151]">
                                      {order.orderType === "DINE_IN" ? "Dine-in" : "Takeaway"}
                                    </span>
                                  </p>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="text-xs font-bold text-white font-display block">
                                    {formatPrice(order.totalAmount)}
                                  </span>
                                  <span className="text-[10px] text-[#6B7280] block font-medium">
                                    {order.paymentMethod === "QRPH" ? "PayMongo QR Ph" : "Cash at Counter"}
                                  </span>
                                </div>
                              </div>

                              {/* Elapsed Timer Banner */}
                              <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-white/80 border border-[#E5E7EB]/80">
                                <span className="flex items-center gap-1 text-[#6B7280] font-medium">
                                  <Clock className="h-3 w-3 text-[#6B7280]" />
                                  {formatDateTime(order.createdAt)}
                                </span>
                                <span
                                  className={cn(
                                    "flex items-center gap-1 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]",
                                    timerInfo.isUrgent
                                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                      : timerInfo.isWarning
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                      : "bg-[#F7F9FA] text-[#374151]"
                                  )}
                                >
                                  <Timer
                                    className={cn(
                                      "h-3 w-3",
                                      isPreparing && "animate-spin text-emerald-400"
                                    )}
                                  />
                                  {timerInfo.text}
                                </span>
                              </div>

                              {/* Checklist Items */}
                              <div className="space-y-1.5 text-xs">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
                                  Items ({order.items.length})
                                </p>
                                <div className="space-y-1">
                                  {order.items.map((item, idx) => {
                                    const itemKey = `${order.id}-${item.id || idx}`;
                                    const isChecked = !!checkedItemKeys[itemKey];

                                    return (
                                      <div
                                        key={idx}
                                        className={cn(
                                          "p-2 rounded-lg border transition-all text-xs",
                                          isChecked
                                            ? "bg-emerald-950/20 border-emerald-800/40 opacity-70"
                                            : "bg-white/60 border-[#E5E7EB]"
                                        )}
                                      >
                                        <div className="flex items-start gap-2">
                                          <button
                                            type="button"
                                            onClick={() => toggleItemChecked(itemKey)}
                                            className={cn(
                                              "mt-0.5 h-4 w-4 rounded flex items-center justify-center border transition-all shrink-0 cursor-pointer",
                                              isChecked
                                                ? "bg-emerald-600 border-emerald-500 text-white"
                                                : "bg-white border-[#D1D5DB] hover:border-emerald-500"
                                            )}
                                            title={isChecked ? "Mark pending" : "Mark prepared"}
                                          >
                                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                          </button>

                                          <div className="flex-1 min-w-0">
                                            <div
                                              className={cn(
                                                "flex justify-between font-bold text-[#1F2937] leading-tight",
                                                isChecked && "line-through text-[#6B7280] font-normal"
                                              )}
                                            >
                                              <span className="truncate">
                                                {item.quantity}x {item.productName}
                                              </span>
                                            </div>

                                            {item.customizations && (
                                              <div className="text-[11px] text-[#6B7280] mt-1 flex flex-wrap gap-x-1 gap-y-0.5">
                                                {item.customizations.iceLevel && (
                                                  <span className="font-semibold text-emerald-400">
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
                                                  <span className="text-[#374151]">
                                                    · {item.customizations.addOns.join(", ")}
                                                  </span>
                                                )}
                                              </div>
                                            )}

                                            {item.customizations?.specialInstructions && (
                                              <div className="text-[10px] text-amber-300 font-medium italic mt-1 bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.5 rounded">
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

                              {/* Customer Note */}
                              {order.notes && (
                                <div className="text-[11px] bg-amber-950/30 p-2 rounded-lg text-amber-300 border border-amber-800/40">
                                  <strong className="text-amber-200">Note:</strong> {order.notes}
                                </div>
                              )}
                            </div>

                            {/* Ticket Action Button at Bottom */}
                            <div className="mt-3 pt-2.5 border-t border-[#E5E7EB] flex flex-col gap-1.5">
                              {order.status === "PENDING_PAYMENT" && (
                                <div className="flex flex-col gap-1.5">
                                  {order.paymentMethod === "CASH" ? (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
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
                                        className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-stone-950 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                                        title="Simulate PayMongo webhook payment.paid event"
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
                                        className="w-full py-1.5 px-3 rounded-lg bg-[#F7F9FA] hover:bg-stone-700 text-[#374151] text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                                      >
                                        <span>Manual Override & Brew</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {order.status === "PAID" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                                  className="w-full py-2 px-3 rounded-xl bg-[#00A86B] hover:bg-emerald-500 active:scale-98 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                                >
                                  <ChefHat className="h-3.5 w-3.5" />
                                  <span>Start Brewing</span>
                                </button>
                              )}

                              {order.status === "PREPARING" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(order.id, "READY")}
                                  className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                                >
                                  <Coffee className="h-3.5 w-3.5" />
                                  <span>Mark as Ready</span>
                                </button>
                              )}

                              {order.status === "READY" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(order.id, "COMPLETED")}
                                  className="w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-white text-stone-950 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-98"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Complete Order</span>
                                </button>
                              )}

                              {order.status === "COMPLETED" && (
                                <div className="flex items-center justify-between pt-0.5">
                                  <span className="text-[11px] text-[#6B7280] font-semibold flex items-center gap-1">
                                    <Check className="h-3 w-3 text-emerald-400" /> Served & Closed
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(order.id, "READY")}
                                    className="text-[10px] text-[#6B7280] hover:text-[#374151] underline cursor-pointer"
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
      </StaffLayout>
    </StaffGuard>
  );
}
