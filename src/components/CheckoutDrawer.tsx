import React, { useState } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { CartItem, Order, OrderType, PaymentMethod } from "../types";
import { formatPrice } from "../lib/utils";
import { QrPhPaymentView } from "./QrPhPaymentView";
import {
  QrCode,
  Banknote,
  User,
  ShieldCheck,
  AlertCircle,
  Clock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface CheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  defaultOrderType: OrderType;
  onOrderCompleted: (order: Order) => void;
}

export const CheckoutDrawer: React.FC<CheckoutDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  defaultOrderType,
  onOrderCompleted,
}) => {
  const [customerName, setCustomerName] = useState<string>("");
  const [orderType, setOrderType] = useState<OrderType>(defaultOrderType || "DINE_IN");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("QRPH");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // QR state when QRPH checkout is generated
  const [generatedOrder, setGeneratedOrder] = useState<Order | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  const subtotal = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalAmount = subtotal;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload = {
        items: cartItems.map((item) => ({
          productId: item.productId,
          productName: item.product?.name || "Artisan Cafe Item",
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          customizations: item.customizations,
          subtotal: item.lineTotal,
          notes: item.customizations?.specialInstructions,
        })),
        customerName: customerName.trim() || "Guest",
        orderType,
        paymentMethod,
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        if (data?.error) {
          throw new Error(data.error);
        }
        if (data?.message) {
          throw new Error(data.message);
        }

        // Handle HTML or non-JSON error pages (like 404/500/502) gracefully
        const rawText = !data ? await res.text().catch(() => "") : "";
        const isHtml = rawText.includes("<html") || rawText.includes("<!DOCTYPE");

        if (isHtml || !rawText.trim()) {
          if (res.status === 404) {
            throw new Error("Checkout endpoint is currently unavailable (404). Please try again in a moment.");
          } else if (res.status >= 500) {
            throw new Error("Server encountered an issue processing checkout. Please try again or pay with Cash at Counter.");
          } else {
            throw new Error(`Checkout failed with status ${res.status}. Please try again.`);
          }
        } else {
          // If short plaintext error returned
          throw new Error(rawText.slice(0, 150));
        }
      }

      if (!data) {
        throw new Error("Unable to parse server checkout response. Please verify your order and try again.");
      }

      if (!data.success && data.error) {
        throw new Error(data.error || "Failed to process checkout");
      }

      if (paymentMethod === "QRPH" && data.qrCodeUrl) {
        setGeneratedOrder(data.order);
        setQrCodeUrl(data.qrCodeUrl);
      } else {
        // Cash payment placed
        onOrderCompleted(data.order);
        onClose();
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      setErrorMessage(err.message || "An unexpected error occurred during checkout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setGeneratedOrder(null);
    setQrCodeUrl(null);
    setErrorMessage(null);
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      maxHeight={generatedOrder && qrCodeUrl ? "full" : "tall"}
      maxWidth="lg"
      title={
        generatedOrder && qrCodeUrl ? (
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#00A86B]" />
            <span>Scan to Pay (Order {generatedOrder.orderNumber})</span>
          </div>
        ) : (
          "Order Checkout"
        )
      }
      description={
        generatedOrder && qrCodeUrl
          ? "Scan with GCash, Maya, ShopeePay, or your bank app"
          : "Choose your payment method to finalize your cafe order"
      }
    >
      {/* If Dynamic QR Ph has been generated, show clean full-height scanning sheet */}
      {generatedOrder && qrCodeUrl ? (
        <div className="py-2">
          <QrPhPaymentView
            order={generatedOrder}
            qrCodeUrl={qrCodeUrl}
            onPaymentConfirmed={(updatedOrder) => {
              onOrderCompleted(updatedOrder);
              handleReset();
              onClose();
            }}
            onCancel={handleReset}
          />
        </div>
      ) : (
        <form onSubmit={handleCheckoutSubmit} className="space-y-5 pb-2">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Customer Name (Optional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Customer Name
              </label>
              <span className="text-[11px] text-stone-400">Optional</span>
            </div>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                type="text"
                placeholder="e.g. Jericho, Maria..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#00A86B]"
              />
            </div>
            <p className="text-[11px] text-stone-400">
              Used by baristas when calling your order.
            </p>
          </div>

          {/* 2. Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
              Payment Choice
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Dynamic QR Ph Option */}
              <button
                type="button"
                onClick={() => setPaymentMethod("QRPH")}
                className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer relative ${
                  paymentMethod === "QRPH"
                    ? "bg-emerald-50/60 border-[#00A86B] ring-1 ring-[#00A86B] shadow-xs"
                    : "bg-white border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-xl bg-[#00A86B] text-white flex items-center justify-center shadow-xs">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Instant
                  </span>
                </div>

                <div className="mt-3">
                  <h4 className="font-extrabold text-sm text-stone-900 font-display">
                    PayMongo Dynamic QR Ph
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    GCash, Maya, ShopeePay, BPI, BDO, UnionBank
                  </p>
                </div>
              </button>

              {/* Cash at Counter Option */}
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                  paymentMethod === "CASH"
                    ? "bg-stone-50 border-stone-900 ring-1 ring-stone-900 shadow-xs"
                    : "bg-white border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-xs">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-700">
                    Manual
                  </span>
                </div>

                <div className="mt-3">
                  <h4 className="font-extrabold text-sm text-stone-900 font-display">
                    Cash at Counter
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Pay barista directly when your order is called
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Special Instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
              Order Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Any pickup notes or packaging preferences..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#00A86B] resize-none"
            />
          </div>

          {/* Order Summary Recap */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1 text-xs">
            <div className="flex justify-between font-bold text-stone-800">
              <span>Total Payable</span>
              <span className="font-extrabold text-stone-900 font-display text-sm">
                {formatPrice(totalAmount)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-500 pt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Direct secure payment powered by PayMongo API</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || cartItems.length === 0}
              className="w-full h-12 rounded-full bg-[#00A86B] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <span>Generating Order...</span>
              ) : paymentMethod === "QRPH" ? (
                <>
                  <QrCode className="h-4 w-4" />
                  <span>Generate QR Ph Code ({formatPrice(totalAmount)})</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Confirm Cash Order ({formatPrice(totalAmount)})</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </BottomSheet>
  );
};
