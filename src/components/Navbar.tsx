import React from "react";
import { Receipt, ChefHat, ShoppingBag } from "lucide-react";
import { formatPrice } from "../lib/utils";
import { Order } from "../types";

interface NavbarProps {
  onOpenCart: () => void;
  onOpenReceipts: () => void;
  onOpenKds: () => void;
  cartCount: number;
  cartTotal: number;
  activeOrder?: Order | null;
  onSelectActiveOrder: (order: Order) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCart,
  onOpenReceipts,
  onOpenKds,
  cartCount,
  cartTotal,
  activeOrder,
  onSelectActiveOrder,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-2xs">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Brand / Store tag */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-[#00A86B] flex items-center justify-center text-white shadow-xs font-bold text-sm">
            ☕
          </div>
          <span className="font-extrabold text-sm sm:text-base tracking-tight text-stone-900">
            Artisan Brew & Kitchen
          </span>
        </div>

        {/* Right Action Icons: Live tracker, Receipts, KDS, Cart */}
        <div className="flex items-center gap-2">
          {/* Active Order Live Tracker */}
          {activeOrder && (
            <button
              onClick={() => onSelectActiveOrder(activeOrder)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-all cursor-pointer animate-pulse"
              title="View Active Order"
            >
              <span className="h-2 w-2 rounded-full bg-[#00A86B] animate-ping" />
              <span>{activeOrder.orderNumber}</span>
            </button>
          )}

          {/* Receipts */}
          <button
            onClick={onOpenReceipts}
            aria-label="Receipts"
            className="h-9 w-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
            title="Receipts & History"
          >
            <Receipt className="h-4 w-4" />
          </button>

          {/* Kitchen KDS Staff mode */}
          <button
            onClick={onOpenKds}
            aria-label="Kitchen KDS"
            className="h-9 w-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
            title="Kitchen Display System"
          >
            <ChefHat className="h-4 w-4" />
          </button>

          {/* Cart Icon button */}
          <button
            onClick={onOpenCart}
            aria-label="View Cart"
            className="relative h-9 px-3 rounded-full bg-[#00A86B] hover:bg-emerald-700 text-white flex items-center gap-1.5 font-bold text-xs shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount > 0 ? (
              <span>{cartCount}</span>
            ) : (
              <span className="hidden xs:inline">Basket</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
