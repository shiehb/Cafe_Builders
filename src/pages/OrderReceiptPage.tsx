import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  QrCode,
  Banknote,
  Receipt,
  UtensilsCrossed,
  PackageOpen,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChefHat,
  BellRing,
} from "lucide-react";
import { Order, OrderStatus } from "../types";
import { formatPrice, formatDateTime } from "../lib/utils";
import { navigate } from "../lib/router";
import { useCart } from "../context/CartContext";
import { useOrderRealtime } from "../lib/realtime";

interface OrderReceiptPageProps {
  orderIdOrNumber: string;
}

export const OrderReceiptPage: React.FC<OrderReceiptPageProps> = ({ orderIdOrNumber }) => {
  const { savedOrders, updateOrder, showToast } = useCart();

  // Find order in local cache first
  const [order, setOrder] = useState<Order | null>(() => {
    return (
      savedOrders.find(
        (o) => o.id === orderIdOrNumber || o.orderNumber === orderIdOrNumber
      ) || null
    );
  });

  const [loading, setLoading] = useState<boolean>(!order);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState<boolean>(false);

  // Fetch live order from server
  const fetchLiveOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderIdOrNumber}`);
      if (res.ok) {
        const json = await res.json();
        if (json.order) {
          setOrder(json.order);
          updateOrder(json.order);
        }
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  }, [orderIdOrNumber, updateOrder]);

  useEffect(() => {
    fetchLiveOrder();
    const interval = setInterval(fetchLiveOrder, 5000);
    return () => clearInterval(interval);
  }, [fetchLiveOrder]);

  // Realtime subscription for this specific order
  useOrderRealtime(
    order?.id || orderIdOrNumber,
    useCallback(
      (updated) => {
        if (updated) {
          setOrder(updated);
          updateOrder(updated);
        }
      },
      [updateOrder]
    )
  );

  // Simulate Instant PayMongo Webhook Payment (Test Mode)
  const handleSimulatePayment = async () => {
    if (!order) return;
    setIsSimulatingPayment(true);
    try {
      const res = await fetch("/api/simulate/webhook-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          paymentIntentId: order.paymentIntentId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.order) {
        setOrder(data.order);
        updateOrder(data.order);
        showToast("Payment confirmed! Kitchen received your order.", "success");
      } else {
        showToast(data.error || "Simulation failed", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to simulate payment", "error");
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#00A86B] border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-stone-500 font-bold">Loading order status...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <Receipt className="h-12 w-12 text-stone-400" />
        <div>
          <h2 className="text-base font-black text-stone-900">Order Not Found</h2>
          <p className="text-xs text-stone-500 mt-1">
            Could not find an order matching "{orderIdOrNumber}".
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="px-5 py-2.5 rounded-2xl bg-[#00A86B] text-white text-xs font-black hover:bg-emerald-700 transition-all cursor-pointer"
        >
          Back to Menu
        </button>
      </div>
    );
  }

  const isPaid = order.status !== "PENDING_PAYMENT";
  const isReady = order.status === "READY";
  const isCompleted = order.status === "COMPLETED";

  const getStatusBadge = () => {
    switch (order.status) {
      case "PENDING_PAYMENT":
        return {
          label: "Awaiting Payment",
          bgColor: "bg-amber-100 text-amber-900 border-amber-200",
          icon: Clock,
        };
      case "PREPARING":
        return {
          label: "Brewing / In Preparation",
          bgColor: "bg-blue-100 text-blue-900 border-blue-200",
          icon: ChefHat,
        };
      case "READY":
        return {
          label: "Ready for Pickup!",
          bgColor: "bg-emerald-100 text-[#00A86B] border-emerald-300 animate-pulse",
          icon: BellRing,
        };
      case "COMPLETED":
        return {
          label: "Completed & Claimed",
          bgColor: "bg-stone-100 text-stone-700 border-stone-200",
          icon: CheckCircle2,
        };
      default:
        return {
          label: order.status,
          bgColor: "bg-stone-100 text-stone-700 border-stone-200",
          icon: Clock,
        };
    }
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-stone-900 flex flex-col font-sans pb-28">
      {/* 1. TOP HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-2xs">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Back to Menu"
            title="Back to Menu"
            className="p-2 -ml-2 rounded-xl text-stone-700 hover:text-stone-950 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <span className="text-xs font-black font-mono text-stone-600">
            Order #{order.orderNumber}
          </span>

          <div className="w-9" />
        </div>
      </header>

      {/* 2. ORDER HERO CARD */}
      <main className="max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-3xl p-6 border border-stone-200/80 shadow-md text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-black shadow-2xs">
            <StatusIcon className="h-4 w-4" />
            <span>{statusBadge.label}</span>
          </div>

          <div>
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">
              Claim Ticket Number
            </p>
            <h1 className="text-4xl sm:text-5xl font-black text-stone-900 tracking-tight font-mono mt-1">
              {order.orderNumber}
            </h1>
            <p className="text-xs text-stone-500 font-medium mt-1">
              Placed for <span className="font-bold text-stone-800">{order.customerName}</span> •{" "}
              {order.orderType === "DINE_IN" ? "Dine-In Cafe" : "Takeaway"}
            </p>
          </div>

          {/* Progress Tracker Bar */}
          <div className="pt-2">
            <div className="grid grid-cols-4 gap-2 text-center">
              {/* Step 1: Received */}
              <div className="space-y-1.5">
                <div
                  className={`h-2 rounded-full ${
                    order.status === "PENDING_PAYMENT" ? "bg-amber-400" : "bg-[#00A86B]"
                  }`}
                />
                <span className="text-[10px] font-bold text-stone-500 block">Received</span>
              </div>
              {/* Step 2: Paid */}
              <div className="space-y-1.5">
                <div
                  className={`h-2 rounded-full ${
                    isPaid ? "bg-[#00A86B]" : "bg-stone-200"
                  }`}
                />
                <span className="text-[10px] font-bold text-stone-500 block">Confirmed</span>
              </div>
              {/* Step 3: Preparing */}
              <div className="space-y-1.5">
                <div
                  className={`h-2 rounded-full ${
                    order.status === "PREPARING" || isReady || isCompleted
                      ? "bg-[#00A86B]"
                      : "bg-stone-200"
                  }`}
                />
                <span className="text-[10px] font-bold text-stone-500 block">Brewing</span>
              </div>
              {/* Step 4: Ready */}
              <div className="space-y-1.5">
                <div
                  className={`h-2 rounded-full ${
                    isReady || isCompleted ? "bg-[#00A86B]" : "bg-stone-200"
                  }`}
                />
                <span className="text-[10px] font-bold text-stone-500 block">Ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. PAYMENT ACTION CARD (Dynamic QR Ph or Cash) */}
        {!isPaid && (
          <div className="bg-white rounded-3xl p-6 border-2 border-emerald-600/30 shadow-md space-y-4">
            {order.paymentMethod === "QRPH" ? (
              <div className="space-y-4 text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-[#00A86B] text-xs font-black">
                  <QrCode className="h-3.5 w-3.5" />
                  <span>Scan to Pay with Any QR Ph App</span>
                </div>

                <div className="bg-stone-50 p-4 rounded-2xl inline-block border border-stone-200 shadow-inner">
                  {order.qrCodeUrl ? (
                    <img
                      src={order.qrCodeUrl}
                      alt="PayMongo Dynamic QR Ph"
                      className="h-48 w-48 sm:h-56 sm:w-56 mx-auto object-contain"
                    />
                  ) : (
                    <div className="h-48 w-48 flex items-center justify-center text-stone-400">
                      <QrCode className="h-20 w-20 animate-pulse" />
                    </div>
                  )}
                  <p className="text-[10px] text-stone-400 font-mono mt-2">
                    Official PayMongo QR Ph Rail
                  </p>
                </div>

                <div>
                  <p className="text-sm font-black text-stone-900">
                    Amount Due:{" "}
                    <span className="text-emerald-700 font-display">
                      {formatPrice(order.totalAmount)}
                    </span>
                  </p>
                  <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                    Open GCash, Maya, ShopeePay, BPI, or any PH banking app, select "Scan to Pay",
                    and scan this QR code.
                  </p>
                </div>

                {/* Simulation Button for Testing */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={isSimulatingPayment}
                    onClick={handleSimulatePayment}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-emerald-400 text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 border border-stone-700"
                  >
                    {isSimulatingPayment ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Verifying Webhook...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Simulate Instant Webhook Payment (Test Mode)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                  <Banknote className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-base font-black text-stone-900">Cash Payment at Counter</h2>
                  <p className="text-xs text-stone-600 mt-1 max-w-sm mx-auto">
                    Please present claim ticket{" "}
                    <span className="font-mono font-bold text-stone-900">#{order.orderNumber}</span>{" "}
                    and pay{" "}
                    <span className="font-bold text-emerald-700">
                      {formatPrice(order.totalAmount)}
                    </span>{" "}
                    to the cashier to begin preparation.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. ITEMIZED DIGITAL RECEIPT */}
        <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h2 className="text-xs font-black uppercase text-stone-400 tracking-wider">
              Itemized Receipt
            </h2>
            <span className="text-xs text-stone-400 font-mono">
              {formatDateTime(order.createdAt)}
            </span>
          </div>

          <div className="divide-y divide-stone-100">
            {order.items.map((item, idx) => (
              <div key={idx} className="py-3 flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="font-black text-stone-900">
                    {item.quantity}x {item.productName}
                  </p>
                  {item.customizations && (
                    <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-stone-500 font-medium">
                      {item.customizations.iceLevel && <span>{item.customizations.iceLevel}</span>}
                      {item.customizations.sweetness && (
                        <span>• {item.customizations.sweetness}</span>
                      )}
                      {item.customizations.milkOption && (
                        <span>• {item.customizations.milkOption}</span>
                      )}
                      {item.customizations.addOns?.map((a, i) => (
                        <span key={i}>• {a}</span>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <p className="text-[10px] text-stone-500 italic mt-0.5">Note: {item.notes}</p>
                  )}
                </div>
                <span className="font-mono font-black text-stone-900 shrink-0">
                  {formatPrice(item.subtotal || item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-stone-100 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-500">
              <span>Subtotal</span>
              <span className="font-mono">{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Payment Mode</span>
              <span className="font-bold">
                {order.paymentMethod === "QRPH" ? "Dynamic QR Ph" : "Cash at Counter"}
              </span>
            </div>
            <div className="border-t border-stone-100 pt-2 flex justify-between text-base font-black text-stone-900">
              <span>Total Paid / Due</span>
              <span className="font-display text-[#00A86B]">{formatPrice(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* 5. ACTION BUTTONS */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex-1 h-12 rounded-2xl bg-[#00A86B] hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 transition-all cursor-pointer"
          >
            <span>Order Something Else</span>
          </button>
        </div>
      </main>
    </div>
  );
};
