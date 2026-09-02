import React from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { Order } from "../types";
import { formatPrice, formatDateTime } from "../lib/utils";
import { Badge } from "./ui/Badge";
import { Receipt, Clock, ChevronRight, Trash2 } from "lucide-react";

interface OrderHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  onClearHistory: () => void;
}

export const OrderHistoryDrawer: React.FC<OrderHistoryDrawerProps> = ({
  isOpen,
  onClose,
  orders,
  onSelectOrder,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxHeight="tall"
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-[#00A86B]" />
          <span>My Orders & Receipts</span>
        </div>
      }
      description="Receipts and tickets saved locally in your browser storage"
    >
      {orders.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400">
            <Receipt className="h-8 w-8" />
          </div>
          <div>
            <h4 className="font-bold text-stone-800 text-sm">No saved orders found</h4>
            <p className="text-xs text-stone-500 max-w-xs mt-1">
              Your completed orders and barista receipts will appear here automatically.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-500 pb-2 border-b border-stone-100">
            <span>{orders.length} order receipts on this device</span>
            <button
              onClick={onClearHistory}
              className="text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
              Clear Local History
            </button>
          </div>

          <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => {
                  onSelectOrder(order);
                  onClose();
                }}
                className="group p-4 bg-stone-50/80 rounded-2xl border border-stone-200/80 hover:bg-white hover:border-[#00A86B]/40 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm sm:text-base text-stone-900 font-display">
                      {order.orderNumber}
                    </span>
                    <Badge status={order.status} />
                  </div>

                  <p className="text-xs text-stone-600 truncate font-medium">
                    {order.items.map((it) => `${it.quantity}x ${it.productName}`).join(", ")}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] text-stone-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(order.createdAt)}
                    </span>
                    <span>•</span>
                    <span>{order.orderType === "DINE_IN" ? "Dine-in" : "Takeaway"}</span>
                    <span>•</span>
                    <span className="font-semibold text-stone-700">
                      {order.paymentMethod === "QRPH" ? "QR Ph" : "Cash"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-black text-sm sm:text-base text-stone-900 font-display">
                    {formatPrice(order.totalAmount)}
                  </span>
                  <div className="h-8 w-8 rounded-xl bg-white group-hover:bg-[#00A86B] group-hover:text-white border border-stone-200 flex items-center justify-center text-stone-400 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </BottomSheet>
  );
};
