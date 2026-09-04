import React, { useState } from "react";
import { ChevronLeft, Trash, Plus, Minus, ShoppingBag, ArrowRight, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatPrice } from "../lib/utils";
import { navigate } from "../lib/router";
import { useCart } from "../context/CartContext";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { CartItem } from "../types";

export const CartPage: React.FC = () => {
  const {
    cart,
    cartTotal,
    cartItemCount,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  // Dialog & state
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

  // Subtotal = sum of items
  // Total Amount = Subtotal (Promos applied at Checkout)
  const totalAmount = cartTotal;

  // Customization subtext separated by bullet points e.g. "Medium • 50% Sugar • Normal Ice"
  const formatCustomizationBullet = (item: CartItem): string => {
    const parts: string[] = [];
    if (item.customizations?.size) parts.push(item.customizations.size);
    if (item.customizations?.sweetness) parts.push(item.customizations.sweetness);
    if (item.customizations?.iceLevel) parts.push(item.customizations.iceLevel);
    if (item.customizations?.milkOption) parts.push(item.customizations.milkOption);
    if (item.customizations?.addOns && item.customizations.addOns.length > 0) {
      parts.push(...item.customizations.addOns);
    }
    return parts.join(" • ") || "Standard Preparation";
  };

  return (
    <div className="min-h-screen bg-[#F7F9FA] text-[#1F2937] flex flex-col font-sans pb-28">
      {/* 1. HEADER: Title "My Cart", <ChevronLeft /> for Back, <Trash /> to Clear */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] shadow-xs">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Back to Menu"
            title="Back to Menu"
            className="h-10 w-10 rounded-full text-[#1F2937] hover:bg-[#F3F4F6] flex items-center justify-center transition-colors cursor-pointer -ml-2"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <div className="text-center">
            <h1 className="font-bold text-[16px] leading-[22px] text-[#1F2937]">
              My Cart
            </h1>
          </div>

          {cart.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsClearConfirmOpen(true)}
              aria-label="Clear Cart"
              title="Clear Cart"
              className="h-10 w-10 rounded-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer -mr-2"
            >
              <Trash className="h-5 w-5" />
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </header>

      {/* 2. MAIN CONTENT */}
      <main className="max-w-md w-full mx-auto px-4 py-4 space-y-4">
        {/* Empty State */}
        {cart.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-[#E5E7EB] shadow-xs text-center space-y-3 my-6">
            <div className="h-16 w-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mx-auto text-[#6B7280]">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h2 className="text-[16px] font-bold text-[#1F2937]">Your Cart is Empty</h2>
            <p className="text-[13px] text-[#6B7280] max-w-xs mx-auto">
              Explore our handcrafted coffee, iced beverages, and bakery treats to start an order.
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-2 px-6 py-2.5 rounded-full bg-[#00A86B] hover:bg-[#008F5B] text-white text-[13px] font-bold transition-colors cursor-pointer"
            >
              Explore Menu
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cart Item Cards */}
            <div className="space-y-3">
              <AnimatePresence>
                {cart.map((item) => {
                  const customizationSubtext = formatCustomizationBullet(item);

                  return (
                    <div key={item.id} className="relative rounded-2xl overflow-hidden shadow-xs">
                      {/* Swipe Delete Reveal Background */}
                      <div className="absolute inset-0 bg-rose-500 flex items-center justify-end pr-5 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setItemToRemove({ id: item.id, name: item.product.name })}
                          className="text-white flex flex-col items-center gap-1 cursor-pointer"
                          aria-label="Delete item"
                        >
                          <Trash className="h-5 w-5" />
                          <span className="text-[10px] font-bold">Delete</span>
                        </button>
                      </div>

                      {/* Foreground Card with Motion Drag */}
                      <motion.div
                        drag="x"
                        dragConstraints={{ left: -75, right: 0 }}
                        dragElastic={0.1}
                        className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#E5E7EB]/80 relative z-10 flex gap-3.5 items-center justify-between"
                      >
                        {/* Product Thumbnail */}
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl object-cover bg-stone-100 shrink-0"
                        />

                        {/* Middle Product Details */}
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-start justify-between gap-1.5">
                            <h3 className="text-[15px] font-bold text-[#1F2937] leading-tight truncate">
                              {item.product.name}
                            </h3>
                            <button
                              type="button"
                              onClick={() => navigate(`/cart/edit/${item.id}`)}
                              className="p-1 -mr-1 rounded-lg text-[#6B7280] hover:text-[#00A86B] hover:bg-[#E6F6F0] transition-colors cursor-pointer shrink-0"
                              title="Edit item customization"
                              aria-label={`Edit ${item.product.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="text-[12px] text-[#6B7280] font-normal leading-tight mt-1 truncate">
                            {customizationSubtext}
                          </p>
                          <div className="text-[15px] font-bold text-[#1F2937] mt-1.5">
                            {formatPrice(item.lineTotal)}
                          </div>
                        </div>

                        {/* Stepper Pill with Solid Emerald Plus Button */}
                        <div className="flex items-center bg-[#F3F4F6] rounded-full px-2 py-1 gap-2.5 shrink-0 self-end sm:self-center">
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
                            className="h-6 w-6 rounded-full flex items-center justify-center text-[#1F2937] hover:bg-white/80 transition-colors cursor-pointer active:scale-95"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-[13px] font-bold text-[#1F2937] min-w-3.5 text-center select-none">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            aria-label="Increase quantity"
                            className="h-6 w-6 rounded-full bg-[#00A86B] hover:bg-[#008F5B] text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs active:scale-95"
                          >
                            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Swipe Left Helper with <Trash /> icon */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-[#6B7280] pt-1">
              <Trash className="h-3.5 w-3.5 text-[#9CA3AF]" />
              <span>Swipe left on item card to delete</span>
            </div>

            {/* + Add More Items Button */}
            <div className="text-center pt-1 pb-1">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-[14px] font-bold text-[#00A86B] hover:text-[#008F5B] transition-colors cursor-pointer"
              >
                + Add More Items
              </button>
            </div>

            {/* Order Summary Card */}
            <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]/80 shadow-xs space-y-3 mt-4">
              <h2 className="text-[16px] font-bold text-[#1F2937]">Order Summary</h2>

              <div className="space-y-2.5 text-[14px]">
                <div className="flex justify-between items-center text-[#6B7280]">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#1F2937]">{formatPrice(cartTotal)}</span>
                </div>
              </div>

              <div className="border-t border-[#E5E7EB] pt-3.5 flex justify-between items-center">
                <span className="text-[16px] font-bold text-[#1F2937]">Total Amount</span>
                <span className="text-[20px] font-bold text-[#00A86B]">
                  {formatPrice(totalAmount)}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. STICKY BOTTOM BAR: Checkout Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] p-3.5 shadow-footer">
          <div className="max-w-md mx-auto">
            <button
              type="button"
              onClick={() => navigate("/checkout")}
              className="w-full h-12 rounded-full bg-[#00A86B] hover:bg-[#008F5B] text-white font-bold text-[14px] leading-[20px] flex items-center justify-between px-5 shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
            >
              <span>Proceed to Checkout</span>
              <div className="flex items-center gap-1.5">
                <span>{formatPrice(totalAmount)}</span>
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
