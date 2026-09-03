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

  // Trigger brief bounce animation when an item is added to cart
  useEffect(() => {
    if (cartCount > prevCountRef.current) {
      setBounce(true);
      const timer = setTimeout(() => setBounce(false), 800);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = cartCount;
  }, [cartCount]);

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] shadow-footer h-16 flex items-center animate-in fade-in duration-200">
      <div className="max-w-md mx-auto w-full h-full flex items-center px-4 gap-3">
        {/* Ticket Button: Order ticket number */}
        <button
          type="button"
          onClick={onOpenTicket}
          aria-label={activeOrder ? `Order #${activeOrder.orderNumber}` : "Order Ticket"}
          className="flex-1 h-11 rounded-xl bg-[#00A86B] hover:bg-[#008F5B] text-white flex items-center justify-center gap-2 font-bold text-[15px] leading-[20px] shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
        >
          <Ticket className="h-4 w-4" />
          <span className="font-mono tracking-tight">
            {activeOrder ? `#${activeOrder.orderNumber}` : "# ---"}
          </span>
        </button>

        {/* Cart Button: Positioned inside the footer on the right */}
        <button
          type="button"
          onClick={onOpenCart}
          aria-label={`My Cart (${cartCount} items)`}
          title="My Cart"
          className={`relative h-11 w-11 rounded-xl bg-[#00A86B] hover:bg-[#008F5B] text-white shadow-xs flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 ${
            bounce ? "scale-105" : ""
          }`}
        >
          <ShoppingBag className="h-5 w-5 text-white" />

          {/* Cart item count badge */}
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

