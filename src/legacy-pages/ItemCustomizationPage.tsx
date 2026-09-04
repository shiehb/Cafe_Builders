import React, { useState, useEffect } from "react";
import { ChevronLeft, Check, Minus, Plus, AlertCircle } from "lucide-react";
import { Product, ItemCustomization } from "../types";
import { PRODUCTS } from "../data/menuData";
import { formatPrice } from "../lib/utils";
import { navigate } from "../lib/router";
import { useCart } from "../context/CartContext";

const SUGAR_LEVELS = ["0%", "25%", "50%", "75%", "100%"] as const;
const ICE_LEVELS = ["Less", "Regular", "Extra"] as const;

const MILK_OPTIONS = [
  { label: "Whole Fresh Milk", price: 0 },
  { label: "Oat Milk", price: 25 },
  { label: "Almond Milk", price: 25 },
  { label: "Soy Milk", price: 20 },
];

const BEVERAGE_ADDONS = [
  { label: "Extra Espresso Shot", price: 30 },
  { label: "Himalayan Sea Salt Foam", price: 25 },
  { label: "Artisan Coffee Jelly", price: 25 },
  { label: "Vanilla Bean Syrup", price: 20 },
];

const FOOD_ADDONS = [
  { label: "Extra Whipped Butter", price: 20 },
  { label: "Artisan Honey Drizzle", price: 20 },
  { label: "Crushed Roasted Pistachios", price: 30 },
  { label: "Warm Chocolate Dip", price: 35 },
];
const DEFAULT_MILK_OPTIONS = MILK_OPTIONS;
const DEFAULT_BEVERAGE_ADDONS = BEVERAGE_ADDONS;

export const isFoodCategory = (prod: Product | null | undefined): boolean => {
  if (!prod) return false;
  const catId = (prod.categoryId || "").toLowerCase();
  const catName = (prod.categoryName || "").toLowerCase();
  const name = (prod.name || "").toLowerCase();

  return (
    catId.includes("pastr") ||
    catId.includes("brunch") ||
    catId.includes("food") ||
    catId.includes("pasta") ||
    catId.includes("bakery") ||
    catId.includes("snack") ||
    catId.includes("dessert") ||
    catName.includes("pastr") ||
    catName.includes("brunch") ||
    catName.includes("food") ||
    catName.includes("pasta") ||
    catName.includes("bakery") ||
    name.includes("croissant") ||
    name.includes("pasta") ||
    name.includes("toast") ||
    name.includes("sandwich") ||
    name.includes("cookie") ||
    name.includes("muffin")
  );
};

interface ItemCustomizationPageProps {
  productId: string;
}

export const ItemCustomizationPage: React.FC<ItemCustomizationPageProps> = ({ productId }) => {
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(() => {
    return PRODUCTS.find((p) => p.id === productId) || null;
  });
  const [loading, setLoading] = useState<boolean>(!product);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);

  // Customization States
  const [quantity, setQuantity] = useState<number>(1);
  const [iceLevel, setIceLevel] = useState<string>("Normal");
  const [sweetness, setSweetness] = useState<string>("50%");
  const [selectedMilk, setSelectedMilk] = useState(MILK_OPTIONS[0]);
  const [selectedAddons, setSelectedAddons] = useState<{ label: string; price: number }[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState<string>("");

  // Scroll listener: Header shows product name when scrolled past hero
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 250);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch live product from API if available
  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/products/${productId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.product && isMounted) {
            setProduct(json.product);
          }
        }
      } catch {
        // use static fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [productId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#00A86B] border-t-transparent animate-spin mx-auto" />
          <p className="text-[12px] text-[#6B7280] font-semibold">Loading item details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans">
        <AlertCircle className="h-12 w-12 text-[#6B7280]" />
        <div>
          <h2 className="text-[16px] font-semibold text-[#1F2937]">Item Not Found</h2>
          <p className="text-[12px] text-[#6B7280] mt-1">The requested menu item could not be located.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="px-5 py-2 rounded-full bg-[#00A86B] text-white text-[12px] font-bold hover:bg-[#008F5B] transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Menu</span>
        </button>
      </div>
    );
  }

  const isSoldOut = product.isAvailable === false;
  const isFood = isFoodCategory(product);
  const configuredGroups = product.enabledCustomizationGroups;
  const hasGroup = (group: "ice" | "sugar" | "milk" | "addons") =>
    configuredGroups
      ? configuredGroups.includes(group)
      : isFood
        ? group === "addons"
        : group !== "ice";
  const milkOptions = product.milkOptions?.length ? product.milkOptions : DEFAULT_MILK_OPTIONS;
  const beverageAddons = product.addonOptions?.length ? product.addonOptions : DEFAULT_BEVERAGE_ADDONS;

  const toggleAddon = (addon: { label: string; price: number }) => {
    if (selectedAddons.some((a) => a.label === addon.label)) {
      setSelectedAddons(selectedAddons.filter((a) => a.label !== addon.label));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const extraPricePerItem =
    (!isFood && hasGroup("milk") ? selectedMilk.price : 0) +
    (hasGroup("addons") ? selectedAddons.reduce((sum, a) => sum + a.price, 0) : 0);

  const unitPrice = product.price + extraPricePerItem;
  const lineTotal = unitPrice * quantity;

  const handleAdd = () => {
    if (isSoldOut) return;

    const customizations: ItemCustomization = isFood
      ? {
          addOns: hasGroup("addons") ? selectedAddons.map((a) => `${a.label} (+${formatPrice(a.price)})`) : [],
          specialInstructions: specialInstructions.trim() || undefined,
        }
      : {
          iceLevel: hasGroup("ice") ? iceLevel : undefined,
          sweetness: hasGroup("sugar") ? `${sweetness} Sugar` : undefined,
          milkOption: hasGroup("milk") ? selectedMilk.label : undefined,
          addOns: hasGroup("addons") ? selectedAddons.map((a) => `${a.label} (+${formatPrice(a.price)})`) : [],
          specialInstructions: specialInstructions.trim() || undefined,
        };

    addToCart(product, quantity, customizations, extraPricePerItem);
    navigate("/cart");
  };

  return (
    <div className="min-h-screen bg-[#F7F9FA] text-[#1F2937] flex flex-col font-sans">
      {/* 1. UNCOVERABLE FLOATING BACK BUTTON */}
      <button
        type="button"
        onClick={() => navigate("/")}
        aria-label="Back to Menu"
        title="Back to Menu"
        className={`fixed top-2.5 left-4 z-50 h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
          isScrolled
            ? "bg-transparent text-[#1F2937] hover:bg-black/5 shadow-none"
            : "bg-white/90 text-[#1F2937] hover:bg-white shadow-md backdrop-blur-md"
        }`}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      {/* 2. STICKY HEADER */}
      <header
        className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 safe-top ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] shadow-xs translate-y-0"
            : "bg-transparent border-b border-transparent -translate-y-full"
        }`}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="w-10" />
          <div className="flex-1 mx-3 text-center">
            <h1 className="font-bold text-[16px] leading-[22px] text-[#1F2937] truncate">
              {product.name}
            </h1>
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* 3. MEDIA & CUSTOMIZATION FORM */}
      <main className="max-w-3xl w-full mx-auto pb-32 flex-1">
        {/* Hero Product Image */}
        <div className="relative w-full aspect-[4/3] sm:aspect-video bg-stone-100 overflow-hidden">
          <img
            src={product.imageUrl}
            alt={product.name}
            className={`w-full h-full object-cover ${isSoldOut ? "opacity-40 grayscale" : ""}`}
          />
          {isSoldOut && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-[12px] font-bold">
                Sold Out Today
              </span>
            </div>
          )}
        </div>

        {/* Content Card */}
        <div className="-mt-6 relative z-10 bg-white border-t border-x border-[#E5E7EB] rounded-t-3xl px-5 pt-5 pb-8 space-y-5">
          {/* Top Pick Pill & Price */}
          <div className="flex items-center justify-between gap-3">
            <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold tracking-wide uppercase">
              {product.topPick ? "TOP PICK" : product.popular ? "POPULAR" : product.categoryName || "SPECIALTY"}
            </span>

            <span className="text-[22px] font-bold text-[#00A86B]">
              {formatPrice(product.price)}
            </span>
          </div>

          {/* Product Title & Description */}
          <div className="space-y-1.5">
            <h1 className="text-[22px] sm:text-[24px] font-bold text-[#1F2937] leading-tight">
              {product.name}
            </h1>
            <p className="text-[13px] text-[#6B7280] leading-[20px]">
              {product.description || "Handcrafted to perfection with premium artisan ingredients."}
            </p>
          </div>

          <div className="border-b border-[#E5E7EB]" />

          {/* CUSTOMIZATION OPTIONS */}
          {isSoldOut ? (
            <div className="bg-stone-50 border border-[#E5E7EB] rounded-2xl p-6 text-center space-y-2">
              <p className="text-[14px] font-bold text-rose-600">Currently Sold Out</p>
              <p className="text-[12px] text-[#6B7280]">
                This item is temporarily unavailable today. Please browse our other handcrafted specialties.
              </p>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="mt-3 px-5 py-2 rounded-full bg-[#00A86B] text-white text-[12px] font-bold cursor-pointer hover:bg-[#008F5B]"
              >
                Back to Menu
              </button>
            </div>
          ) : isFood ? (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-bold text-[#1F2937]">Add-ons & Extras</h2>
                  <span className="text-[11px] text-[#6B7280]">Optional</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FOOD_ADDONS.map((addon) => {
                    const isChecked = selectedAddons.some((a) => a.label === addon.label);
                    return (
                      <button
                        key={addon.label}
                        type="button"
                        onClick={() => toggleAddon(addon)}
                        className={`p-3 rounded-2xl border text-[13px] font-medium transition-all flex items-center justify-between px-4 cursor-pointer ${
                          isChecked
                            ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold"
                            : "border-[#E5E7EB] bg-[#F7F9FA] text-[#1F2937] hover:bg-stone-100"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                              isChecked
                                ? "border-[#00A86B] bg-[#00A86B] text-white"
                                : "border-[#D1D5DB] bg-white"
                            }`}
                          >
                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <span>{addon.label}</span>
                        </div>
                        <span className="text-[11px] text-[#6B7280]">+{formatPrice(addon.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-[15px] font-bold text-[#1F2937]">Special Notes</h2>
                <textarea
                  rows={2}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="e.g. Cut in half, extra crispy, separate packaging..."
                  className="w-full p-3 rounded-2xl border border-[#E5E7EB] bg-[#F7F9FA] text-[13px] text-[#1F2937] focus:bg-white focus:outline-none focus:border-[#00A86B] transition-all resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {hasGroup("sugar") && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-[#1F2937]">Sugar Level</h2>
                    <span className="text-[11px] text-[#6B7280]">Select 1</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {SUGAR_LEVELS.map((opt) => {
                      const isSelected = sweetness === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSweetness(opt)}
                          className={`h-10 rounded-xl border text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold"
                              : "border-[#E5E7EB] bg-[#F7F9FA] text-[#1F2937] hover:bg-stone-100"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasGroup("ice") && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-[#1F2937]">Ice Level</h2>
                    <span className="text-[11px] text-[#6B7280]">Select 1</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {ICE_LEVELS.map((opt) => {
                      const isSelected = iceLevel === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setIceLevel(opt)}
                          className={`h-10 rounded-xl border text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold"
                              : "border-[#E5E7EB] bg-[#F7F9FA] text-[#1F2937] hover:bg-stone-100"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasGroup("milk") && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-[#1F2937]">Dairy / Plant Milk</h2>
                    <span className="text-[11px] text-[#6B7280]">Optional</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {milkOptions.map((milk) => {
                      const isSelected = selectedMilk.label === milk.label;
                      return (
                        <button
                          key={milk.label}
                          type="button"
                          onClick={() => setSelectedMilk(milk)}
                          className={`p-2.5 rounded-xl border text-[12px] font-semibold transition-all flex items-center justify-between px-3.5 cursor-pointer ${
                            isSelected
                              ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold"
                              : "border-[#E5E7EB] bg-[#F7F9FA] text-[#1F2937] hover:bg-stone-100"
                          }`}
                        >
                          <span>{milk.label}</span>
                          {milk.price > 0 && (
                            <span className="text-[10px] text-[#6B7280]">+{formatPrice(milk.price)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasGroup("addons") && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-[#1F2937]">Add-ons & Toppings</h2>
                    <span className="text-[11px] text-[#6B7280]">Optional</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {beverageAddons.map((addon) => {
                      const isChecked = selectedAddons.some((a) => a.label === addon.label);
                      return (
                        <button
                          key={addon.label}
                          type="button"
                          onClick={() => toggleAddon(addon)}
                          className={`p-3 rounded-2xl border text-[13px] font-medium transition-all flex items-center justify-between px-4 cursor-pointer ${
                            isChecked
                              ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold"
                              : "border-[#E5E7EB] bg-[#F7F9FA] text-[#1F2937] hover:bg-stone-100"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                isChecked
                                  ? "border-[#00A86B] bg-[#00A86B] text-white"
                                  : "border-[#D1D5DB] bg-white"
                              }`}
                            >
                              {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <span>{addon.label}</span>
                          </div>
                          <span className="text-[11px] text-[#6B7280]">+{formatPrice(addon.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h2 className="text-[15px] font-bold text-[#1F2937]">Special Notes</h2>
                <textarea
                  rows={2}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="e.g. separate lid, extra straw..."
                  className="w-full p-3 rounded-2xl border border-[#E5E7EB] bg-[#F7F9FA] text-[13px] text-[#1F2937] focus:bg-white focus:outline-none focus:border-[#00A86B] transition-all resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 4. STICKY BOTTOM BAR */}
      {!isSoldOut && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] shadow-footer safe-bottom-fixed">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <div className="flex items-center border border-[#E5E7EB] bg-[#F7F9FA] rounded-full p-1 shrink-0">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="h-9 w-9 rounded-full flex items-center justify-center text-[#1F2937] hover:bg-white hover:shadow-xs transition-all cursor-pointer"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-[14px] font-bold text-[#1F2937]">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Increase quantity"
                className="h-9 w-9 rounded-full flex items-center justify-center text-[#1F2937] hover:bg-white hover:shadow-xs transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              className="flex-1 h-12 rounded-full bg-[#00A86B] hover:bg-[#008F5B] text-white font-bold text-[14px] leading-[20px] flex items-center justify-center shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
            >
              Add to Cart • {formatPrice(lineTotal)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};