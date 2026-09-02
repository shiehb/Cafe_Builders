import React, { useState } from "react";
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, ArrowRight, UtensilsCrossed, PackageOpen, AlertCircle } from "lucide-react";
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
    orderType,
    setOrderType,
  } = useCart();

  // Confirmation dialog states
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

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-stone-900 flex flex-col font-sans pb-36">
      {/* 1. TOP HEADER & NAVIGATION */}
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

          <h1 className="text-sm font-black text-stone-900">Your Order Tray</h1>

          {cart.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsClearConfirmOpen(true)}
              aria-label="Clear Tray"
              title="Clear Tray"
              className="p-2 -mr-2 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>
      </header>

      {/* 2. MAIN CONTENT */}
      <main className="max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        {/* DINING TYPE PICKER */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-stone-400 tracking-wider">
              Dining Option
            </span>
            <span className="text-xs font-bold text-[#00A86B]">
              {orderType === "DINE_IN" ? "Dine-In Cafe" : "Takeaway / Pick-up"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setOrderType("DINE_IN")}
              className={`p-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                orderType === "DINE_IN"
                  ? "border-[#00A86B] bg-emerald-50 text-[#00A86B] shadow-xs"
                  : "border-stone-200 bg-stone-50/50 text-stone-700 hover:border-stone-300"
              }`}
            >
              <UtensilsCrossed className="h-4 w-4" />
              <span>Dine-In</span>
            </button>

            <button
              type="button"
              onClick={() => setOrderType("TAKEAWAY")}
              className={`p-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                orderType === "TAKEAWAY"
                  ? "border-[#00A86B] bg-emerald-50 text-[#00A86B] shadow-xs"
                  : "border-stone-200 bg-stone-50/50 text-stone-700 hover:border-stone-300"
              }`}
            >
              <PackageOpen className="h-4 w-4" />
              <span>Takeaway</span>
            </button>
          </div>
        </div>

        {/* CART ITEMS LIST */}
        {cart.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 border border-stone-200/80 shadow-2xs text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-base font-black text-stone-900">Your Tray is Empty</h2>
              <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
                Explore our handcrafted coffee, iced beverages, and fresh bakery specialties to start an order.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="px-6 py-3 rounded-2xl bg-[#00A86B] text-white text-xs font-black hover:bg-emerald-700 transition-all cursor-pointer shadow-md shadow-emerald-700/20"
            >
              Explore Menu
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase text-stone-400 tracking-wider">
                Tray Items ({cartItemCount})
              </span>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-xs font-bold text-[#00A86B] hover:underline cursor-pointer"
              >
                + Add More Items
              </button>
            </div>

            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-2xs flex gap-3 sm:gap-4 items-start"
                >
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    className="h-16 w-16 rounded-2xl object-cover bg-stone-100 shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-black text-stone-900 leading-snug">
                          {item.product.name}
                        </h3>
                        <p className="text-xs font-black font-display text-emerald-700 mt-0.5">
                          {formatPrice(item.unitPrice)}
                        </p>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => setItemToRemove({ id: item.id, name: item.product.name })}
                        aria-label={`Remove ${item.product.name}`}
                        className="p-1.5 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Customizations tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.customizations.iceLevel && (
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-bold">
                          {item.customizations.iceLevel}
                        </span>
                      )}
                      {item.customizations.sweetness && (
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-bold">
                          {item.customizations.sweetness}
                        </span>
                      )}
                      {item.customizations.milkOption && (
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-bold">
                          {item.customizations.milkOption}
                        </span>
                      )}
                      {item.customizations.addOns?.map((addon) => (
                        <span
                          key={addon}
                          className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold"
                        >
                          +{addon}
                        </span>
                      ))}
                    </div>

                    {item.customizations.specialInstructions && (
                      <p className="text-[11px] text-stone-500 italic mt-1.5 bg-stone-50 p-2 rounded-xl border border-stone-100">
                        "{item.customizations.specialInstructions}"
                      </p>
                    )}

                    {/* Quantity Selector & Line Total */}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-100">
                      <div className="flex items-center border border-stone-200 bg-stone-50 rounded-xl p-0.5">
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
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-stone-600 hover:bg-white transition-colors cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-black font-display">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          aria-label="Increase quantity"
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-stone-600 hover:bg-white transition-colors cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <span className="text-sm font-black font-display text-stone-900">
                        {formatPrice(item.lineTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ORDER FINANCIAL BREAKDOWN */}
            <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-2xs space-y-2.5">
              <h3 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-2">
                Order Summary
              </h3>
              <div className="flex justify-between text-xs text-stone-600">
                <span>Subtotal ({cartItemCount} items)</span>
                <span className="font-mono font-bold">{formatPrice(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-stone-600">
                <span>Service Fee / Packaging</span>
                <span className="font-mono font-bold text-emerald-700">Free</span>
              </div>
              <div className="border-t border-stone-100 pt-2.5 flex justify-between text-sm font-black text-stone-900">
                <span>Total Amount (PHP)</span>
                <span className="font-display font-black text-base text-[#00A86B]">
                  {formatPrice(cartTotal)}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. FIXED BOTTOM PROCEED BAR */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 p-4 shadow-xl">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-stone-400">Total Due</p>
              <p className="text-lg font-black font-display text-[#00A86B]">
                {formatPrice(cartTotal)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/checkout")}
              className="flex-1 h-12 rounded-2xl bg-[#00A86B] hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. CONFIRM REMOVE DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(itemToRemove)}
        title="Remove Item?"
        message={`Are you sure you want to remove "${itemToRemove?.name}" from your tray?`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleConfirmRemove}
        onCancel={() => setItemToRemove(null)}
      />

      {/* 5. CONFIRM CLEAR CART DIALOG */}
      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        title="Clear Entire Tray?"
        message="Are you sure you want to remove all items from your order tray? This action cannot be undone."
        confirmLabel="Clear Tray"
        variant="danger"
        onConfirm={handleConfirmClear}
        onCancel={() => setIsClearConfirmOpen(false)}
      />
    </div>
  );
};
