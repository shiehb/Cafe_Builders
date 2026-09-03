import React, { useState, useEffect, useRef } from "react";
import { Category, Product, ItemCustomization } from "./types";
import { CATEGORIES, PRODUCTS } from "./data/menuData";
import { Navbar } from "./components/Navbar";
import { CategoryNav } from "./components/CategoryNav";
import { MostPopularCarousel } from "./components/MostPopularCarousel";
import { SeasonalHeroCarousel } from "./components/SeasonalHeroCarousel";
import { SpecialtySection } from "./components/SpecialtySection";
import { HomeBottomNavigation } from "./components/HomeBottomNavigation";
import { useProductInventoryRealtime } from "./lib/realtime";
import { useParsedRoute, navigate } from "./lib/router";
import { CartProvider, useCart } from "./context/CartContext";
import { cn } from "./lib/utils";

// Standalone Full Pages
import { KdsPage } from "./pages/KdsPage";
import { PosPage } from "./pages/PosPage";
import { AdminPage } from "./pages/AdminPage";
import { AdminProductNewPage } from "./pages/AdminProductNewPage";
import { AdminProductEditPage } from "./pages/AdminProductEditPage";
import { ItemCustomizationPage } from "./pages/ItemCustomizationPage";
import { CartPage } from "./pages/CartPage";
import { EditCartItemPage } from "./pages/EditCartItemPage";
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
    case "cart_edit":
      return <EditCartItemPage cartItemId={route.id} />;
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
  const [isCategoryStuck, setIsCategoryStuck] = useState<boolean>(false);
  const categorySentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!categorySentinelRef.current) return;
      const rect = categorySentinelRef.current.getBoundingClientRect();
      // Navbar header is exactly 56px (h-14) high.
      setIsCategoryStuck(rect.top <= 56.5);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [selectedCategory, searchQuery]);

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
    <div className="min-h-screen bg-[#F7F9FA] text-[#1F2937] flex flex-col font-sans pb-24">
      {/* Top Header: Left Brand Logo + Name, Right Expanding Search Icon */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isCategoryStuck={isCategoryStuck}
      />

      {/* Top Carousel Sections: Hero Banner & Popular Items (Visible on "All" view) */}
      {selectedCategory === "all" && !searchQuery && (
        <div className="max-w-3xl w-full mx-auto px-0 sm:px-4 pt-3 pb-3 space-y-5">
          {/* Section 1: Hero Banner Carousel displaying "New & Seasonal Products" */}
          <SeasonalHeroCarousel
            products={products}
            onSelectProduct={(p) => navigate(`/item/${p.id}`)}
          />

          {/* Section 2: "Popular" horizontal card scroll */}
          <MostPopularCarousel
            products={products}
            onSelectProduct={(p) => navigate(`/item/${p.id}`)}
            onQuickAdd={handleQuickAdd}
          />
        </div>
      )}

      {/* Sentinel to accurately detect when Category bar touches the header */}
      <div ref={categorySentinelRef} className="h-0 w-full pointer-events-none" />

      {/* Category Bar: Positioned on top of All Items, sticks seamlessly under heading on scroll */}
      <div
        className={cn(
          "sticky z-30 w-full bg-white/95 backdrop-blur-md py-2.5 transition-all duration-150",
          isCategoryStuck
            ? "top-[55px] border-t-0 border-b border-[#E5E7EB] shadow-xs"
            : "top-14 border-y border-[#E5E7EB]/80"
        )}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategory}
            onSelectCategory={(id) => {
              setSelectedCategory(id);
              if (isCategoryStuck || id !== "all") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          />
        </div>
      </div>

      {/* Main Scrollable Content: All Items */}
      <main className="max-w-3xl w-full mx-auto px-0 sm:px-4 py-3">
        <div id="all-items-section">
          <SpecialtySection
            title={selectedCategory === "all" ? "All Items" : sectionTitle}
            products={filteredProducts}
            onSelectProduct={(p) => navigate(`/item/${p.id}`)}
            onQuickAdd={handleQuickAdd}
            isGrid={isGridView}
            onToggleViewMode={() => setIsGridView((prev) => !prev)}
          />
        </div>
      </main>

      {/* Fixed Bottom Navigation Footer: 100% width distribution / sticky green bar */}
      <HomeBottomNavigation
        cartCount={cartItemCount}
        cartTotal={cartTotal}
        activeOrder={activeOrder}
        onOpenTicket={() => {
          if (activeOrder) {
            navigate(`/order/${activeOrder.id}`);
          } else if (savedOrders.length > 0) {
            navigate(`/order/${savedOrders[0].id}`);
          } else {
            showToast("No active ticket found. Add items to cart to place an order.", "info");
          }
        }}
        onOpenCart={() => navigate("/cart")}
      />
    </div>
  );
}
