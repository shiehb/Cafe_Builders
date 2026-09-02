import React, { useState, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import {
  Category,
  Product,
  CartItem,
  Order,
  OrderType,
  ItemCustomization,
} from "./types";
import { CATEGORIES, PRODUCTS } from "./data/menuData";
import { Navbar } from "./components/Navbar";
import { CategoryNav } from "./components/CategoryNav";
import { MostPopularCarousel } from "./components/MostPopularCarousel";
import { SpecialtySection } from "./components/SpecialtySection";
import { ProductDrawer } from "./components/ProductDrawer";
import { CartDrawer } from "./components/CartDrawer";
import { CheckoutDrawer } from "./components/CheckoutDrawer";
import { OrderReceiptDrawer } from "./components/OrderReceiptDrawer";
import { OrderHistoryDrawer } from "./components/OrderHistoryDrawer";
import { KitchenKdsDrawer } from "./components/KitchenKdsDrawer";
import { ViewAllDrawer } from "./components/ViewAllDrawer";
import { Search, X, ShoppingBag, ArrowRight } from "lucide-react";
import { formatPrice } from "./lib/utils";
import { useKitchenRealtime } from "./lib/realtime";

const LOCAL_STORAGE_ORDERS_KEY = "cafe_orders_history";

export default function App() {
  // Menu Data State
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Dining Type (Dine-in / Takeaway)
  const [orderType, setOrderType] = useState<OrderType>("DINE_IN");

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Selected Product for Customization Drawer
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Layout View Mode (2-column Grid vs 1-column List)
  const [isGridView, setIsGridView] = useState<boolean>(false);

  // Drawers State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isKdsOpen, setIsKdsOpen] = useState<boolean>(false);

  // Dedicated "View All" / "Full View" 2-Column Grid Drawer State
  const [viewAllDrawerState, setViewAllDrawerState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    products: Product[];
  }>({
    isOpen: false,
    title: "",
    products: [],
  });

  // Active Viewing Order (for Receipt Drawer)
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  // Saved Orders from LocalStorage
  const [savedOrders, setSavedOrders] = useState<Order[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist saved orders to LocalStorage
  const persistOrders = useCallback((orders: Order[]) => {
    setSavedOrders(orders);
    try {
      localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(orders));
    } catch (e) {
      console.error("Failed to write to localStorage", e);
    }
  }, []);

  // When order status is updated in Receipt or KDS or via Webhook
  const handleOrderUpdated = useCallback(
    (updatedOrder: Order) => {
      setSavedOrders((prev) => {
        const nextList = prev.map((o) =>
          o.id === updatedOrder.id || o.orderNumber === updatedOrder.orderNumber
            ? updatedOrder
            : o
        );
        try {
          localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(nextList));
        } catch {}
        return nextList;
      });

      setViewingOrder((prev) =>
        prev && (prev.id === updatedOrder.id || prev.orderNumber === updatedOrder.orderNumber)
          ? updatedOrder
          : prev
      );
    },
    []
  );

  // Global Realtime listener for all incoming orders and status updates
  useKitchenRealtime(
    useCallback(
      ({ order }) => {
        if (order) {
          handleOrderUpdated(order);
        }
      },
      [handleOrderUpdated]
    )
  );

  // Fetch live products & categories from server API if available
  useEffect(() => {
    async function loadData() {
      try {
        const [catRes, prodRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/products"),
        ]);
        if (catRes.ok) {
          const catJson = await catRes.json();
          if (catJson?.data?.length) setCategories(catJson.data);
        }
        if (prodRes.ok) {
          const prodJson = await prodRes.json();
          if (prodJson?.data?.length) setProducts(prodJson.data);
        }
      } catch {
        // Fallback to static menuData
      }
    }
    loadData();
  }, []);

  // Cart calculations
  const cartTotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const currentHour = new Date().getHours();
    if (currentHour < 12) return "Good morning, Coffee Lover ☕";
    if (currentHour < 18) return "Good afternoon, Coffee Lover ☕";
    return "Good evening, Coffee Lover ☕";
  };

  // Filter products by category and search
  const filteredProducts = products.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" ||
      item.categoryId === selectedCategory ||
      item.categoryName === selectedCategory;

    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.tags && item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    return matchesCategory && matchesSearch;
  });

  // Quick Add Item to Cart
  const handleQuickAdd = (product: Product) => {
    const defaultCustomization: ItemCustomization = {
      iceLevel: product.temperatureOptions?.includes("Iced") ? "Less Ice" : undefined,
      sweetness: product.sweetnessAdjustable ? "Regular Sweetness" : undefined,
    };
    handleAddToCart(product, 1, defaultCustomization, 0);
  };

  // Add Item to Cart with Customizations
  const handleAddToCart = (
    product: Product,
    quantity: number,
    customizations: ItemCustomization,
    customizationsExtraPrice: number
  ) => {
    const unitPrice = product.price + customizationsExtraPrice;
    const lineTotal = unitPrice * quantity;

    // Generate hash ID for unique combination of product + customizations
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

    // Open Cart Drawer
    setIsCartOpen(true);
  };

  // Update Cart Item Quantity
  const handleUpdateQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(cartItemId);
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
  };

  // Remove Item from Cart
  const handleRemoveFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  // Clear Cart
  const handleClearCart = () => {
    setCart([]);
  };

  // Checkout Completion Handler
  const handleOrderCompleted = (order: Order) => {
    // 1. Trigger celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#00A86B", "#10b981", "#059669", "#d97706"],
      });
    } catch {
      // safe fallback
    }

    // 2. Clear active cart
    setCart([]);
    setIsCartOpen(false);

    // 3. Save order to LocalStorage list
    const updatedOrders = [
      order,
      ...savedOrders.filter((o) => o.id !== order.id && o.orderNumber !== order.orderNumber),
    ];
    persistOrders(updatedOrders);

    // 4. Open receipt drawer
    setViewingOrder(order);
    setIsReceiptOpen(true);
  };

  // Clear LocalStorage History
  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear your local receipt history from this device?")) {
      persistOrders([]);
    }
  };

  // Most recent active order
  const activeOrder = savedOrders.find((o) => o.status !== "COMPLETED");

  const currentCategoryObj = categories.find((c) => c.id === selectedCategory);
  const sectionTitle =
    selectedCategory === "all"
      ? "Artisan Specialties"
      : currentCategoryObj?.name || "Artisan Specialties";

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-stone-900 flex flex-col font-sans pb-24">
      {/* Top Navbar */}
      <Navbar
        onOpenCart={() => setIsCartOpen(true)}
        onOpenReceipts={() => setIsHistoryOpen(true)}
        onOpenKds={() => setIsKdsOpen(true)}
        cartCount={cartItemCount}
        cartTotal={cartTotal}
        activeOrder={activeOrder}
        onSelectActiveOrder={(order) => {
          setViewingOrder(order);
          setIsReceiptOpen(true);
        }}
      />

      <main className="max-w-3xl w-full mx-auto px-0 sm:px-4 py-4 space-y-5">
        
        {/* 1. TOP HEADER GREETING */}
        <section className="px-4 sm:px-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                {getGreeting()}
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 font-medium mt-0.5">
                What would you like to order today?
              </p>
            </div>

            {/* Right-Aligned Green Status Pill Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#00A86B] text-xs font-bold shadow-2xs shrink-0">
              <span className="h-2 w-2 rounded-full bg-[#00A86B] animate-pulse" />
              <span>Open Now</span>
            </div>
          </div>
        </section>

        {/* 2. STICKY / MAGNET SEARCH & CATEGORY BAR */}
        <div className="sticky top-14 z-30 bg-[#F8F9FA]/95 sm:bg-white/90 backdrop-blur-md pt-2 pb-3 px-4 sm:px-0 space-y-2.5 border-b border-stone-200/70 shadow-2xs -mx-0 sm:-mx-0 transition-all">
          {/* Full-Width Clean White Input Search Bar */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coffee, croissants, pasta..."
              className="w-full bg-white border border-stone-200/90 rounded-2xl pl-10 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#00A86B] focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Horizontal Scrolling Pill Buttons with Icons */}
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategory}
            onSelectCategory={(id) => {
              setSelectedCategory(id);
              setSearchQuery("");
            }}
          />
        </div>

        {/* 3. "MOST POPULAR" HORIZONTAL CAROUSEL */}
        {selectedCategory === "all" && !searchQuery && (
          <MostPopularCarousel
            products={products}
            onSelectProduct={(p) => setSelectedProduct(p)}
            onQuickAdd={handleQuickAdd}
            onViewAll={() => {
              const popularItems = products.filter((p) => p.popular || p.topPick);
              setViewAllDrawerState({
                isOpen: true,
                title: "Most Popular",
                subtitle: "Top rated and best-selling barista favorites",
                products: popularItems.length > 0 ? popularItems : products.slice(0, 6),
              });
            }}
          />
        )}

        {/* 4. "ALL MENU" / SPECIALTIES LIST & 2-COLUMN GRID VIEW */}
        <div id="specialties-section" className="pt-1">
          <SpecialtySection
            title={sectionTitle}
            products={filteredProducts}
            onSelectProduct={(p) => setSelectedProduct(p)}
            onQuickAdd={handleQuickAdd}
            isGrid={isGridView}
            onToggleViewMode={() => setIsGridView((prev) => !prev)}
            onFullView={() => {
              setViewAllDrawerState({
                isOpen: true,
                title: sectionTitle,
                subtitle: `Browse all ${filteredProducts.length} items in full 2-column grid`,
                products: filteredProducts,
              });
            }}
          />
        </div>

      </main>

      {/* FLOATING QUICK-ACCESS BASKET BAR (Mobile bottom sticky bar when cart has items) */}
      {cartItemCount > 0 && !isCartOpen && !selectedProduct && !isCheckoutOpen && !isReceiptOpen && !viewAllDrawerState.isOpen && (
        <div className="fixed bottom-4 inset-x-0 z-40 px-4 max-w-lg mx-auto animate-in slide-in-from-bottom-3 duration-300">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="w-full h-14 rounded-full bg-[#00A86B] hover:bg-emerald-700 text-white p-3 px-5 flex items-center justify-between shadow-xl shadow-emerald-700/25 active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <ShoppingBag className="h-4 w-4 text-white" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold leading-tight">
                  {cartItemCount} {cartItemCount === 1 ? "Item" : "Items"} in Tray
                </div>
                <div className="text-[11px] text-emerald-100 font-medium">
                  {orderType === "DINE_IN" ? "Dine-In Cafe" : "Takeaway"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 font-extrabold text-sm sm:text-base font-display">
              <span>{formatPrice(cartTotal)}</span>
              <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* 4. ITEM CUSTOMIZATION BOTTOM SHEET / DRAWER */}
      <ProductDrawer
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
      />

      {/* 5. DEDICATED "VIEW ALL" / "FULL VIEW" 2-COLUMN GRID DRAWER */}
      <ViewAllDrawer
        isOpen={viewAllDrawerState.isOpen}
        onClose={() => setViewAllDrawerState((prev) => ({ ...prev, isOpen: false }))}
        title={viewAllDrawerState.title}
        subtitle={viewAllDrawerState.subtitle}
        products={viewAllDrawerState.products}
        onSelectProduct={(p) => setSelectedProduct(p)}
        onQuickAdd={handleQuickAdd}
      />

      {/* 6. ORDER SUMMARY & CART BOTTOM SHEET */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        orderType={orderType}
        onChangeOrderType={setOrderType}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* 7. DIRECT CHECKOUT DRAWER */}
      <CheckoutDrawer
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cart}
        defaultOrderType={orderType}
        onOrderCompleted={handleOrderCompleted}
      />

      {/* 8. DIGITAL RECEIPT & LIVE ORDER STATUS DRAWER */}
      <OrderReceiptDrawer
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        order={viewingOrder}
        onOrderUpdated={handleOrderUpdated}
        onOrderAgain={() => setIsCartOpen(true)}
      />

      {/* 9. ORDER HISTORY DRAWER */}
      <OrderHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        orders={savedOrders}
        onSelectOrder={(order) => {
          setViewingOrder(order);
          setIsReceiptOpen(true);
        }}
        onClearHistory={handleClearHistory}
      />

      {/* 10. KITCHEN KDS STAFF DRAWER */}
      <KitchenKdsDrawer
        isOpen={isKdsOpen}
        onClose={() => setIsKdsOpen(false)}
        onOrderStatusUpdated={handleOrderUpdated}
      />
    </div>
  );
}
