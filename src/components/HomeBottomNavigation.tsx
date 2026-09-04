import React, { useState, useEffect, useRef } from "react";
import { Ticket, ShoppingBag } from "lucide-react";
import { Order } from "../types";

interface HomeBottomNavigationProps {
  cartCount: number;
  cartTotal: number;
  activeOrder?: Order | null;
  onOpenTicket: () => void;
  onOpenCart: () => void;
}

export const HomeBottomNavigation: React.FC<HomeBottomNavigationProps> = ({
  cartCount,
  cartTotal: _cartTotal,
  activeOrder,
  onOpenTicket,
  onOpenCart,
}) => {
  const [bounce, setBounce] = useState<boolean>(false);
  const prevCountRef = useRef<number>(cartCount);

  useEffect(() => {
    if (cartCount > prevCountRef.current) {
      setBounce(true);
      const timer = setTimeout(() => setBounce(false), 800);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = cartCount;
  }, [cartCount]);

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] shadow-footer flex items-center animate-in fade-in duration-200 safe-bottom">
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        {/* Ticket Button */}
        <button
          type="button"
          onClick={onOpenTicket}
          aria-label={activeOrder ? `Order #${activeOrder.orderNumber}` : "Order Ticket"}
          className="flex-1 h-11 rounded-full bg-[#00A86B] hover:bg-[#008F5B] text-white flex items-center justify-center gap-2 font-bold text-[15px] leading-[20px] shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
        >
          <Ticket className="h-4 w-4" />
          <span className="font-mono tracking-tight">
            {activeOrder ? `#${activeOrder.orderNumber}` : "# ---"}
          </span>
        </button>

        {/* Cart Button */}
        <button
          type="button"
          onClick={onOpenCart}
          aria-label={`My Cart (${cartCount} items)`}
          title="My Cart"
          className={`relative h-11 w-11 rounded-full bg-[#00A86B] hover:bg-[#008F5B] text-white shadow-xs flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 ${
            bounce ? "scale-105" : ""
          }`}
        >
          <ShoppingBag className="h-5 w-5 text-white" />

          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold px-1 rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-white shadow-xs animate-in zoom-in-50">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};