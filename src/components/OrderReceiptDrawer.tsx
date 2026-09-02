import React, { useState, useEffect, useCallback } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { Order, OrderStatus } from "../types";
import { formatPrice, formatDateTime } from "../lib/utils";
import {
  Printer,
  CheckCircle2,
  Clock,
  Coffee,
  RotateCcw,
  Sparkles,
  QrCode,
  ChefHat,
  Receipt,
  UtensilsCrossed,
  Package,
  Radio,
  Zap,
  Bell,
  Check,
} from "lucide-react";
import { Badge } from "./ui/Badge";
import { useOrderTrackingRealtime, emitLocalOrderEvent } from "../lib/realtime";
import { playOrderReadyChime } from "../lib/audio";
import confetti from "canvas-confetti";

interface OrderReceiptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onOrderUpdated?: (order: Order) => void;
  onOrderAgain?: () => void;
}

export const OrderReceiptDrawer: React.FC<OrderReceiptDrawerProps> = ({
  isOpen,
  onClose,
  order,
  onOrderUpdated,
  onOrderAgain,
}) => {
  const [currentOrder, setCurrentOrder] = useState<Order | null>(order);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState<boolean>(false);
  const [hasCelebratedReady, setHasCelebratedReady] = useState<boolean>(false);

  useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  // Real-time synchronization via Supabase Realtime + SSE
  const handleLiveOrderUpdate = useCallback(
    (updatedOrder: Order) => {
      if (updatedOrder && (updatedOrder.id === currentOrder?.id || updatedOrder.orderNumber === currentOrder?.orderNumber)) {
        setCurrentOrder(updatedOrder);
        if (onOrderUpdated) {
          onOrderUpdated(updatedOrder);
        }

        if (updatedOrder.status === "READY" && !hasCelebratedReady) {
          playOrderReadyChime();
          setHasCelebratedReady(true);
          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.6 },
            });
          } catch {}
        }
      }
    },
    [currentOrder?.id, currentOrder?.orderNumber, onOrderUpdated, hasCelebratedReady]
  );

  useOrderTrackingRealtime(currentOrder?.id, handleLiveOrderUpdate);

  if (!isOpen || !currentOrder) return null;

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/orders/${currentOrder.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.data) {
          setCurrentOrder(data.data);
          if (onOrderUpdated) onOrderUpdated(data.data);
        }
      }
    } catch {
      // fallback
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // Simulate PayMongo Webhook (payment.paid)
  const handleSimulatePaymentWebhook = async () => {
    if (!currentOrder) return;
    setIsSimulatingPayment(true);
    try {
      const res = await fetch("/api/webhooks/paymongo/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: currentOrder.id,
          paymentIntentId: currentOrder.paymentIntentId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.order) {
          setCurrentOrder(data.order);
          emitLocalOrderEvent("order_paid", data.order);
          if (onOrderUpdated) onOrderUpdated(data.order);
        }
      }
    } catch (e) {
      console.error("Simulation failed:", e);
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusIndex = (st: OrderStatus) => {
    switch (st) {
      case "PENDING_PAYMENT":
        return 0;
      case "PAID":
      case "PREPARING":
        return 1;
      case "READY":
        return 2;
      case "COMPLETED":
        return 3;
      default:
        return 0;
    }
  };

  const currentStepIdx = getStatusIndex(currentOrder.status);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxHeight="full"
      maxWidth="lg"
      title={
        <div className="flex items-center justify-center gap-2">
          <Receipt className="h-4 w-4 text-[#00A86B]" />
          <span>Receipt & Live Tracking</span>
        </div>
      }
      description={`Ticket #${currentOrder.orderNumber}`}
      headerRight={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleManualRefresh}
            className="h-9 w-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors active:scale-95 cursor-pointer shadow-2xs"
            title="Refresh status"
          >
            <RotateCcw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="h-9 w-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors active:scale-95 cursor-pointer shadow-2xs"
            title="Print receipt"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        {/* Ticket Header Banner */}
        <div className="bg-stone-900 text-white p-4.5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-400">
                Order Ticket
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-stone-800 text-emerald-300">
                <Radio className="h-2.5 w-2.5 animate-pulse text-emerald-400" />
                Live Sync
              </span>
            </div>
            <div className="text-3xl font-black font-mono tracking-wider mt-0.5">
              {currentOrder.orderNumber}
            </div>
            <p className="text-xs text-stone-300 mt-1 flex items-center gap-1.5">
              <span>{currentOrder.customerName || "Valued Guest"}</span>
              <span>·</span>
              <span>{currentOrder.orderType === "DINE_IN" ? "Dine-in" : "Takeaway"}</span>
            </p>
          </div>

          <div className="relative z-10 text-right">
            <Badge status={currentOrder.status} />
            <div className="text-[11px] text-stone-400 mt-2">
              {formatDateTime(currentOrder.createdAt)}
            </div>
          </div>
        </div>

        {/* Live Order Status Alert Banners */}
        {currentOrder.status === "READY" && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-center gap-3 shadow-xs animate-in zoom-in-95">
            <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bell className="h-5 w-5 animate-bounce" />
            </div>
            <div className="text-xs">
              <strong className="font-bold block text-sm text-amber-900">
                Ready for Pickup!
              </strong>
              <span>
                Please present Ticket <strong>#{currentOrder.orderNumber}</strong> at the barista counter.
              </span>
            </div>
          </div>
        )}

        {currentOrder.status === "PREPARING" && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center gap-3 shadow-xs">
            <div className="h-9 w-9 rounded-xl bg-[#00A86B] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Coffee className="h-5 w-5 animate-pulse" />
            </div>
            <div className="text-xs">
              <strong className="font-bold block text-emerald-900">
                Brewing your order now
              </strong>
              <span>
                Our baristas are preparing your handcrafted drinks. Est. {currentOrder.estimatedReadyTime || "7-10 mins"}.
              </span>
            </div>
          </div>
        )}

        {/* Live Status Pipeline Steps */}
        <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
              Live Preparation Pipeline
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Realtime Synced
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                currentStepIdx >= 0
                  ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold"
                  : "bg-white border-stone-200 text-stone-400"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-[#00A86B]" />
              <span className="text-[11px]">Placed</span>
            </div>
            <div
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                currentStepIdx >= 1
                  ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold shadow-2xs ring-1 ring-emerald-200"
                  : "bg-white border-stone-200 text-stone-400"
              }`}
            >
              <ChefHat className={`h-4 w-4 ${currentStepIdx === 1 ? "text-[#00A86B] animate-pulse" : "text-stone-400"}`} />
              <span className="text-[11px]">Brewing</span>
            </div>
            <div
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                currentStepIdx >= 2
                  ? "bg-amber-50 border-amber-300 text-amber-950 font-bold shadow-2xs ring-1 ring-amber-200"
                  : "bg-white border-stone-200 text-stone-400"
              }`}
            >
              <Coffee className={`h-4 w-4 ${currentStepIdx >= 2 ? "text-amber-600 animate-bounce" : "text-stone-400"}`} />
              <span className="text-[11px]">Ready</span>
            </div>
          </div>
        </div>

        {/* Dynamic QR Ph Waiting Box (if pending payment) */}
        {currentOrder.status === "PENDING_PAYMENT" && currentOrder.paymentMethod === "QRPH" && (
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
            <div className="flex items-center justify-between text-xs text-amber-900">
              <span className="font-bold flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-amber-700" />
                <span>Awaiting Dynamic QR Ph Payment</span>
              </span>
              <span className="text-[11px] font-mono bg-amber-100 px-2 py-0.5 rounded text-amber-800">
                PayMongo Webhook Active
              </span>
            </div>

            {currentOrder.qrCodeUrl && (
              <div className="flex flex-col items-center py-1">
                <img
                  src={currentOrder.qrCodeUrl}
                  alt="QR Ph Payment"
                  className="w-36 h-36 rounded-xl border border-stone-300 bg-white p-2 shadow-2xs"
                />
                <p className="text-[11px] text-stone-500 mt-2 text-center">
                  Scan via GCash, Maya, ShopeePay, or any bank app.
                </p>
              </div>
            )}

            {/* Test Simulation Button */}
            <button
              type="button"
              onClick={handleSimulatePaymentWebhook}
              disabled={isSimulatingPayment}
              className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-2xs cursor-pointer transition-all active:scale-98"
            >
              <Zap className="h-4 w-4" />
              <span>
                {isSimulatingPayment ? "Sending Webhook Event..." : "Simulate PayMongo Payment Webhook"}
              </span>
            </button>
          </div>
        )}

        {/* Itemized Receipt Breakdown */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3 font-sans shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100 text-xs font-bold text-stone-500 uppercase">
            <span>Item Details</span>
            <span>Amount</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {currentOrder.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="font-bold text-stone-900">
                    {item.quantity}x {item.productName}
                  </div>
                  {item.customizations && (
                    <div className="text-[11px] text-stone-500 space-x-1">
                      {item.customizations.iceLevel && <span>{item.customizations.iceLevel}</span>}
                      {item.customizations.sweetness && <span>· {item.customizations.sweetness}</span>}
                      {item.customizations.milkOption && <span>· {item.customizations.milkOption}</span>}
                      {item.customizations.addOns && item.customizations.addOns.length > 0 && (
                        <span>· {item.customizations.addOns.join(", ")}</span>
                      )}
                    </div>
                  )}
                  {item.customizations?.specialInstructions && (
                    <div className="text-[10px] text-stone-500 italic mt-0.5">
                      "{item.customizations.specialInstructions}"
                    </div>
                  )}
                </div>
                <div className="font-bold text-stone-900 font-display">
                  {formatPrice(item.subtotal)}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-stone-100 space-y-1.5 text-xs text-stone-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-bold text-stone-900 font-display">{formatPrice(currentOrder.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment Mode</span>
              <span className="font-semibold text-stone-800">
                {currentOrder.paymentMethod === "QRPH" ? "PayMongo Dynamic QR Ph" : "Cash at Counter"}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-stone-200 text-sm font-extrabold text-stone-900">
              <span>Total Amount</span>
              <span className="text-[#00A86B] font-display text-base">
                {formatPrice(currentOrder.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 h-11 rounded-full border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print Receipt</span>
          </button>
          {onOrderAgain && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOrderAgain();
              }}
              className="flex-1 h-11 rounded-full bg-[#00A86B] hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>Order Again</span>
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
