import React, { useState, useEffect } from "react";
import { Category, Product, ItemCustomization } from "./types";
import { CATEGORIES, PRODUCTS } from "./data/menuData";
import { Navbar } from "./components/Navbar";
import { CategoryNav } from "./components/CategoryNav";
import { MostPopularCarousel } from "./components/MostPopularCarousel";
import { SpecialtySection } from "./components/SpecialtySection";
import { Search, X, ShoppingBag, ArrowRight } from "lucide-react";
import { formatPrice } from "./lib/utils";
import { useProductInventoryRealtime } from "./lib/realtime";
import { useParsedRoute, navigate } from "./lib/router";
import { CartProvider, useCart } from "./context/CartContext";

// Standalone Full Pages
import { KdsPage } from "./pages/KdsPage";
import { PosPage } from "./pages/PosPage";
import { AdminPage } from "./pages/AdminPage";
import { AdminProductNewPage } from "./pages/AdminProductNewPage";
import { AdminProductEditPage } from "./pages/AdminProductEditPage";
import { ItemCustomizationPage } from "./pages/ItemCustomizationPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { OrderReceiptPage } from "./pages/OrderReceiptPage";

export default function App() {
  return (
    <CartProvider>
      <AppRouter />
    </CartProvider>
  );
}

function AppRouter() {
  const route = useParsedRoute();

  switch (route.type) {
    case "kds":
      return <KdsPage />;
    case "pos":
      return <PosPage />;
    case "admin":
      return <AdminPage />;
    case "admin_product_new":
      return <AdminProductNewPage />;
    case "admin_product_edit":
      return <AdminProductEditPage productId={route.id} />;
    case "item":
      return <ItemCustomizationPage productId={route.id} />;
    case "cart":
      return <CartPage />;
    case "checkout":
      return <CheckoutPage />;
    case "order":
      return <OrderReceiptPage orderIdOrNumber={route.id} />;
    case "home":
    default:
      return <CustomerApp />;
  }
}

function CustomerApp() {
  const { cartItemCount, cartTotal, orderType, addToCart, savedOrders, showToast } = useCart();
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isGridView, setIsGridView] = useState<boolean>(false);

  // Global Realtime listener for live product inventory & availability updates
  useProductInventoryRealtime((updatedProduct: Product) => {
    if (!updatedProduct || !updatedProduct.id) return;
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p))
    );
  });

  // Fetch live products & categories from server API
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

  const getGreeting = () => {
    const currentHour = new Date().getHours();
    if (currentHour < 12) return "Good morning, Coffee Lover ☕";
    if (currentHour < 18) return "Good afternoon, Coffee Lover ☕";
    return "Good evening, Coffee Lover ☕";
  };

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

  const handleQuickAdd = (product: Product) => {
    if (!product.isAvailable) {
      showToast(`${product.name} is currently sold out.`, "error");
      return;
    }
    const defaultCustomization: ItemCustomization = {
      iceLevel: product.temperatureOptions?.includes("Iced") ? "Less Ice" : undefined,
      sweetness: product.sweetnessAdjustable ? "Regular Sweetness" : undefined,
    };
    addToCart(product, 1, defaultCustomization, 0);
  };

  const activeOrder = savedOrders.find((o) => o.status !== "COMPLETED");
  const currentCategoryObj = categories.find((c) => c.id === selectedCategory);
  const sectionTitle =
    selectedCategory === "all"
      ? "Artisan Specialties"
      : currentCategoryObj?.name || "Artisan Specialties";

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-stone-900 flex flex-col font-sans pb-28">
      {/* Top Navbar */}
      <Navbar
        onOpenCart={() => navigate("/cart")}
        onOpenReceipts={() => {
          if (savedOrders.length > 0) {
            navigate(`/order/${savedOrders[0].id}`);
          } else {
            showToast("No active or previous orders found on this device.", "info");
          }
        }}
        onOpenKds={() => navigate("/kds")}
        cartCount={cartItemCount}
        cartTotal={cartTotal}
        activeOrder={activeOrder}
        onSelectActiveOrder={(order) => navigate(`/order/${order.id}`)}
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

        {/* 2. STICKY SEARCH & CATEGORY BAR */}
        <div className="sticky top-14 z-30 bg-[#F8F9FA]/95 sm:bg-white/90 backdrop-blur-md pt-2 pb-3 px-4 sm:px-0 space-y-2.5 border-b border-stone-200/70 shadow-2xs -mx-0 sm:-mx-0 transition-all">
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

          {/* Category Pills */}
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategory}
            onSelectCategory={(id) => {
              setSelectedCategory(id);
              setSearchQuery("");
            }}
          />
        </div>

        {/* 3. MOST POPULAR CAROUSEL */}
        {selectedCategory === "all" && !searchQuery && (
          <MostPopularCarousel
            products={products}
            onSelectProduct={(p) => navigate(`/item/${p.id}`)}
            onQuickAdd={handleQuickAdd}
            onViewAll={() => {
              const el = document.getElementById("specialties-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          />
        )}

        {/* 4. ALL MENU SPECIALTIES */}
        <div id="specialties-section" className="pt-1">
          <SpecialtySection
            title={sectionTitle}
            products={filteredProducts}
            onSelectProduct={(p) => navigate(`/item/${p.id}`)}
            onQuickAdd={handleQuickAdd}
            isGrid={isGridView}
            onToggleViewMode={() => setIsGridView((prev) => !prev)}
            onFullView={() => setIsGridView(true)}
          />
        </div>
      </main>

      {/* FLOATING QUICK-ACCESS BASKET BAR (Navigates to /cart) */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-4 inset-x-0 z-40 px-4 max-w-lg mx-auto animate-in slide-in-from-bottom-3 duration-300">
          <button
            type="button"
            onClick={() => navigate("/cart")}
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
    </div>
  );
}
