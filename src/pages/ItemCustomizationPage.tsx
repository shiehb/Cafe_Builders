import React, { useState, useEffect } from "react";
import { ArrowLeft, Check, Minus, Plus, Flame, Sparkles, Heart, Share2, AlertCircle } from "lucide-react";
import { Product, ItemCustomization } from "../types";
import { PRODUCTS } from "../data/menuData";
import { formatPrice } from "../lib/utils";
import { navigate } from "../lib/router";
import { useCart } from "../context/CartContext";

const ICE_LEVELS = ["Less Ice", "Regular Ice", "No Ice", "Extra Ice"] as const;
const SWEETNESS_CHOICES = ["Regular Sweetness", "Less Sweet", "Light Sweet", "No Sugar"] as const;

const MILK_OPTIONS = [
  { label: "Whole Fresh Milk", price: 0 },
  { label: "Oat Milk", price: 35 },
  { label: "Almond Milk", price: 35 },
  { label: "Soy Milk", price: 25 },
];

const ADDON_OPTIONS = [
  { label: "Extra Espresso Shot", price: 40 },
  { label: "Himalayan Sea Salt Foam", price: 30 },
  { label: "Artisan Coffee Jelly", price: 25 },
  { label: "Vanilla Bean Syrup", price: 20 },
];

interface ItemCustomizationPageProps {
  productId: string;
}

export const ItemCustomizationPage: React.FC<ItemCustomizationPageProps> = ({ productId }) => {
  const { addToCart, showToast } = useCart();
  const [product, setProduct] = useState<Product | null>(() => {
    return PRODUCTS.find((p) => p.id === productId) || null;
  });
  const [loading, setLoading] = useState<boolean>(!product);

  // Customization States
  const [quantity, setQuantity] = useState<number>(1);
  const [temperature, setTemperature] = useState<"Hot" | "Iced">("Iced");
  const [iceLevel, setIceLevel] = useState<"Regular Ice" | "Less Ice" | "No Ice" | "Extra Ice">("Less Ice");
  const [sweetness, setSweetness] = useState<"Regular Sweetness" | "Less Sweet" | "Light Sweet" | "No Sugar">("Regular Sweetness");
  const [selectedMilk, setSelectedMilk] = useState(MILK_OPTIONS[0]);
  const [selectedAddons, setSelectedAddons] = useState<{ label: string; price: number }[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState<string>("");
  const [isFavorited, setIsFavorited] = useState<boolean>(false);

  // Fetch live product from API
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

  useEffect(() => {
    if (product?.temperatureOptions?.includes("Hot") && !product?.temperatureOptions?.includes("Iced")) {
      setTemperature("Hot");
    } else {
      setTemperature("Iced");
    }
  }, [product]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#00A86B] border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-stone-500 font-bold">Loading item details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-stone-400" />
        <div>
          <h2 className="text-lg font-black text-stone-900">Item Not Found</h2>
          <p className="text-xs text-stone-500 mt-1">The requested menu item could not be located.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="px-5 py-2.5 rounded-2xl bg-[#00A86B] text-white text-xs font-black hover:bg-emerald-700 transition-all cursor-pointer"
        >
          Back to Menu
        </button>
      </div>
    );
  }

  const isSoldOut = product.isAvailable === false;

  const toggleAddon = (addon: { label: string; price: number }) => {
    if (selectedAddons.some((a) => a.label === addon.label)) {
      setSelectedAddons(selectedAddons.filter((a) => a.label !== addon.label));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const extraPricePerItem =
    (product.milkOptionsAvailable ? selectedMilk.price : 0) +
    selectedAddons.reduce((sum, a) => sum + a.price, 0);

  const unitPrice = product.price + extraPricePerItem;
  const lineTotal = unitPrice * quantity;

  const handleAdd = () => {
    if (isSoldOut) return;

    const customizations: ItemCustomization = {
      iceLevel: temperature === "Iced" ? iceLevel : undefined,
      sweetness: product.sweetnessAdjustable ? sweetness : undefined,
      milkOption: product.milkOptionsAvailable ? selectedMilk.label : undefined,
      addOns: selectedAddons.map((a) => `${a.label} (+${formatPrice(a.price)})`),
      specialInstructions: specialInstructions.trim() || undefined,
    };

    addToCart(product, quantity, customizations, extraPricePerItem);
    navigate("/cart");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: product.name,
          text: `Check out ${product.name} at Artisan Brew & Kitchen!`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast("Link copied to clipboard!", "info");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-stone-900 flex flex-col font-sans pb-32">
      {/* 1. TOP HEADER & NAVIGATION */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-2xs">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Back to Menu"
            title="Back to Menu"
            className="p-2 -ml-2 rounded-xl text-stone-700 hover:text-stone-950 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
            {product.categoryName || "Item Customization"}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share item"
              className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsFavorited((prev) => !prev);
                showToast(isFavorited ? "Removed from favorites" : "Added to favorites", "info");
              }}
              aria-label="Favorite item"
              className="p-2 rounded-xl text-stone-500 hover:text-rose-500 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <Heart className={`h-4 w-4 ${isFavorited ? "fill-rose-500 text-rose-500" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. ITEM HERO IMAGE & DETAILS */}
      <main className="max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        <div className="relative rounded-3xl overflow-hidden bg-stone-900 shadow-md aspect-video sm:aspect-2/1">
          <img
            src={product.imageUrl}
            alt={product.name}
            className={`w-full h-full object-cover transition-opacity ${isSoldOut ? "opacity-40 grayscale" : ""}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-5 sm:p-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black uppercase tracking-wider">
                {product.categoryName}
              </span>
              {product.popular && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-stone-950 text-[11px] font-black flex items-center gap-1">
                  <Flame className="h-3 w-3 fill-stone-950" />
                  Popular
                </span>
              )}
              {isSoldOut && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-black">
                  86'd / Sold Out
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              {product.name}
            </h1>
            <p className="text-lg font-black font-display text-emerald-400 mt-1">
              {formatPrice(product.price)}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-2xs space-y-2">
          <h2 className="text-xs font-black uppercase text-stone-400 tracking-wider">About This Item</h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            {product.description || "Handcrafted to perfection with premium artisan ingredients."}
          </p>
          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-bold"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {isSoldOut ? (
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 text-center space-y-2">
            <p className="text-sm font-black text-rose-800">Currently 86'd (Sold Out)</p>
            <p className="text-xs text-rose-600">
              This item is temporarily unavailable today. Please check back later or explore other specialties on our menu.
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-2 px-5 py-2 rounded-xl bg-stone-900 text-white text-xs font-black cursor-pointer"
            >
              Browse Other Items
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 3. TEMPERATURE SELECTOR */}
            {product.temperatureOptions && product.temperatureOptions.length > 1 && (
              <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase text-stone-900 tracking-wider">Temperature</h2>
                  <span className="text-[10px] font-bold text-stone-400">Select 1</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {product.temperatureOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setTemperature(opt as "Hot" | "Iced")}
                      className={`p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        temperature === opt
                          ? "border-[#00A86B] bg-emerald-50 text-[#00A86B] shadow-xs"
                          : "border-stone-200 bg-stone-50/50 text-stone-700 hover:border-stone-300"
                      }`}
                    >
                      <span>{opt === "Hot" ? "♨️ Hot" : "🧊 Iced"}</span>
                      {temperature === opt && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. ICE LEVEL (If Iced) */}
            {temperature === "Iced" && (
              <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase text-stone-900 tracking-wider">Ice Level</h2>
                  <span className="text-[10px] font-bold text-stone-400">Required</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {ICE_LEVELS.map((ice) => (
                    <button
                      key={ice}
                      type="button"
                      onClick={() => setIceLevel(ice)}
                      className={`p-3 rounded-2xl border text-center text-xs font-bold transition-all cursor-pointer ${
                        iceLevel === ice
                          ? "border-[#00A86B] bg-emerald-50 text-[#00A86B] shadow-xs"
                          : "border-stone-200 bg-stone-50/50 text-stone-700 hover:border-stone-300"
                      }`}
                    >
                      {ice}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. SWEETNESS LEVEL */}
            {product.sweetnessAdjustable && (
              <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase text-stone-900 tracking-wider">Sweetness Level</h2>
                  <span className="text-[10px] font-bold text-stone-400">Required</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {SWEETNESS_CHOICES.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSweetness(opt)}
                      className={`p-3 rounded-2xl border text-center text-xs font-bold transition-all cursor-pointer ${
                        sweetness === opt
                          ? "border-[#00A86B] bg-emerald-50 text-[#00A86B] shadow-xs"
                          : "border-stone-200 bg-stone-50/50 text-stone-700 hover:border-stone-300"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 6. MILK SELECTION */}
            {product.milkOptionsAvailable && (
              <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase text-stone-900 tracking-wider">Dairy / Plant Milk</h2>
                  <span className="text-[10px] font-bold text-stone-400">Select 1</span>
                </div>
                <div className="space-y-2">
                  {MILK_OPTIONS.map((milk) => (
                    <button
                      key={milk.label}
                      type="button"
                      onClick={() => setSelectedMilk(milk)}
                      className={`w-full p-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        selectedMilk.label === milk.label
                          ? "border-[#00A86B] bg-emerald-50 text-[#00A86B] shadow-xs"
                          : "border-stone-200 bg-stone-50/50 text-stone-700 hover:border-stone-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                            selectedMilk.label === milk.label
                              ? "border-[#00A86B] bg-[#00A86B] text-white"
                              : "border-stone-300 bg-white"
                          }`}
                        >
                          {selectedMilk.label === milk.label && <Check className="h-3 w-3" />}
                        </div>
                        <span>{milk.label}</span>
                      </div>
                      <span className="font-mono text-xs">
                        {milk.price > 0 ? `+${formatPrice(milk.price)}` : "Included"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 7. ADD-ONS */}
            <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase text-stone-900 tracking-wider">Optional Add-Ons</h2>
                <span className="text-[10px] font-bold text-stone-400">Optional</span>
              </div>
              <div className="space-y-2">
                {ADDON_OPTIONS.map((addon) => {
                  const isChecked = selectedAddons.some((a) => a.label === addon.label);
                  return (
                    <button
                      key={addon.label}
                      type="button"
                      onClick={() => toggleAddon(addon)}
                      className={`w-full p-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        isChecked
                          ? "border-[#00A86B] bg-emerald-50 text-[#00A86B] shadow-xs"
                          : "border-stone-200 bg-stone-50/50 text-stone-700 hover:border-stone-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-4 w-4 rounded-md border flex items-center justify-center ${
                            isChecked
                              ? "border-[#00A86B] bg-[#00A86B] text-white"
                              : "border-stone-300 bg-white"
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3" />}
                        </div>
                        <span>{addon.label}</span>
                      </div>
                      <span className="font-mono text-xs text-[#00A86B]">
                        +{formatPrice(addon.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 8. SPECIAL INSTRUCTIONS */}
            <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-2xs space-y-2">
              <h2 className="text-xs font-black uppercase text-stone-900 tracking-wider">
                Special Barista Notes
              </h2>
              <textarea
                rows={2}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Extra hot, separate lid, extra straw..."
                className="w-full p-3 rounded-2xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:bg-white focus:outline-none focus:border-[#00A86B] transition-all resize-none"
              />
            </div>
          </div>
        )}
      </main>

      {/* 9. FIXED FLOATING BOTTOM ACTION BAR */}
      {!isSoldOut && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 p-4 shadow-xl">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {/* Quantity Stepper */}
            <div className="flex items-center border border-stone-200 bg-stone-100/70 rounded-2xl p-1 shrink-0">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="h-9 w-9 rounded-xl flex items-center justify-center text-stone-600 hover:bg-white hover:shadow-xs transition-all cursor-pointer"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-xs font-black font-display">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Increase quantity"
                className="h-9 w-9 rounded-xl flex items-center justify-center text-stone-600 hover:bg-white hover:shadow-xs transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Add to Tray Button */}
            <button
              type="button"
              onClick={handleAdd}
              className="flex-1 h-12 rounded-2xl bg-[#00A86B] hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-between px-5 shadow-lg shadow-emerald-700/25 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Add to Tray</span>
              <span className="font-display font-black text-sm sm:text-base">
                {formatPrice(lineTotal)}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
