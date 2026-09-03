import React, { useState } from "react";
import { ArrowLeft, Plus, Minus, ShoppingBag, ArrowRight, Pencil } from "lucide-react";
import { formatPrice } from "../lib/utils";
import { navigate } from "../lib/router";
import { useCart } from "../context/CartContext";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

export const CartPage: React.FC = () => {
  const {
    cart,
    cartTotal,
    cartItemCount,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  // Dialog states
  const [itemToRemove, setItemToRemove] = useState<{ id: string; name: string } | null>(null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);

  const handleConfirmRemove = () => {
    if (itemToRemove) {
      removeFromCart(itemToRemove.id);
      setItemToRemove(null);
    }
  };

  const handleConfirmClear = () => {
    clearCart();
    setIsClearConfirmOpen(false);
  };

  // Calculations for Order Summary Breakdown
  const serviceChargeRate = 0.05; // 5% Service Charge
  const serviceCharge = cartTotal * serviceChargeRate;
  const discountAmount = 0;
  const finalTotal = cartTotal + serviceCharge - discountAmount;

  return (
    <div className="min-h-screen bg-[#F7F9FA] text-[#1F2937] flex flex-col font-sans pb-28">
      {/* 1. HEADER: Title "My Cart", Back button, Clear Cart action */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] shadow-xs">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Back to Menu"
            title="Back to Menu"
            className="h-10 w-10 rounded-xl text-[#1F2937] hover:bg-[#F7F9FA] flex items-center justify-center transition-colors cursor-pointer -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="text-center">
            <h1 className="font-semibold text-[16px] leading-[22px] text-[#1F2937]">
              My Cart
            </h1>
          </div>

          {cart.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsClearConfirmOpen(true)}
              aria-label="Clear Cart"
              className="text-[13px] font-bold text-rose-600 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
            >
              Clear
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </header>

      {/* 2. MAIN CONTENT */}
      <main className="max-w-2xl w-full mx-auto px-4 py-4 space-y-4">
        {/* Empty State */}
        {cart.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-[#E5E7EB] shadow-card text-center space-y-3 my-6">
            <div className="h-16 w-16 rounded-full bg-[#F7F9FA] flex items-center justify-center mx-auto text-[#6B7280]">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h2 className="text-[16px] font-semibold text-[#1F2937]">Your Cart is Empty</h2>
            <p className="text-[12px] text-[#6B7280] max-w-xs mx-auto">
              Explore our handcrafted coffee, iced beverages, and bakery treats to start an order.
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-2 px-5 py-2.5 rounded-xl bg-[#00A86B] hover:bg-[#008F5B] text-white text-[12px] font-bold transition-colors cursor-pointer"
            >
              Explore Menu
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Item List Header */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] font-semibold text-[#6B7280]">
                Cart Items ({cartItemCount})
              </span>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-[12px] font-bold text-[#00A86B] hover:underline cursor-pointer"
              >
                + Add More Items
              </button>
            </div>

            {/* Item Cards */}
            <div className="space-y-2.5">
              {cart.map((item) => {
                // Build clean customization subtext (e.g. "Iced, Less Ice, Regular Sweetness")
                const customizationTokens: string[] = [];
                if (item.customizations.iceLevel) customizationTokens.push(item.customizations.iceLevel);
                if (item.customizations.sweetness) customizationTokens.push(item.customizations.sweetness);
                if (item.customizations.milkOption) customizationTokens.push(item.customizations.milkOption);
                if (item.customizations.addOns && item.customizations.addOns.length > 0) {
                  customizationTokens.push(...item.customizations.addOns);
                }
                const subtext = customizationTokens.join(", ") || "Standard Preparation";

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#E5E7EB] shadow-card flex gap-3 items-center"
                  >
                    {/* Product Thumbnail */}
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="h-16 w-16 rounded-xl object-cover bg-stone-100 shrink-0"
                    />

                    {/* Info & Customization Subtext */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-semibold text-[#1F2937] leading-[20px] truncate">
                        {item.product.name}
                      </h3>
                      <p className="text-[12px] text-[#6B7280] leading-[18px] truncate mt-0.5">
                        {subtext}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[13px] font-bold text-[#00A86B]">
                          {formatPrice(item.lineTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => navigate(`/cart/edit/${encodeURIComponent(item.id)}`)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#00A86B] hover:text-[#008F5B] hover:underline cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>

                    {/* Inline Quantity Stepper */}
                    <div className="flex items-center border border-[#E5E7EB] bg-[#F7F9FA] rounded-xl p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.quantity === 1) {
                            setItemToRemove({ id: item.id, name: item.product.name });
                          } else {
                            updateQuantity(item.id, item.quantity - 1);
                          }
                        }}
                        aria-label="Decrease quantity"
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-[#1F2937] hover:bg-white transition-colors cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center text-[13px] font-bold text-[#1F2937]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-[#1F2937] hover:bg-white transition-colors cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ORDER SUMMARY BREAKDOWN: Subtotal, Tax/Service Charge (5%), Discount, Total */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-2.5">
              <h3 className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                Order Summary Breakdown
              </h3>
              <div className="flex justify-between text-[12px] text-[#1F2937]">
                <span>Subtotal ({cartItemCount} {cartItemCount === 1 ? "item" : "items"})</span>
                <span className="font-semibold">{formatPrice(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-[12px] text-[#1F2937]">
                <span>Tax / Service Charge (5%)</span>
                <span className="font-semibold">{formatPrice(serviceCharge)}</span>
              </div>
              <div className="flex justify-between text-[12px] text-[#1F2937]">
                <span>Discount / Voucher</span>
                <span className="font-semibold text-[#00A86B]">₱0.00</span>
              </div>
              <div className="border-t border-[#E5E7EB] pt-3 flex justify-between items-baseline">
                <span className="text-[14px] font-bold text-[#1F2937]">Total</span>
                <span className="text-[18px] font-bold text-[#00A86B]">
                  {formatPrice(finalTotal)}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. STICKY BOTTOM BAR: Full-width button ("Proceed to Checkout - [Total]") */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] p-3 sm:p-4 shadow-footer">
          <div className="max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => navigate("/checkout")}
              className="w-full h-11 rounded-xl bg-[#00A86B] hover:bg-[#008F5B] text-white font-bold text-[14px] leading-[20px] flex items-center justify-between px-5 shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
            >
              <span>Proceed to Checkout</span>
              <div className="flex items-center gap-1.5">
                <span>{formatPrice(finalTotal)}</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* CONFIRM REMOVE DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(itemToRemove)}
        title="Remove Item?"
        message={`Remove "${itemToRemove?.name}" from your cart?`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleConfirmRemove}
        onCancel={() => setItemToRemove(null)}
      />

      {/* CONFIRM CLEAR CART DIALOG */}
      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        title="Clear Cart?"
        message="Are you sure you want to remove all items from your cart?"
        confirmLabel="Clear"
        variant="danger"
        onConfirm={handleConfirmClear}
        onCancel={() => setIsClearConfirmOpen(false)}
      />
    </div>
  );
};
