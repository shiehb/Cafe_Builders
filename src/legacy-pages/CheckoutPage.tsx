import React, { useState } from "react";
import { ChevronLeft, Check, AlertCircle, RefreshCw, QrCode, Banknote } from "lucide-react";
import { Order } from "../types";
import { formatPrice } from "../lib/utils";
import { navigate } from "../lib/router";
import { useCart } from "../context/CartContext";

type CheckoutPaymentOption = "QRPH" | "CASH";

export const CheckoutPage: React.FC = () => {
  const { cart, cartTotal, cartItemCount, orderType, setOrderType, clearCart, saveOrder } = useCart();

  // Form State
  const [customerName, setCustomerName] = useState<string>("");
  const [paymentOption, setPaymentOption] = useState<CheckoutPaymentOption>("QRPH");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const finalTotal = cartTotal;

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-[#6B7280]" />
        <div>
          <h2 className="text-[16px] font-semibold text-[#1F2937]">Your Cart is Empty</h2>
          <p className="text-[12px] text-[#6B7280] mt-1">
            Please add items to your cart before proceeding to checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="px-5 py-2 rounded-full bg-[#00A86B] text-white text-[12px] font-bold hover:bg-[#008F5B] transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Menu</span>
        </button>
      </div>
    );
  }

  const handleExecuteCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMessage("Please enter your name for the order.");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    const payload = {
      items: cart.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.lineTotal,
        customizations: item.customizations,
        notes: item.customizations.specialInstructions,
      })),
      customerName: customerName.trim(),
      orderType,
      paymentMethod: paymentOption,
      paymentBrand: paymentOption === "QRPH" ? "QR Ph" : "Cash",
      discount: 0,
      notes: [
        orderType === "DINE_IN" ? "Dine-In Cafe" : "Takeaway",
        paymentOption === "QRPH" ? "Payment: QR Ph" : "Payment: Cash at Counter",
      ].join(" • "),
    };

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Checkout failed`);

      const createdOrder: Order = data.order;
      saveOrder(createdOrder);
      clearCart();
      navigate(`/order/${createdOrder.id}`);
    } catch (err: any) {
      console.error("Checkout error:", err);
      setErrorMessage(err?.message || "Failed to submit order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FA] text-[#1F2937] flex flex-col font-sans">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] shadow-xs safe-top">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/cart")}
            aria-label="Back to Cart"
            className="h-10 w-10 rounded-full text-[#1F2937] hover:bg-[#F7F9FA] flex items-center justify-center transition-colors cursor-pointer -ml-2"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <span className="font-semibold text-[15px] leading-[20px] text-[#1F2937]">Checkout</span>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-4 flex-1 pb-20">
        <form id="checkout-form" onSubmit={handleExecuteCheckout} className="space-y-3">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* CARD 1: ORDER DETAILS & CUSTOMER INFO */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-card space-y-3">
            {/* Order Review Header */}
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
              <h2 className="text-[14px] font-bold text-[#1F2937]">
                Order Items ({cartItemCount})
              </h2>
              <button
                type="button"
                onClick={() => navigate("/cart")}
                className="text-[12px] font-bold text-[#00A86B] hover:underline cursor-pointer"
              >
                Edit Cart
              </button>
            </div>

            {/* Compact Item List */}
            <div className="divide-y divide-[#E5E7EB]/60">
              {cart.map((item) => (
                <div key={item.id} className="py-2 flex items-center justify-between gap-2 text-[12px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-bold text-[#00A86B] shrink-0">{item.quantity}x</span>
                    <span className="font-semibold text-[#1F2937] truncate">{item.product.name}</span>
                  </div>
                  <span className="font-bold text-[#1F2937] shrink-0">{formatPrice(item.lineTotal)}</span>
                </div>
              ))}
            </div>

            {/* Customer & Dining Inputs Combined */}
            <div className="pt-2 border-t border-[#E5E7EB] space-y-3">
              <div>
                <label className="block text-[12px] font-bold text-[#1F2937] mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] bg-white text-[12px] text-[#1F2937] focus:outline-none focus:border-[#00A86B]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Dining Option</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderType("DINE_IN")}
                    className={`py-2 px-3 rounded-xl border text-[12px] font-bold transition-all flex items-center justify-between cursor-pointer ${
                      orderType === "DINE_IN"
                        ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B]"
                        : "border-[#E5E7EB] bg-white text-[#1F2937]"
                    }`}
                  >
                    <span>Dine-In</span>
                    {orderType === "DINE_IN" && <Check className="h-3.5 w-3.5 text-[#00A86B]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType("TAKEAWAY")}
                    className={`py-2 px-3 rounded-xl border text-[12px] font-bold transition-all flex items-center justify-between cursor-pointer ${
                      orderType === "TAKEAWAY"
                        ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B]"
                        : "border-[#E5E7EB] bg-white text-[#1F2937]"
                    }`}
                  >
                    <span>Takeaway</span>
                    {orderType === "TAKEAWAY" && <Check className="h-3.5 w-3.5 text-[#00A86B]" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: PAYMENT METHOD & TOTAL */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-card space-y-3">
            <h2 className="text-[14px] font-bold text-[#1F2937]">Payment Method</h2>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentOption("QRPH")}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer ${
                  paymentOption === "QRPH" ? "border-[#00A86B] bg-[#E6F6F0]" : "border-[#E5E7EB] bg-white"
                }`}
              >
                <QrCode className="h-4 w-4 text-[#00A86B] shrink-0" />
                <div className="truncate">
                  <span className="text-[12px] font-bold text-[#1F2937] block leading-tight">QR Ph</span>
                  <span className="text-[10px] text-[#6B7280]">GCash/Maya</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentOption("CASH")}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer ${
                  paymentOption === "CASH" ? "border-[#00A86B] bg-[#E6F6F0]" : "border-[#E5E7EB] bg-white"
                }`}
              >
                <Banknote className="h-4 w-4 text-amber-700 shrink-0" />
                <div className="truncate">
                  <span className="text-[12px] font-bold text-[#1F2937] block leading-tight">Cash</span>
                  <span className="text-[10px] text-[#6B7280]">At Counter</span>
                </div>
              </button>
            </div>

            <div className="pt-2.5 border-t border-[#E5E7EB] flex justify-between items-center text-[13px]">
              <span className="font-bold text-[#1F2937]">Total Amount Due</span>
              <span className="text-[16px] font-bold text-[#00A86B]">{formatPrice(finalTotal)}</span>
            </div>
          </div>
        </form>
      </main>

      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] shadow-footer safe-bottom-fixed">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <button
            type="submit"
            form="checkout-form"
            disabled={isSubmitting}
            className="w-full h-11 rounded-full bg-[#00A86B] hover:bg-[#008F5B] text-white font-bold text-[14px] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Processing Order...</span>
              </>
            ) : (
              <span>Place Order • {formatPrice(finalTotal)}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};