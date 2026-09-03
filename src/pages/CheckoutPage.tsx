import React, { useState } from "react";
import { ArrowLeft, Check, AlertCircle, RefreshCw, QrCode, Banknote } from "lucide-react";
import { Order } from "../types";
import { formatPrice } from "../lib/utils";
import { navigate } from "../lib/router";
import { useCart } from "../context/CartContext";

type CheckoutPaymentOption = "QRPH" | "CASH";

export const CheckoutPage: React.FC = () => {
  const { cart, cartTotal, cartItemCount, orderType, setOrderType, clearCart, saveOrder, showToast } = useCart();

  // Form State
  const [customerName, setCustomerName] = useState<string>("");
  const [paymentOption, setPaymentOption] = useState<CheckoutPaymentOption>("QRPH");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Financials
  const serviceCharge = cartTotal * 0.05;
  const finalTotal = cartTotal + serviceCharge;

  // Empty cart guard
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
          className="px-4 py-2 rounded-xl bg-[#00A86B] text-white text-[12px] font-bold hover:bg-[#008F5B] transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
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
      notes: [
        orderType === "DINE_IN" ? "Dine-In Cafe" : "Takeaway",
        paymentOption === "QRPH" ? "Payment: QR Ph" : "Payment: Cash at Counter",
      ]
        .filter(Boolean)
        .join(" • "),
    };

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Checkout failed with status ${res.status}`);
      }

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
    <div className="min-h-screen bg-[#F7F9FA] text-[#1F2937] flex flex-col font-sans pb-28">
      {/* 1. TOP BAR: Back button navigation only */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] shadow-xs">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/cart")}
            aria-label="Back to Cart"
            title="Back to Cart"
            className="h-10 w-10 rounded-xl text-[#1F2937] hover:bg-[#F7F9FA] flex items-center justify-center transition-colors cursor-pointer -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <span className="font-semibold text-[14px] leading-[20px] text-[#1F2937]">
            Checkout
          </span>

          <div className="w-10" />
        </div>
      </header>

      {/* 2. FORM SECTIONS */}
      <main className="max-w-2xl w-full mx-auto px-4 py-4 space-y-4">
        <form id="checkout-form" onSubmit={handleExecuteCheckout} className="space-y-4">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SECTION: Order Review */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
                Order Review ({cartItemCount} {cartItemCount === 1 ? "item" : "items"})
              </h2>
              <button
                type="button"
                onClick={() => navigate("/cart")}
                className="text-[12px] font-bold text-[#00A86B] hover:underline cursor-pointer"
              >
                Edit Cart
              </button>
            </div>

            <div className="divide-y divide-[#E5E7EB]">
              {cart.map((item) => {
                const customizationTokens: string[] = [];
                if (item.customizations.iceLevel) customizationTokens.push(item.customizations.iceLevel);
                if (item.customizations.sweetness) customizationTokens.push(item.customizations.sweetness);
                if (item.customizations.milkOption) customizationTokens.push(item.customizations.milkOption);
                if (item.customizations.addOns && item.customizations.addOns.length > 0) {
                  customizationTokens.push(...item.customizations.addOns);
                }
                if (item.customizations.specialInstructions) {
                  customizationTokens.push(`"${item.customizations.specialInstructions}"`);
                }
                const subtext = customizationTokens.join(", ") || "Standard Preparation";

                return (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex gap-3 items-center">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="h-12 w-12 rounded-xl object-cover bg-stone-100 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[13px] font-semibold text-[#1F2937] truncate">
                          {item.product.name}
                        </h3>
                        <span className="text-[13px] font-bold text-[#1F2937] shrink-0">
                          {formatPrice(item.lineTotal)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B7280] truncate mt-0.5">{subtext}</p>
                      <span className="inline-block text-[11px] font-semibold text-[#00A86B] mt-0.5">
                        Qty: {item.quantity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION A: Customer Info */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
            <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
              Customer Information
            </h2>

            <div>
              <label className="block text-[12px] font-semibold text-[#1F2937] mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Maria Santos"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[12px] text-[#1F2937] placeholder:text-[#6B7280] focus:outline-none focus:border-[#00A86B] transition-colors"
              />
            </div>
          </div>

          {/* SECTION B: Dining Option (Selector for "Dine-In" vs "Takeaway") */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
                Dining Option
              </h2>
              <span className="text-[10px] text-[#6B7280]">Select 1</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setOrderType("DINE_IN")}
                className={`p-3 rounded-xl border text-[12px] font-semibold transition-all flex items-center justify-between cursor-pointer ${
                  orderType === "DINE_IN"
                    ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold"
                    : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F7F9FA]"
                }`}
              >
                <span>Dine-In Cafe</span>
                {orderType === "DINE_IN" && <Check className="h-4 w-4 text-[#00A86B]" />}
              </button>

              <button
                type="button"
                onClick={() => setOrderType("TAKEAWAY")}
                className={`p-3 rounded-xl border text-[12px] font-semibold transition-all flex items-center justify-between cursor-pointer ${
                  orderType === "TAKEAWAY"
                    ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold"
                    : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F7F9FA]"
                }`}
              >
                <span>Takeaway</span>
                {orderType === "TAKEAWAY" && <Check className="h-4 w-4 text-[#00A86B]" />}
              </button>
            </div>
          </div>

          {/* SECTION C: Payment Method Selection: QR Ph & Cash at Counter */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
            <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
              Payment Method
            </h2>

            <div className="space-y-2">
              {/* Option 1: QR Ph [Selected Green indicator] */}
              <button
                type="button"
                onClick={() => setPaymentOption("QRPH")}
                className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  paymentOption === "QRPH"
                    ? "border-[#00A86B] bg-[#E6F6F0] shadow-xs"
                    : "border-[#E5E7EB] bg-white hover:bg-[#F7F9FA]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 text-[#00A86B] flex items-center justify-center font-bold text-[14px]">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[13px] font-semibold text-[#1F2937] block">
                      PayMongo QR Ph / Scan to Pay
                    </span>
                    <span className="text-[11px] text-[#6B7280] block">
                      Dynamic QR for GCash, Maya, ShopeePay, or any QR Ph banking app
                    </span>
                  </div>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                    paymentOption === "QRPH"
                      ? "border-[#00A86B] bg-[#00A86B]"
                      : "border-[#E5E7EB]"
                  }`}
                >
                  {paymentOption === "QRPH" && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
              </button>

              {/* Option 2: Cash at Counter */}
              <button
                type="button"
                onClick={() => setPaymentOption("CASH")}
                className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  paymentOption === "CASH"
                    ? "border-[#00A86B] bg-[#E6F6F0] shadow-xs"
                    : "border-[#E5E7EB] bg-white hover:bg-[#F7F9FA]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-[14px]">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[13px] font-semibold text-[#1F2937] block">
                      Cash at Counter
                    </span>
                    <span className="text-[11px] text-[#6B7280] block">
                      Pay cash directly to barista upon pickup
                    </span>
                  </div>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                    paymentOption === "CASH"
                      ? "border-[#00A86B] bg-[#00A86B]"
                      : "border-[#E5E7EB]"
                  }`}
                >
                  {paymentOption === "CASH" && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
              </button>
            </div>
          </div>

          {/* Order Summary Recap */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-2 text-[12px] text-[#1F2937]">
            <div className="flex justify-between text-[#6B7280]">
              <span>Items Subtotal ({cartItemCount})</span>
              <span>{formatPrice(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Tax / Service Charge (5%)</span>
              <span>{formatPrice(serviceCharge)}</span>
            </div>
            <div className="border-t border-[#E5E7EB] pt-2 flex justify-between font-bold text-[14px] text-[#1F2937]">
              <span>Total Due</span>
              <span className="text-[#00A86B]">{formatPrice(finalTotal)}</span>
            </div>
          </div>
        </form>
      </main>

      {/* 3. STICKY BOTTOM BAR: Full-width button ("Place Order - [Total]") */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] p-3 sm:p-4 shadow-footer">
        <div className="max-w-2xl mx-auto">
          <button
            type="submit"
            form="checkout-form"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl bg-[#00A86B] hover:bg-[#008F5B] text-white font-bold text-[14px] leading-[20px] flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer active:scale-[0.99] disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Processing Order...</span>
              </>
            ) : (
              <span>Place Order - {formatPrice(finalTotal)}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
