import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CartItem, Product, ItemCustomization, Order, OrderType } from "../types";
import { PRODUCTS } from "../data/menuData";

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
  updateCartItem: (
    oldItemId: string,
    quantity: number,
    customizations: ItemCustomization,
    customizationsExtraPrice: number
  ) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  savedOrders: Order[];
  saveOrder: (order: Order) => void;
  updateOrder: (order: Order) => void;
  clearOrderHistory: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

const CartContext = createContext<CartContextType | null>(null);

const generateCartItemId = (prefix = "ci") => {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
};

const getCustomizationSig = (prodId: string, cust: ItemCustomization) => {
  return `${prodId}|${cust.iceLevel || ""}|${cust.sweetness || ""}|${cust.milkOption || ""}|${(
    cust.addOns || []
  )
    .slice()
    .sort()
    .join(",")}|${cust.specialInstructions || ""}`;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Browser storage is hydrated after the first render so SSR and the first client render match.
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isStorageHydrated, setIsStorageHydrated] = useState(false);

  // 2. Order Type state
  const [orderType, setOrderTypeState] = useState<OrderType>("DINE_IN");

  const setOrderType = (type: OrderType) => {
    setOrderTypeState(type);
  };

  // 3. Saved orders
  const [savedOrders, setSavedOrders] = useState<Order[]>([]);

  useEffect(() => {
    try {
      const storedCart =
        localStorage.getItem(LOCAL_STORAGE_CART_KEY) ||
        localStorage.getItem("cafe_customer_cart") ||
        localStorage.getItem("cafe_cart");

      if (storedCart) {
        const parsed = JSON.parse(storedCart);
        if (Array.isArray(parsed)) {
          setCart(parsed.map((item, idx) => {
            const product = item.product || PRODUCTS.find((p) => p.id === item.productId) || {
              id: item.productId || `prod_${idx}`,
              name: item.name || "Handcrafted Beverage",
              price: item.unitPrice || 0,
              description: "",
              imageUrl: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=600",
              categoryId: "all",
              isAvailable: true,
            };
            return { ...item, id: item.id ? String(item.id).trim() : generateCartItemId(`item_${idx}`), productId: product.id, product };
          }));
        }
      }

      const storedOrderType = localStorage.getItem(LOCAL_STORAGE_ORDER_TYPE_KEY) as OrderType | null;
      if (storedOrderType === "DINE_IN" || storedOrderType === "TAKEAWAY") setOrderTypeState(storedOrderType);

      const storedOrders = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
      if (storedOrders) {
        const parsedOrders = JSON.parse(storedOrders);
        if (Array.isArray(parsedOrders)) setSavedOrders(parsedOrders);
      }
    } catch {
      // Use empty in-memory defaults when browser storage is unavailable or malformed.
    } finally {
      setIsStorageHydrated(true);
    }
  }, []);

  // Notifications suppressed per user request
  const showToast = useCallback((_message: string, _type: "success" | "error" | "info" = "success") => {
    // Intentionally no-op to remove all popup notifications
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    if (!isStorageHydrated) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_CART_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  }, [cart, isStorageHydrated]);

  useEffect(() => {
    if (!isStorageHydrated) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_ORDER_TYPE_KEY, orderType);
    } catch {}
  }, [orderType, isStorageHydrated]);

  // Persist orders to localStorage
  const persistOrders = useCallback((orders: Order[]) => {
    setSavedOrders(orders);
  }, []);

  useEffect(() => {
    if (!isStorageHydrated) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(savedOrders));
    } catch (e) {
      console.error("Failed to save orders to localStorage", e);
    }
  }, [savedOrders, isStorageHydrated]);

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
      const sig = getCustomizationSig(product.id, customizations);

      setCart((prev) => {
        const existingIdx = prev.findIndex(
          (item) => getCustomizationSig(item.productId, item.customizations) === sig
        );
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
          id: generateCartItemId(),
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
    },
    []
  );

  const updateQuantity = useCallback((cartItemId: string, newQty: number) => {
    const normalizedTarget = decodeURIComponent(cartItemId).trim().toLowerCase();
    if (newQty <= 0) {
      setCart((prev) =>
        prev.filter((item) => {
          return (
            item.id !== cartItemId &&
            decodeURIComponent(item.id) !== decodeURIComponent(cartItemId) &&
            item.id.toLowerCase() !== normalizedTarget
          );
        })
      );
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        const isMatch =
          item.id === cartItemId ||
          decodeURIComponent(item.id) === decodeURIComponent(cartItemId) ||
          item.id.toLowerCase() === normalizedTarget;

        return isMatch
          ? {
              ...item,
              quantity: newQty,
              lineTotal: item.unitPrice * newQty,
            }
          : item;
      })
    );
  }, []);

  const updateCartItem = useCallback(
    (
      oldItemId: string,
      quantity: number,
      customizations: ItemCustomization,
      customizationsExtraPrice: number
    ) => {
      setCart((prev) => {
        const normalizedOld = decodeURIComponent(oldItemId).trim().toLowerCase();
        const itemToUpdate = prev.find((i) => {
          if (i.id === oldItemId) return true;
          if (decodeURIComponent(i.id) === decodeURIComponent(oldItemId)) return true;
          if (i.id.toLowerCase() === normalizedOld) return true;
          if (decodeURIComponent(i.id).toLowerCase() === normalizedOld) return true;
          return false;
        });

        if (!itemToUpdate) return prev;
        const product = itemToUpdate.product;
        const unitPrice = product.price + customizationsExtraPrice;
        const lineTotal = unitPrice * quantity;

        const updated = prev.map((item) => {
          if (item.id === itemToUpdate.id) {
            return {
              ...item,
              quantity,
              unitPrice,
              customizations,
              customizationsTotal: customizationsExtraPrice,
              lineTotal,
            };
          }
          return item;
        });
        return updated;
      });
    },
    []
  );

  const removeFromCart = useCallback((cartItemId: string) => {
    const normalizedTarget = decodeURIComponent(cartItemId).trim().toLowerCase();
    setCart((prev) =>
      prev.filter(
        (item) =>
          item.id !== cartItemId &&
          decodeURIComponent(item.id) !== decodeURIComponent(cartItemId) &&
          item.id.toLowerCase() !== normalizedTarget
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

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
  }, [persistOrders]);

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
        updateCartItem,
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
