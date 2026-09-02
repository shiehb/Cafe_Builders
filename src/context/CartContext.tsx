import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CartItem, Product, ItemCustomization, Order, OrderType } from "../types";
import { ToastNotification } from "../components/ui/ToastNotification";

const LOCAL_STORAGE_CART_KEY = "cafe_customer_cart_v2";
const LOCAL_STORAGE_ORDERS_KEY = "cafe_orders_history";
const LOCAL_STORAGE_ORDER_TYPE_KEY = "cafe_order_type";

interface CartContextType {
  cart: CartItem[];
  cartTotal: number;
  cartItemCount: number;
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  addToCart: (
    product: Product,
    quantity: number,
    customizations: ItemCustomization,
    customizationsExtraPrice: number
  ) => void;
  updateQuantity: (cartItemId: string, newQty: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  savedOrders: Order[];
  saveOrder: (order: Order) => void;
  updateOrder: (order: Order) => void;
  clearOrderHistory: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Cart state
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_CART_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // 2. Order Type state
  const [orderType, setOrderTypeState] = useState<OrderType>(() => {
    try {
      return (localStorage.getItem(LOCAL_STORAGE_ORDER_TYPE_KEY) as OrderType) || "DINE_IN";
    } catch {
      return "DINE_IN";
    }
  });

  const setOrderType = (type: OrderType) => {
    setOrderTypeState(type);
    try {
      localStorage.setItem(LOCAL_STORAGE_ORDER_TYPE_KEY, type);
    } catch {}
  };

  // 3. Saved orders
  const [savedOrders, setSavedOrders] = useState<Order[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // 5. Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CART_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  }, [cart]);

  // Persist orders to localStorage
  const persistOrders = useCallback((orders: Order[]) => {
    setSavedOrders(orders);
    try {
      localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(orders));
    } catch (e) {
      console.error("Failed to save orders to localStorage", e);
    }
  }, []);

  const cartTotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = useCallback(
    (
      product: Product,
      quantity: number,
      customizations: ItemCustomization,
      customizationsExtraPrice: number
    ) => {
      const unitPrice = product.price + customizationsExtraPrice;
      const lineTotal = unitPrice * quantity;

      const customKey = `${product.id}-${customizations.iceLevel || ""}-${
        customizations.sweetness || ""
      }-${customizations.milkOption || ""}-${customizations.addOns?.join(",") || ""}-${
        customizations.specialInstructions || ""
      }`;

      setCart((prev) => {
        const existingIdx = prev.findIndex((item) => item.id === customKey);
        if (existingIdx > -1) {
          const updated = [...prev];
          const newQty = updated[existingIdx].quantity + quantity;
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: newQty,
            lineTotal: updated[existingIdx].unitPrice * newQty,
          };
          return updated;
        }

        const newItem: CartItem = {
          id: customKey,
          productId: product.id,
          product,
          quantity,
          unitPrice,
          customizations,
          customizationsTotal: customizationsExtraPrice,
          lineTotal,
        };
        return [...prev, newItem];
      });

      showToast(`Added "${product.name}" (${quantity}) to tray`, "success");
    },
    [showToast]
  );

  const updateQuantity = useCallback((cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== cartItemId));
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.id === cartItemId
          ? {
              ...item,
              quantity: newQty,
              lineTotal: item.unitPrice * newQty,
            }
          : item
      )
    );
  }, []);

  const removeFromCart = useCallback(
    (cartItemId: string) => {
      setCart((prev) => {
        const target = prev.find((i) => i.id === cartItemId);
        if (target) {
          showToast(`Removed "${target.product.name}" from tray`, "info");
        }
        return prev.filter((item) => item.id !== cartItemId);
      });
    },
    [showToast]
  );

  const clearCart = useCallback(() => {
    setCart([]);
    showToast("Cleared tray", "info");
  }, [showToast]);

  const saveOrder = useCallback(
    (order: Order) => {
      setSavedOrders((prev) => {
        const next = [order, ...prev.filter((o) => o.id !== order.id && o.orderNumber !== order.orderNumber)];
        persistOrders(next);
        return next;
      });
    },
    [persistOrders]
  );

  const updateOrder = useCallback(
    (updatedOrder: Order) => {
      setSavedOrders((prev) => {
        const next = prev.map((o) =>
          o.id === updatedOrder.id || o.orderNumber === updatedOrder.orderNumber ? updatedOrder : o
        );
        persistOrders(next);
        return next;
      });
    },
    [persistOrders]
  );

  const clearOrderHistory = useCallback(() => {
    persistOrders([]);
    showToast("Order history cleared", "info");
  }, [persistOrders, showToast]);

  return (
    <CartContext.Provider
      value={{
        cart,
        cartTotal,
        cartItemCount,
        orderType,
        setOrderType,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        savedOrders,
        saveOrder,
        updateOrder,
        clearOrderHistory,
        showToast,
      }}
    >
      {children}
      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </CartContext.Provider>
  );
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
