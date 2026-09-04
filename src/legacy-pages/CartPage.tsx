import React, { useState } from "react";
import { ChevronLeft, Trash, Plus, Minus, ShoppingBag, Pencil, Tag, Check, X } from "lucide-react";
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
    removeFromCart,
    updateQuantity,
    clearCart,
  } = useCart();

  // Dialog & state
  const [itemToRemove, setItemToRemove] = useState<{ id: string; name: string } | null>(null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);

  // Promo Code State
  const [promoInput, setPromoInput] = useState<string>("");
  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [promoMessage, setPromoMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      setPromoMessage({ text: "Please enter a promo code.", isError: true });
      return;
    }

    if (code === "COFFEE10" || code === "WELCOME10" || code === "SAVE10") {
      const discount = Math.round(cartTotal * 0.1 * 100) / 100;
      setPromoDiscount(discount);
      setAppliedPromoCode(code);
      setPromoMessage({ text: `Code ${code} applied! 10% off.`, isError: false });
    } else if (code === "CAFE20" || code === "SAVE20") {
      const discount = Math.round(cartTotal * 0.2 * 100) / 100;
      setPromoDiscount(discount);
      setAppliedPromoCode(code);
      setPromoMessage({ text: `Code ${code} applied! 20% off.`, isError: false });
    } else {
      const discount = Math.min(50, Math.round(cartTotal * 0.05 * 100) / 100);
      setPromoDiscount(discount);
      setAppliedPromoCode(code);
      setPromoMessage({ text: `Promo "${code}" applied!`, isError: false });
    }
  };

  const handleRemovePromo = () => {
    setPromoDiscount(0);
    setAppliedPromoCode(null);
    setPromoMessage(null);
    setPromoInput("");
  };

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

  const finalTotal = Math.max(0, Math.round((cartTotal - promoDiscount) * 100) / 100);

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
    <div className="min-h-screen bg-[#F7F9FA] text-[#1F2937] flex flex-col font-sans">
      {/* 1. HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] shadow-xs safe-top">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
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
      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-4 space-y-4 flex-1 pb-52">
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

                      {/* Foreground Card */}
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

                        {/* Middle Details */}
                        <div className="flex-1 min-w-0 pr-2">
                          <h3 className="text-[15px] font-bold text-[#1F2937] leading-tight truncate">
                            {item.product.name}
                          </h3>
                          <p className="text-[12px] text-[#6B7280] font-normal leading-tight mt-1 truncate">
                            {customizationSubtext}
                          </p>
                          
                          {/* Price and Edit Button Side-by-Side */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[15px] font-bold text-[#1F2937]">
                              {formatPrice(item.lineTotal)}
                            </span>
                            <button
                              type="button"
                              onClick={() => navigate(`/cart/edit/${item.id}`)}
                              className="p-1 rounded-md text-[#6B7280] hover:text-[#00A86B] hover:bg-[#E6F6F0] transition-colors cursor-pointer"
                              title="Edit item customization"
                              aria-label={`Edit ${item.product.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Quantity Stepper */}
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

            {/* Promo Code Card */}
            <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-[#00A86B]" />
                  <span className="text-[13px] font-bold text-[#1F2937]">Promotion Code</span>
                </div>
                {appliedPromoCode && (
                  <span className="text-[10px] font-bold text-[#00A86B] bg-[#E6F6F0] px-2 py-0.5 rounded-full">
                    Applied
                  </span>
                )}
              </div>

              {appliedPromoCode ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#E6F6F0] border border-[#00A86B]/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-6 w-6 rounded-full bg-[#00A86B] text-white flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <div className="truncate text-[12px]">
                      <span className="font-bold text-[#00A86B]">{appliedPromoCode}</span>
                      <span className="text-[#008F5B] ml-1.5">(-{formatPrice(promoDiscount)})</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePromo}
                    className="p-1 text-[#6B7280] hover:text-rose-600 rounded-lg hover:bg-white/80 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleApplyPromo();
                        }
                      }}
                      placeholder="Enter code (e.g. SAVE10)"
                      className="flex-1 bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-[12px] text-[#1F2937] placeholder:text-[#9CA3AF] outline-none focus:border-[#00A86B]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="px-3.5 py-2 rounded-xl bg-[#00A86B] hover:bg-[#008F5B] text-white font-bold text-[12px] transition-colors cursor-pointer shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                  {promoMessage && (
                    <p className={`text-[11px] px-1 ${promoMessage.isError ? "text-rose-600" : "text-[#00A86B]"}`}>
                      {promoMessage.text}
                    </p>
                  )}
                </div>
              )}
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
          </div>
        )}
      </main>

      {/* 3. STICKY BOTTOM BAR WITH SUBTOTAL, DISCOUNT & TOTAL AMOUNT */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] shadow-footer safe-bottom-fixed">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 space-y-3">
            <div className="space-y-1.5 text-[13px]">
              {/* Subtotal */}
              <div className="flex justify-between items-center text-[#6B7280]">
                <span>Subtotal</span>
                <span className="font-semibold text-[#1F2937]">{formatPrice(cartTotal)}</span>
              </div>

              {/* Discount (Placed under Subtotal) */}
              <div className="flex justify-between items-center text-[#6B7280]">
                <span>Discount {appliedPromoCode ? `(${appliedPromoCode})` : ""}</span>
                <span className={`font-semibold ${promoDiscount > 0 ? "text-[#00A86B]" : "text-[#1F2937]"}`}>
                  {promoDiscount > 0 ? `-${formatPrice(promoDiscount)}` : formatPrice(0)}
                </span>
              </div>

              {/* Total Amount */}
              <div className="flex justify-between items-center pt-1 border-t border-[#E5E7EB]/60">
                <span className="text-[15px] font-bold text-[#1F2937]">Total Amount</span>
                <span className="text-[18px] font-bold text-[#00A86B]">{formatPrice(finalTotal)}</span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              type="button"
              onClick={() => navigate("/checkout")}
              className="w-full h-12 rounded-full bg-[#00A86B] hover:bg-[#008F5B] text-white font-bold text-[15px] flex items-center justify-center shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
            >
              Checkout
            </button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={Boolean(itemToRemove)}
        title="Remove Item?"
        message={`Remove "${itemToRemove?.name}" from your cart?`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleConfirmRemove}
        onCancel={() => setItemToRemove(null)}
      />

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