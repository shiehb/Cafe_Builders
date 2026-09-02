import React, { useState } from "react";
import { ArrowLeft, QrCode, Banknote, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import confetti from "canvas-confetti";
import { PaymentMethod, CheckoutPayload, Order } from "../types";
import { formatPrice } from "../lib/utils";
import { navigate } from "../lib/router";
import { useCart } from "../context/CartContext";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

export const CheckoutPage: React.FC = () => {
  const { cart, cartTotal, cartItemCount, orderType, clearCart, saveOrder, showToast } = useCart();

  // Form State
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("QRPH");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirmOrderOpen, setIsConfirmOrderOpen] = useState<boolean>(false);

  // If cart is empty, redirect back to menu
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-stone-400" />
        <div>
          <h2 className="text-base font-black text-stone-900">Your Tray is Empty</h2>
          <p className="text-xs text-stone-500 mt-1">
            Please add items to your tray before proceeding to checkout.
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

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMessage("Please enter your name for the order pickup.");
      return;
    }
    setErrorMessage(null);
    setIsConfirmOrderOpen(true);
  };

  const handleExecuteCheckout = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const fullNotes = [
      orderType === "DINE_IN" ? "Dine-In Order" : "Takeaway Order",
      customerPhone ? `Contact: ${customerPhone}` : null,
      orderNotes.trim() || null,
    ]
      .filter(Boolean)
      .join(" • ");

    const payload: CheckoutPayload = {
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
      paymentMethod,
      notes: fullNotes,
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

      // Confetti celebration
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#00A86B", "#10b981", "#059669", "#d97706"],
        });
      } catch {}

      // Save order and clear cart
      saveOrder(createdOrder);
      clearCart();
      showToast(`Order #${createdOrder.orderNumber} placed successfully!`, "success");

      // Navigate to digital receipt / live order status
      navigate(`/order/${createdOrder.id}`);
    } catch (err: any) {
      console.error("Checkout error:", err);
      setErrorMessage(err?.message || "Failed to submit order. Please try again.");
    } finally {
      setIsSubmitting(false);
      setIsConfirmOrderOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-stone-900 flex flex-col font-sans pb-32">
      {/* 1. TOP HEADER & NAVIGATION */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-2xs">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/cart")}
            aria-label="Back to Cart"
            title="Back to Cart"
            className="p-2 -ml-2 rounded-xl text-stone-700 hover:text-stone-950 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <h1 className="text-sm font-black text-stone-900">Checkout & Payment</h1>

          <div className="w-9" />
        </div>
      </header>

      {/* 2. FORM BODY */}
      <main className="max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        <form onSubmit={handleOpenConfirm} className="space-y-6">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* CUSTOMER INFO CARD */}
          <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-2xs space-y-4">
            <h2 className="text-xs font-black uppercase text-stone-400 tracking-wider">
              Customer Information
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Name for Order Pickup <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:bg-white focus:outline-none focus:border-[#00A86B] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Mobile Number (Optional, for SMS updates)
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 0917 123 4567"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:bg-white focus:outline-none focus:border-[#00A86B] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Order / Preparation Notes
                </label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g. Less plastic, separate bag..."
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:bg-white focus:outline-none focus:border-[#00A86B] transition-all"
                />
              </div>
            </div>
          </div>

          {/* PAYMENT METHOD SELECTOR */}
          <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase text-stone-400 tracking-wider">
                Payment Method
              </h2>
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#00A86B]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Verified QR Ph</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Dynamic QR Ph */}
              <button
                type="button"
                onClick={() => setPaymentMethod("QRPH")}
                className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer relative ${
                  paymentMethod === "QRPH"
                    ? "border-[#00A86B] bg-emerald-50/60 shadow-xs"
                    : "border-stone-200 bg-stone-50/50 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <span className="p-2.5 rounded-xl bg-emerald-100 text-[#00A86B]">
                    <QrCode className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-[#00A86B] text-white">
                    Instant
                  </span>
                </div>
                <div>
                  <h3 className="text-xs font-black text-stone-900">QR Ph (E-Wallets & Banks)</h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    GCash, Maya, ShopeePay, BPI, UnionBank, GrabPay
                  </p>
                </div>
              </button>

              {/* Option 2: Cash at Counter */}
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                  paymentMethod === "CASH"
                    ? "border-[#00A86B] bg-emerald-50/60 shadow-xs"
                    : "border-stone-200 bg-stone-50/50 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <span className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
                    <Banknote className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] uppercase font-bold text-stone-400">At Counter</span>
                </div>
                <div>
                  <h3 className="text-xs font-black text-stone-900">Cash at Cashier</h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Pay at pickup counter before or upon receiving order
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* ORDER ITEMS REVIEW */}
          <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-2xs space-y-3">
            <h2 className="text-xs font-black uppercase text-stone-400 tracking-wider">
              Order Review ({cartItemCount} items)
            </h2>

            <div className="divide-y divide-stone-100">
              {cart.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-3">
                    <p className="font-bold text-stone-900 truncate">
                      {item.quantity}x {item.product.name}
                    </p>
                    <p className="text-[10px] text-stone-500 truncate">
                      {[
                        item.customizations.iceLevel,
                        item.customizations.sweetness,
                        item.customizations.milkOption,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-stone-900 shrink-0">
                    {formatPrice(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-stone-100 pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-500">
                <span>Subtotal</span>
                <span className="font-mono">{formatPrice(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Dining Service</span>
                <span>{orderType === "DINE_IN" ? "Dine-In Cafe" : "Takeaway"}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-stone-900 pt-1.5 border-t border-stone-100">
                <span>Total Due</span>
                <span className="font-display font-black text-base text-[#00A86B]">
                  {formatPrice(cartTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-14 rounded-2xl bg-[#00A86B] hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-700/25 active:scale-[0.98] transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Processing Order...</span>
              </>
            ) : (
              <span>Confirm & Place Order ({formatPrice(cartTotal)})</span>
            )}
          </button>
        </form>
      </main>

      {/* 3. CONFIRM ORDER ACTION DIALOG */}
      <ConfirmDialog
        isOpen={isConfirmOrderOpen}
        title="Confirm Order Placement?"
        message={`Are you ready to submit your order for ${formatPrice(cartTotal)} via ${
          paymentMethod === "QRPH" ? "Dynamic QR Ph" : "Cash at Counter"
        }?`}
        confirmLabel={isSubmitting ? "Submitting..." : "Yes, Place Order"}
        variant="primary"
        isLoading={isSubmitting}
        onConfirm={handleExecuteCheckout}
        onCancel={() => setIsConfirmOrderOpen(false)}
      />
    </div>
  );
};
