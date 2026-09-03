import React, { useState, useEffect } from "react";
import { ArrowLeft, Check, Minus, Plus, AlertCircle } from "lucide-react";
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
  const { addToCart } = useCart();
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
      <div className="min-h-screen bg-[#F7F9FA] flex flex-col items-center justify-center p-6 text-center space-y-4">
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
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Menu</span>
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

  return (
    <div className="min-h-screen bg-[#F7F9FA] text-[#1F2937] flex flex-col font-sans pb-28">
      {/* 1. TOP BAR: Back button navigation only (NO share icon, NO favorite icon) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] shadow-xs">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Back to Menu"
            title="Back to Menu"
            className="h-10 w-10 rounded-full text-[#1F2937] hover:bg-[#F7F9FA] flex items-center justify-center transition-colors cursor-pointer -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <span className="font-semibold text-[14px] leading-[20px] text-[#1F2937]">
            Customize Order
          </span>

          <div className="w-10" />
        </div>
      </header>

      {/* 2. MEDIA SECTION: Hero product image, title, base price, and "About This Item" description */}
      <main className="max-w-2xl w-full mx-auto px-4 py-4 space-y-4">
        {/* Media Card */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-card">
          <div className="relative aspect-video w-full bg-stone-100 overflow-hidden">
            <img
              src={product.imageUrl}
              alt={product.name}
              className={`w-full h-full object-cover ${isSoldOut ? "opacity-40 grayscale" : ""}`}
            />
            {isSoldOut && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="px-3 py-1 rounded-lg bg-rose-600 text-white text-[12px] font-bold">
                  Sold Out Today
                </span>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-[20px] font-semibold text-[#1F2937] leading-[28px]">
                {product.name}
              </h1>
              <span className="text-[16px] font-bold text-[#00A86B] shrink-0">
                {formatPrice(product.price)}
              </span>
            </div>

            <div className="pt-2 border-t border-[#E5E7EB]">
              <h2 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
                About This Item
              </h2>
              <p className="text-[12px] text-[#6B7280] leading-[18px]">
                {product.description || "Handcrafted to perfection with premium artisan ingredients."}
              </p>
            </div>
          </div>
        </div>

        {isSoldOut ? (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 text-center shadow-card space-y-2">
            <p className="text-[14px] font-bold text-rose-600">Currently Sold Out</p>
            <p className="text-[12px] text-[#6B7280]">
              This item is temporarily unavailable today. Please browse other specialties.
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-3 px-5 py-2 rounded-full bg-[#00A86B] text-white text-[12px] font-bold cursor-pointer hover:bg-[#008F5B]"
            >
              Back to Menu
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* OPTION GROUP 1: Temperature - "Iced" [Selected Green] vs "Hot" */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
                  Temperature
                </h2>
                <span className="text-[10px] font-medium text-[#6B7280]">Select 1</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {(["Iced", "Hot"] as const).map((opt) => {
                  const isSelected = temperature === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setTemperature(opt)}
                      className={`h-11 rounded-full border text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold"
                          : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F7F9FA]"
                      }`}
                    >
                      <span>{opt === "Iced" ? "🧊 Iced" : "♨️ Hot"}</span>
                      {isSelected && <Check className="h-4 w-4 text-[#00A86B]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* OPTION GROUP 2: Ice Level - "Less Ice" [Selected], "Regular Ice", "No Ice", "Extra Ice" */}
            {temperature === "Iced" && (
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
                    Ice Level
                  </h2>
                  <span className="text-[10px] font-medium text-[#6B7280]">Required</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ICE_LEVELS.map((ice) => {
                    const isSelected = iceLevel === ice;
                    return (
                      <button
                        key={ice}
                        type="button"
                        onClick={() => setIceLevel(ice)}
                        className={`h-10 rounded-full border text-center text-[12px] font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold"
                            : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F7F9FA]"
                        }`}
                      >
                        {ice}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* OPTION GROUP 3: Sweetness Level - "Regular Sweetness" [Selected], "Less Sweet", "Light Sweet", "No Sugar" */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
                  Sweetness Level
                </h2>
                <span className="text-[10px] font-medium text-[#6B7280]">Required</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SWEETNESS_CHOICES.map((opt) => {
                  const isSelected = sweetness === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSweetness(opt)}
                      className={`h-10 rounded-full border text-center text-[12px] font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold"
                          : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F7F9FA]"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dairy Options (if applicable) */}
            {product.milkOptionsAvailable && (
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
                    Dairy / Plant Milk
                  </h2>
                  <span className="text-[10px] font-medium text-[#6B7280]">Optional</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MILK_OPTIONS.map((milk) => {
                    const isSelected = selectedMilk.label === milk.label;
                    return (
                      <button
                        key={milk.label}
                        type="button"
                        onClick={() => setSelectedMilk(milk)}
                        className={`p-2.5 rounded-full border text-[12px] font-semibold transition-all flex items-center justify-between px-4 cursor-pointer ${
                          isSelected
                            ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold"
                            : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F7F9FA]"
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

            {/* Artisan Add-ons */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
                  Add-ons & Toppings
                </h2>
                <span className="text-[10px] font-medium text-[#6B7280]">Optional</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ADDON_OPTIONS.map((addon) => {
                  const isChecked = selectedAddons.some((a) => a.label === addon.label);
                  return (
                    <button
                      key={addon.label}
                      type="button"
                      onClick={() => toggleAddon(addon)}
                      className={`p-2.5 rounded-full border text-[12px] font-semibold transition-all flex items-center justify-between px-4 cursor-pointer ${
                        isChecked
                          ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold"
                          : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F7F9FA]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                            isChecked
                              ? "border-[#00A86B] bg-[#00A86B] text-white"
                              : "border-[#E5E7EB] bg-white"
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <span>{addon.label}</span>
                      </div>
                      <span className="text-[10px] text-[#6B7280]">+{formatPrice(addon.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Special Instructions */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-2">
              <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
                Special Notes
              </h2>
              <textarea
                rows={2}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Extra hot, separate lid, extra straw..."
                className="w-full p-3 rounded-2xl border border-[#E5E7EB] bg-[#F7F9FA] text-[12px] text-[#1F2937] focus:bg-white focus:outline-none focus:border-[#00A86B] transition-all resize-none"
              />
            </div>
          </div>
        )}
      </main>

      {/* 4. STICKY BOTTOM BAR: Quantity stepper (- 1 +) + wide button ("Add to Tray - ₱6.20") */}
      {!isSoldOut && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] p-3 sm:p-4 shadow-footer">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {/* Quantity Stepper: (- 1 +) */}
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

            {/* Wide Button ("Add to Cart - ₱...") */}
            <button
              type="button"
              onClick={handleAdd}
              className="flex-1 h-11 rounded-full bg-[#00A86B] hover:bg-[#008F5B] text-white font-bold text-[14px] leading-[20px] flex items-center justify-center shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
            >
              Add to Cart - {formatPrice(lineTotal)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
