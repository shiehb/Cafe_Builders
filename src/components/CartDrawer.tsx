import React from "react";
import {
  ChevronLeft,
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  Package,
} from "lucide-react";
import { CartItem, OrderType } from "../types";
import { formatPrice } from "../lib/utils";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (cartItemId: string, newQty: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
  orderType: OrderType;
  onChangeOrderType: (type: OrderType) => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  orderType,
  onChangeOrderType,
  onProceedToCheckout,
}) => {
  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryFee = 0.0;
  const totalAmount = subtotal + deliveryFee;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet Modal Container - Full Page Height */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-full sm:h-[95vh] max-h-screen overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Top Drag Handle Indicator */}
        <div className="w-full flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-12 h-1.5 bg-stone-300 rounded-full" />
        </div>

        {/* Header with Top-Left Back Arrow, Store Name, and Trash Icon */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-stone-100 bg-white/95 backdrop-blur-md shrink-0 gap-3">
          {/* Top-Left Single Navigation Control: Back Arrow */}
          <div className="shrink-0 flex items-center justify-start min-w-[36px]">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back to Menu"
              title="Back to Menu"
              className="h-9 w-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors active:scale-95 cursor-pointer shadow-2xs"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>

          <div className="text-center flex-1 min-w-0 px-2">
            <h2 className="text-base font-extrabold text-stone-900 truncate font-display">
              Artisan Brew & Kitchen
            </h2>
            <p className="text-[11px] text-emerald-600 font-semibold flex items-center justify-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Order Summary
            </p>
          </div>

          <div className="flex items-center justify-end min-w-[36px] shrink-0">
            {items.length > 0 ? (
              <button
                type="button"
                onClick={onClearCart}
                title="Clear basket"
                aria-label="Clear basket"
                className="h-9 w-9 rounded-full bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-600 flex items-center justify-center transition-colors active:scale-95 cursor-pointer shadow-2xs"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <div className="w-9" />
            )}
          </div>
        </div>

        {/* Order Items Section */}
        {items.length === 0 ? (
          <div className="p-8 py-16 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold text-stone-900">Your basket is empty</h3>
            <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
              Add your favorite coffees, matchas, and artisan pastries to begin your order.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-5 py-2.5 rounded-full bg-[#00A86B] text-white font-bold text-xs hover:bg-emerald-700 transition-all cursor-pointer"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5 pb-32">
            
            {/* Dine-in vs Takeaway Pill Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => onChangeOrderType("DINE_IN")}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  orderType === "DINE_IN"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-500 hover:text-stone-900"
                }`}
              >
                <UtensilsCrossed className="h-3.5 w-3.5" />
                <span>Dine-In</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeOrderType("TAKEAWAY")}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  orderType === "TAKEAWAY"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-500 hover:text-stone-900"
                }`}
              >
                <Package className="h-3.5 w-3.5" />
                <span>Takeaway</span>
              </button>
            </div>

            {/* List of Ordered Items */}
            <div className="space-y-3">
              {items.map((item) => {
                const optionsSummary: string[] = [];
                if (item.customizations.iceLevel) optionsSummary.push(item.customizations.iceLevel);
                if (item.customizations.sweetness) optionsSummary.push(item.customizations.sweetness);
                if (item.customizations.milkOption) optionsSummary.push(item.customizations.milkOption);
                if (item.customizations.addOns) optionsSummary.push(...item.customizations.addOns);

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-stone-50/70 border border-stone-200/60 flex items-start gap-3.5"
                  >
                    {/* Thumbnail Image */}
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="h-16 w-16 rounded-xl object-cover flex-shrink-0 bg-stone-200"
                    />

                    {/* Middle Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-sm text-stone-900 line-clamp-1">
                          {item.product.name}
                        </h4>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800">
                          Qty: {item.quantity}
                        </span>
                      </div>

                      {/* Selected Options */}
                      {optionsSummary.length > 0 && (
                        <p className="text-[11px] text-stone-500 mt-1 line-clamp-2 leading-tight">
                          {optionsSummary.join(" · ")}
                        </p>
                      )}

                      {item.customizations.specialInstructions && (
                        <p className="text-[11px] text-amber-700 italic mt-0.5">
                          "{item.customizations.specialInstructions}"
                        </p>
                      )}

                      {/* Item Total & Stepper */}
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-stone-200/50">
                        <span className="text-sm font-extrabold text-stone-900 font-display">
                          {formatPrice(item.lineTotal)}
                        </span>

                        {/* Quantity Stepper & Remove */}
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center bg-white rounded-full border border-stone-200 p-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.quantity > 1) {
                                  onUpdateQuantity(item.id, item.quantity - 1);
                                } else {
                                  onRemoveItem(item.id);
                                }
                              }}
                              className="h-6 w-6 rounded-full flex items-center justify-center text-stone-600 hover:bg-stone-100 active:scale-90 transition-all cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-stone-900">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                              className="h-6 w-6 rounded-full flex items-center justify-center text-stone-600 hover:bg-stone-100 active:scale-90 transition-all cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Price Breakdown Section */}
            <div className="bg-stone-50/80 rounded-2xl p-4 border border-stone-200/60 space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-600">
                <span>Subtotal</span>
                <span className="font-bold text-stone-900 font-display">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-stone-600">
                <span>Service & Packaging Fee</span>
                <span className="text-[#00A86B] font-semibold">FREE</span>
              </div>
              <div className="flex items-center justify-between text-xs text-stone-600">
                <span>Estimated Tax</span>
                <span className="text-stone-500 font-medium">Included</span>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Footer with Breakdown Row & Pill Green Button */}
        {items.length > 0 && (
          <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-stone-200/80 p-4 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Total Payment
              </span>
              <span className="text-lg font-black text-stone-900 font-display">
                {formatPrice(totalAmount)}
              </span>
            </div>

            <button
              type="button"
              onClick={onProceedToCheckout}
              className="w-full h-12 rounded-full bg-[#00A86B] hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm sm:text-base flex items-center justify-center shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <span>Place order - {formatPrice(totalAmount)}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
