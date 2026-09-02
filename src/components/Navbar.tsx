import React, { useState, useRef, useEffect } from "react";
import { Receipt, ChefHat, ShoppingBag, CreditCard, LayoutDashboard, Shield, ChevronDown } from "lucide-react";
import { formatPrice } from "../lib/utils";
import { Order } from "../types";
import { navigate } from "../lib/router";

interface NavbarProps {
  onOpenCart: () => void;
  onOpenReceipts: () => void;
  onOpenKds?: () => void;
  cartCount: number;
  cartTotal: number;
  activeOrder?: Order | null;
  onSelectActiveOrder: (order: Order) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCart,
  onOpenReceipts,
  cartCount,
  cartTotal,
  activeOrder,
  onSelectActiveOrder,
}) => {
  const [isStaffMenuOpen, setIsStaffMenuOpen] = useState<boolean>(false);
  const staffMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (staffMenuRef.current && !staffMenuRef.current.contains(e.target as Node)) {
        setIsStaffMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

        {/* Right Action Icons: Live tracker, Receipts, Staff Hub, Cart */}
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

          {/* Staff Hub Quick Menu (KDS, POS, Admin) */}
          <div className="relative" ref={staffMenuRef}>
            <button
              onClick={() => setIsStaffMenuOpen((prev) => !prev)}
              aria-label="Staff Terminal Access"
              className="h-9 px-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1 transition-colors cursor-pointer text-xs font-bold"
              title="Staff Terminal Access (KDS / POS / Admin)"
            >
              <ChefHat className="h-4 w-4 text-[#00A86B]" />
              <span className="hidden sm:inline">Staff</span>
              <ChevronDown className="h-3 w-3 text-stone-400" />
            </button>

            {isStaffMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-stone-900 border border-stone-800 rounded-2xl shadow-xl p-1.5 z-50 text-stone-200 text-xs animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-stone-400 border-b border-stone-800/80">
                  Protected Staff Portals
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsStaffMenuOpen(false);
                    navigate("/kds");
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <ChefHat className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Kitchen KDS</div>
                    <div className="text-[10px] text-stone-400">Live 4-column ticket board</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsStaffMenuOpen(false);
                    navigate("/pos");
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <CreditCard className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Cashier POS</div>
                    <div className="text-[10px] text-stone-400">Register & Change calculator</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsStaffMenuOpen(false);
                    navigate("/admin");
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <LayoutDashboard className="h-4 w-4 text-purple-400 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Store Admin</div>
                    <div className="text-[10px] text-stone-400">Sales metrics, orders & PINs</div>
                  </div>
                </button>
              </div>
            )}
          </div>

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
