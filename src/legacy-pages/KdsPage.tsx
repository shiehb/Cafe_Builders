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
      // KDS never shows unpaid tickets (R2). Orders that are still
      // PENDING_PAYMENT are excluded server-side and stay invisible to the
      // kitchen until payment is confirmed (PAID).
      const res = await fetch("/api/orders?excludeStatus=PENDING_PAYMENT");
      if (res.ok) {
        const data = await res.json();
        setOrders((data.data || []).filter((o: Order) => o.status !== "PENDING_PAYMENT"));
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
      // R2 gate: an unpaid PENDING_PAYMENT order must never enter the kitchen
      // queue through the realtime feed either. Ignore such tickets entirely.
      if (order.status === "PENDING_PAYMENT") {
        return;
      }
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

  // 3 Kanban Columns — PENDING_PAYMENT is intentionally absent (R2): the
  // kitchen only ever sees PAID+ tickets.
  const preparingOrders = orders.filter(
    (o) => o.status === "PREPARING" || o.status === "PAID"
  );
  const readyOrders = orders.filter((o) => o.status === "READY");
  const completedOrders = orders.filter((o) => o.status === "COMPLETED");

  const activeTicketsCount = preparingOrders.length;

  const kanbanColumns = [
    {
      id: "PREPARING",
      title: "PREPARING / IN PROGRESS",
      shortTitle: "In Progress",
      orders: preparingOrders,
      headerBg: "bg-transparent text-gray-900 border-b border-gray-200",
      pillBg: "text-gray-900",
      dotColor: "bg-gray-400",
      emptyText: "No orders currently brewing",
      columnBorder: "border-r border-gray-200",
      icon: ChefHat,
    },
    {
      id: "READY",
      title: "READY / PLATED",
      shortTitle: "Ready",
      orders: readyOrders,
      headerBg: "bg-transparent text-gray-900 border-b border-gray-200",
      pillBg: "text-gray-900",
      dotColor: "bg-gray-400",
      emptyText: "No orders waiting for pickup",
      columnBorder: "border-r border-gray-200",
      icon: Sparkles,
    },
    {
      id: "COMPLETED",
      title: "COMPLETED",
      shortTitle: "Completed",
      orders: completedOrders,
      headerBg: "bg-transparent text-gray-900 border-b border-gray-200",
      pillBg: "text-gray-900",
      dotColor: "bg-gray-400",
      emptyText: "No completed orders today",
      columnBorder: "border-gray-200",
      icon: CheckCircle2,
    },
  ];

  return (
    <StaffGuard
      pinEnvKey="KDS_PIN"
      title="Kitchen Display System"
      subtitle="Enter 4-digit PIN to access live kitchen order queue"
      roleName="Kitchen Staff Terminal"
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
            className="p-2 border border-gray-300 text-gray-700 transition-all cursor-pointer"
            title="Refresh order queue"
          >
            <RotateCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </button>
        }
      >
        <div className="space-y-4 flex-1 flex flex-col h-full bg-white text-gray-900 p-2">
          {/* Notification Banner */}
          {lastNotificationMsg && (
            <div className="p-2 border border-gray-900 text-xs font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span>{lastNotificationMsg}</span>
              </div>
            </div>
          )}

          {/* Sub-bar: Status metrics */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <span>
                Tickets in Queue:{" "}
                <strong className="font-mono text-sm">{orders.length}</strong>
              </span>
              <span className="text-gray-300">|</span>
              <span>
                Brewing: <strong className="font-mono">{preparingOrders.length}</strong>
              </span>
              <span>
                Ready: <strong className="font-mono">{readyOrders.length}</strong>
              </span>
              <span>
                Completed: <strong className="font-mono">{completedOrders.length}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-gray-900" />
              <span>Realtime Connected</span>
            </div>
          </div>

          {/* 4-COLUMN KANBAN BOARD CONTAINER */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200 flex-1">
            {kanbanColumns.map((col) => {
              const ColumnIcon = col.icon;
              return (
                <div
                  key={col.id}
                  className="flex flex-col px-3 min-w-[250px] flex-1 max-h-[calc(100vh-170px)]"
                >
                  {/* Column Header */}
                  <div
                    className={cn(
                      "py-2 border-b border-gray-200 flex items-center justify-between gap-2 shrink-0 select-none",
                      col.headerBg
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ColumnIcon className="h-4 w-4 shrink-0" />
                      <h2 className="text-xs font-bold uppercase truncate" title={col.title}>
                        {col.title}
                      </h2>
                    </div>
                    <span className="text-xs font-mono font-bold shrink-0">
                      ({col.orders.length})
                    </span>
                  </div>

                  {/* Column Ticket Items */}
                  <div className="py-2 flex-1 overflow-y-auto space-y-4 divide-y divide-gray-200">
                    {col.orders.length === 0 ? (
                      <div className="py-8 text-center my-2">
                        <p className="text-xs text-gray-400">{col.emptyText}</p>
                      </div>
                    ) : (
                      col.orders.map((order) => {
                        const timerInfo = formatTicketTimer(order.createdAt);
                        const isPreparing = order.status === "PREPARING" || order.status === "PAID";

                        return (
                          <div
                            key={order.id}
                            className="pt-3 pb-2 flex flex-col justify-between transition-all"
                          >
                            <div className="space-y-2">
                              {/* Header */}
                              <div className="flex items-start justify-between pb-1 border-b border-gray-100 gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-base tracking-tight">
                                      #{order.orderNumber}
                                    </span>
                                    <Badge status={order.status} className="scale-90 origin-left" />
                                  </div>
                                  <p className="text-[11px] text-gray-600 mt-0.5">
                                    {order.customerName || "Guest"} ·{" "}
                                    <span className="font-semibold">
                                      {order.orderType === "DINE_IN" ? "Dine-in" : "Takeaway"}
                                    </span>
                                  </p>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="text-xs font-bold font-display block">
                                    {formatPrice(order.totalAmount)}
                                  </span>
                                  <span className="text-[10px] text-gray-500 block">
                                    {order.paymentMethod === "QRPH" ? "PayMongo QR Ph" : "Cash at Counter"}
                                  </span>
                                </div>
                              </div>

                              {/* Elapsed Timer Banner */}
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="flex items-center gap-1 text-gray-500">
                                  <Clock className="h-3 w-3" />
                                  {formatDateTime(order.createdAt)}
                                </span>
                                <span className="flex items-center gap-1 font-mono font-bold text-[10px]">
                                  <Timer className={cn("h-3 w-3", isPreparing && "animate-spin")} />
                                  {timerInfo.text}
                                </span>
                              </div>

                              {/* Checklist Items */}
                              <div className="space-y-1 text-xs">
                                <p className="text-[10px] font-bold uppercase text-gray-500">
                                  Items ({order.items.length})
                                </p>
                                <div className="space-y-1.5">
                                  {order.items.map((item, idx) => {
                                    const itemKey = `${order.id}-${item.id || idx}`;
                                    const isChecked = !!checkedItemKeys[itemKey];

                                    return (
                                      <div key={idx} className="text-xs">
                                        <div className="flex items-start gap-2">
                                          <button
                                            type="button"
                                            onClick={() => toggleItemChecked(itemKey)}
                                            className={cn(
                                              "mt-0.5 h-3.5 w-3.5 border border-gray-400 flex items-center justify-center shrink-0 cursor-pointer",
                                              isChecked && "bg-gray-900 border-gray-900 text-white"
                                            )}
                                            title={isChecked ? "Mark pending" : "Mark prepared"}
                                          >
                                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                          </button>

                                          <div className="flex-1 min-w-0">
                                            <div
                                              className={cn(
                                                "font-bold leading-tight",
                                                isChecked && "line-through text-gray-400 font-normal"
                                              )}
                                            >
                                              <span>
                                                {item.quantity}x {item.productName}
                                              </span>
                                            </div>

                                            {item.customizations && (
                                              <div className="text-[11px] text-gray-600 mt-0.5 flex flex-wrap gap-x-1">
                                                {item.customizations.iceLevel && (
                                                  <span>{item.customizations.iceLevel}</span>
                                                )}
                                                {item.customizations.sweetness && (
                                                  <span>· {item.customizations.sweetness}</span>
                                                )}
                                                {item.customizations.milkOption && (
                                                  <span>· {item.customizations.milkOption}</span>
                                                )}
                                                {item.customizations.addOns && item.customizations.addOns.length > 0 && (
                                                  <span>
                                                    · {item.customizations.addOns.join(", ")}
                                                  </span>
                                                )}
                                              </div>
                                            )}

                                            {item.customizations?.specialInstructions && (
                                              <div className="text-[10px] italic mt-0.5">
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
                                <div className="text-[11px] text-gray-700 italic border-l-2 border-gray-300 pl-2">
                                  <strong>Note:</strong> {order.notes}
                                </div>
                              )}
                            </div>

                            {/* Ticket Action Button at Bottom */}
                            <div className="mt-3 pt-2 border-t border-gray-100 flex flex-col gap-1.5">
                              {order.status === "PAID" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                                  className="w-full py-1.5 border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  <ChefHat className="h-3.5 w-3.5" />
                                  <span>Start Brewing</span>
                                </button>
                              )}

                              {order.status === "PREPARING" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(order.id, "READY")}
                                  className="w-full py-1.5 border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  <Coffee className="h-3.5 w-3.5" />
                                  <span>Mark as Ready</span>
                                </button>
                              )}

                              {order.status === "READY" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(order.id, "COMPLETED")}
                                  className="w-full py-1.5 border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>Complete Order</span>
                                </button>
                              )}

                              {order.status === "COMPLETED" && (
                                <div className="flex items-center justify-between pt-0.5">
                                  <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Served & Closed
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(order.id, "READY")}
                                    className="text-[10px] text-gray-500 hover:text-gray-900 underline cursor-pointer"
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