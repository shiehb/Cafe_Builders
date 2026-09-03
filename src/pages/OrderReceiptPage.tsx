import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Clock,
  BellRing,
  ChefHat,
  CheckCircle2,
  QrCode,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Order } from "../types";
import { formatPrice, formatDateTime } from "../lib/utils";
import { navigate } from "../lib/router";
import { useCart } from "../context/CartContext";
import { useOrderRealtime } from "../lib/realtime";

interface OrderReceiptPageProps {
  orderIdOrNumber: string;
}

export const OrderReceiptPage: React.FC<OrderReceiptPageProps> = ({ orderIdOrNumber }) => {
  const { savedOrders, updateOrder, showToast } = useCart();

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
        const liveOrder = json.data || json.order;
        if (liveOrder) {
          setOrder(liveOrder);
          updateOrder(liveOrder);
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
    const interval = setInterval(fetchLiveOrder, 4000);
    return () => clearInterval(interval);
  }, [fetchLiveOrder]);

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

  // Simulate PayMongo Webhook Payment Verification
  const handleSimulatePayment = async () => {
    if (!order) return;
    setIsSimulatingPayment(true);
    try {
      const res = await fetch("/api/webhooks/paymongo/simulate", {
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
      } else {
        console.error("Failed to simulate payment:", data.error);
      }
    } catch (err: any) {
      console.error("Simulation error:", err);
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#00A86B] border-t-transparent animate-spin mx-auto" />
          <p className="text-[12px] text-[#6B7280] font-semibold">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-[#6B7280]">
          <Clock className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-[16px] font-semibold text-[#1F2937]">Order Not Found</h2>
          <p className="text-[12px] text-[#6B7280] mt-1">
            Could not find an order matching "{orderIdOrNumber}".
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="px-5 py-2 rounded-full bg-[#00A86B] text-white text-[12px] font-bold hover:bg-[#008F5B] transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Menu</span>
        </button>
      </div>
    );
  }

  // Determine status label and header
  const getStatusInfo = () => {
    switch (order.status) {
      case "PREPARING":
        return {
          title: "Preparing your order",
          badgeLabel: "In Preparation",
          estimate: "5 - 8 mins",
          icon: ChefHat,
        };
      case "READY":
        return {
          title: "Ready for Pickup!",
          badgeLabel: "Ready Now",
          estimate: "At Barista Counter",
          icon: BellRing,
        };
      case "COMPLETED":
        return {
          title: "Order Completed",
          badgeLabel: "Claimed",
          estimate: "Completed",
          icon: CheckCircle2,
        };
      default:
        return {
          title: "Order Confirmed",
          badgeLabel: "Order Received",
          estimate: "6 - 10 mins",
          icon: Clock,
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;
  const serviceCharge = (order.subtotal || order.totalAmount) * 0.05;

  return (
    <div className="min-h-screen bg-[#F7F9FA] text-[#1F2937] flex flex-col font-sans pb-28">
      {/* 1. TOP BAR: Back button navigation only (NO share icon, NO favorite icon) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] shadow-xs">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Back to Menu"
            title="Back to Menu"
            className="h-10 w-10 rounded-full text-[#1F2937] hover:bg-[#F7F9FA] flex items-center justify-center transition-colors cursor-pointer -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <span className="font-semibold text-[14px] leading-[20px] text-[#1F2937]">
            Order Receipt
          </span>

          <div className="w-10" />
        </div>
      </header>

      {/* 2. MAIN CONTENT */}
      <main className="max-w-2xl w-full mx-auto px-4 py-5 space-y-4">
        {/* STATUS HEADER: Big bold status text + Status Badge with subtle background tint */}
        <div className="text-center space-y-2 py-2">
          {/* Status Badge with subtle background tint: status/badge-bg (#FEF3C7) and status/badge-text (#92400E) */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] border border-amber-200/60 text-[12px] font-bold">
            <StatusIcon className="h-3.5 w-3.5" />
            <span>{statusInfo.badgeLabel}</span>
          </div>

          {/* Big bold status text */}
          <h1 className="text-[24px] font-bold text-[#1F2937] leading-[32px]">
            {statusInfo.title}
          </h1>

          <p className="text-[12px] text-[#6B7280]">
            Thank you, {order.customerName}! We're handcrafting your order with care.
          </p>
        </div>

        {/* TICKET / ORDER CARD */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-4">
          {/* Order Number highlighted in brand/primary + Pickup estimate time */}
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3.5">
            <div>
              <span className="text-[28px] sm:text-[32px] font-bold text-[#00A86B] font-mono leading-none block">
                #{order.orderNumber}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                Pickup Estimate
              </span>
              <div className="inline-flex items-center gap-1 text-[13px] font-bold text-[#1F2937] mt-0.5">
                <Clock className="h-3.5 w-3.5 text-[#00A86B]" />
                <span>{statusInfo.estimate}</span>
              </div>
            </div>
          </div>

          {/* PAYMONGO DYNAMIC QR PH PAYMENT SECTION */}
          {(order.paymentMethod === "QRPH" || order.qrCodeUrl) && (
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-[#F0FDF4]/50 p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-emerald-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-[#00A86B] text-white flex items-center justify-center font-bold shadow-xs">
                    <QrCode className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[13px] font-bold text-[#1F2937] block leading-tight">
                      PayMongo • QR Ph Scan to Pay
                    </span>
                    <span className="text-[10px] text-[#6B7280] block">
                      National QR Standard (GCash, Maya, Banks)
                    </span>
                  </div>
                </div>

                {order.status === "PENDING_PAYMENT" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-bold">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                    Awaiting Payment
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-[#00A86B] border border-emerald-300 text-[11px] font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Paid & Confirmed
                  </span>
                )}
              </div>

              {order.status === "PENDING_PAYMENT" ? (
                <div className="flex flex-col items-center justify-center text-center space-y-3 py-1">
                  {/* The PayMongo Dynamic QR Code image */}
                  <div className="p-3 bg-white border-2 border-emerald-600/20 rounded-2xl shadow-md inline-block relative">
                    {order.qrCodeUrl ? (
                      <img
                        src={order.qrCodeUrl}
                        alt={`PayMongo Dynamic QR Ph Code for Order #${order.orderNumber}`}
                        className="w-56 h-56 sm:w-60 sm:h-60 object-contain rounded-xl"
                      />
                    ) : (
                      <div className="w-56 h-56 flex flex-col items-center justify-center bg-stone-50 rounded-xl text-[#6B7280] text-xs gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-[#00A86B]" />
                        <span>Generating PayMongo QR...</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 max-w-sm">
                    <div className="text-[20px] font-bold text-[#00A86B] font-mono">
                      {formatPrice(order.totalAmount)}
                    </div>
                    <p className="text-[12px] font-bold text-[#1F2937]">
                      Scan with GCash, Maya, ShopeePay, or Mobile Banking
                    </p>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed">
                      Launch your e-wallet app, tap <strong>Scan QR</strong>, and scan the dynamic PayMongo code above. Once paid, this ticket updates automatically in real-time.
                    </p>
                  </div>

                  {/* Supported Payment App Pills */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                    <span className="px-2 py-0.5 rounded-md bg-white border border-[#E5E7EB] text-[10px] font-bold text-[#1F2937]">
                      GCash
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-[#E5E7EB] text-[10px] font-bold text-[#1F2937]">
                      Maya
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-[#E5E7EB] text-[10px] font-bold text-[#1F2937]">
                      ShopeePay
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-[#E5E7EB] text-[10px] font-bold text-[#1F2937]">
                      BPI / BDO / UnionBank
                    </span>
                  </div>

                  {/* Instant Simulation / Testing button for sandbox */}
                  <div className="pt-2 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={handleSimulatePayment}
                      disabled={isSimulatingPayment}
                      className="w-full h-10 rounded-full bg-white hover:bg-emerald-50 text-[#00A86B] border border-emerald-300 font-bold text-[12px] flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-60 active:scale-98"
                    >
                      {isSimulatingPayment ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Verifying with PayMongo...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-[#00A86B]" />
                          <span>Simulate PayMongo Payment Confirmation</span>
                        </>
                      )}
                    </button>
                    <p className="text-[9px] text-[#9CA3AF] text-center mt-1">
                      (Test mode: triggers PayMongo payment.paid webhook simulation)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl p-3 border border-emerald-200 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 text-[#00A86B] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] font-bold text-[#1F2937] block">
                      PayMongo QR Ph Payment Verified
                    </span>
                    <span className="text-[11px] text-[#6B7280] block truncate">
                      {order.paymentIntentId ? `Ref: ${order.paymentIntentId}` : "Paid via QR Ph"} • Handcrafted preparation in progress
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ordered Items Breakdown (Quantity, Title, Modifiers, Price) */}
          <div className="space-y-3">
            <h2 className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">
              Ordered Items ({order.items.reduce((sum, item) => sum + item.quantity, 0)})
            </h2>

            <div className="divide-y divide-[#E5E7EB]">
              {order.items.map((item, idx) => {
                const modifiers: string[] = [];
                if (item.customizations?.iceLevel) modifiers.push(item.customizations.iceLevel);
                if (item.customizations?.sweetness) modifiers.push(item.customizations.sweetness);
                if (item.customizations?.milkOption) modifiers.push(item.customizations.milkOption);
                if (item.customizations?.addOns && item.customizations.addOns.length > 0) {
                  modifiers.push(...item.customizations.addOns);
                }
                const modifierText = modifiers.join(" • ") || "Standard Recipe";

                return (
                  <div key={idx} className="py-2.5 flex items-start justify-between gap-3 text-[12px]">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#1F2937] leading-[18px]">
                        {item.quantity}x {item.productName}
                      </p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">
                        {modifierText}
                      </p>
                      {item.notes && (
                        <p className="text-[10px] text-[#6B7280] italic mt-0.5">
                          Note: {item.notes}
                        </p>
                      )}
                    </div>
                    <span className="font-bold text-[#1F2937] shrink-0">
                      {formatPrice(item.subtotal || item.unitPrice * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Summary (Subtotal, Tax, Payment method used) */}
          <div className="border-t border-[#E5E7EB] pt-3.5 space-y-2 text-[12px]">
            <div className="flex justify-between text-[#6B7280]">
              <span>Subtotal</span>
              <span className="font-semibold text-[#1F2937]">
                {formatPrice(order.subtotal || order.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Tax / Service Charge (5%)</span>
              <span className="font-semibold text-[#1F2937]">
                {formatPrice(serviceCharge)}
              </span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Payment Method</span>
              <span className="font-semibold text-[#1F2937]">
                {order.paymentMethod === "QRPH" ? "GCash / QR Ph" : "Cash at Counter"}
              </span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Order Type</span>
              <span className="font-semibold text-[#1F2937]">
                {order.orderType === "DINE_IN" ? "Dine-In Cafe" : "Takeaway"}
              </span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Date & Time</span>
              <span className="text-[#6B7280]">{formatDateTime(order.createdAt)}</span>
            </div>

            <div className="border-t border-[#E5E7EB] pt-3 flex justify-between items-baseline">
              <span className="text-[14px] font-bold text-[#1F2937]">Total Amount</span>
              <span className="text-[18px] font-bold text-[#00A86B]">
                {formatPrice(order.totalAmount)}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* 3. BOTTOM ACTION: Button ("Back to Menu" or "Track New Order") */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] p-3 sm:p-4 shadow-footer">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full h-11 rounded-full bg-[#00A86B] hover:bg-[#008F5B] text-white font-bold text-[14px] leading-[20px] flex items-center justify-center shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};
