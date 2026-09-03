import React, { useState, useEffect } from "react";
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
      />

      {/* Pinned Category Bar (Fixed below header) */}
      <div className="sticky top-14 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] py-2 px-4 sm:px-6 shadow-xs">
        <div className="max-w-3xl mx-auto">
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategory}
            onSelectCategory={(id) => {
              setSelectedCategory(id);
            }}
          />
        </div>
      </div>

      {/* Main Scrollable Content */}
      <main className="max-w-3xl w-full mx-auto px-0 sm:px-4 py-4 space-y-5">
        {/* Section 1: Hero Banner Carousel displaying "New & Seasonal Products" */}
        {selectedCategory === "all" && !searchQuery && (
          <SeasonalHeroCarousel
            products={products}
            onSelectProduct={(p) => navigate(`/item/${p.id}`)}
          />
        )}

        {/* Section 2: "Popular" horizontal card scroll */}
        {selectedCategory === "all" && !searchQuery && (
          <MostPopularCarousel
            products={products}
            onSelectProduct={(p) => navigate(`/item/${p.id}`)}
            onQuickAdd={handleQuickAdd}
          />
        )}

        {/* Section 3: "All Items" list view */}
        <div id="all-items-section" className="pt-0.5">
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
