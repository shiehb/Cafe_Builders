import React, { useState, useEffect, useMemo } from "react";
import { ChevronLeft, Check, Minus, Plus, AlertCircle } from "lucide-react";
import { ItemCustomization } from "../types";
import { formatPrice } from "../lib/utils";
import { navigate } from "../lib/router";
import { useCart } from "../context/CartContext";
import { PRODUCTS } from "../data/menuData";
import { isFoodCategory } from "./ItemCustomizationPage";

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

const FOOD_WARMING_OPTIONS = [
  { label: "Warmed Up", description: "Freshly heated & served warm", icon: "♨️" },
  { label: "Room Temp", description: "Served fresh as is", icon: "🥐" },
];

const FOOD_ADDONS = [
  { label: "Extra Whipped Butter", price: 20 },
  { label: "Artisan Honey Drizzle", price: 20 },
  { label: "Crushed Roasted Pistachios", price: 30 },
  { label: "Warm Chocolate Dip", price: 35 },
];

interface EditCartItemPageProps {
  cartItemId: string;
}

export const EditCartItemPage: React.FC<EditCartItemPageProps> = ({ cartItemId }) => {
  const { cart, updateCartItem } = useCart();

  // Resolve effective cart with fallback to localStorage
  const effectiveCart = useMemo(() => {
    if (cart && cart.length > 0) return cart;
    try {
      const stored =
        localStorage.getItem("cafe_customer_cart_v2") ||
        localStorage.getItem("cafe_customer_cart") ||
        localStorage.getItem("cafe_cart");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return cart || [];
  }, [cart]);

  const cleanTargetId = decodeURIComponent(cartItemId || "").trim();
  const normalizedSearchId = cleanTargetId.toLowerCase();

  const cartItem =
    effectiveCart.find((i) => i.id === cartItemId || i.id === cleanTargetId) ||
    effectiveCart.find((i) => decodeURIComponent(i.id || "") === cleanTargetId) ||
    effectiveCart.find((i) => (i.id || "").toLowerCase() === normalizedSearchId) ||
    effectiveCart.find((i) => (i.productId || "").toLowerCase() === normalizedSearchId) ||
    effectiveCart.find((i) => (i.product?.id || "").toLowerCase() === normalizedSearchId) ||
    (!isNaN(Number(cleanTargetId)) && effectiveCart[Number(cleanTargetId)]) ||
    (effectiveCart.length === 1 ? effectiveCart[0] : undefined) ||
    effectiveCart[0];

  const product =
    cartItem?.product ||
    (cartItem?.productId ? PRODUCTS.find((p) => p.id === cartItem.productId) : undefined) ||
    PRODUCTS.find((p) => p.id === cleanTargetId) ||
    PRODUCTS[0];

  const isFood = isFoodCategory(product);

  // Customization States
  const [quantity, setQuantity] = useState<number>(() => cartItem?.quantity || 1);
  const [iceLevel, setIceLevel] = useState<string>(() => {
    const raw = cartItem?.customizations?.iceLevel || "";
    if (raw.includes("No")) return "Less";
    if (raw.includes("Less")) return "Less";
    if (raw.includes("Extra")) return "Extra";
    return "Normal";
  });

  const [sweetness, setSweetness] = useState<string>(() => {
    const raw = cartItem?.customizations?.sweetness || "";
    if (raw.includes("0%")) return "0%";
    if (raw.includes("25%")) return "25%";
    if (raw.includes("75%")) return "75%";
    if (raw.includes("100%")) return "100%";
    if (raw.includes("No Sugar")) return "0%";
    if (raw.includes("Light")) return "25%";
    if (raw.includes("Less")) return "50%";
    return "50%";
  });

  const [foodWarming, setFoodWarming] = useState<string>(() => {
    return cartItem?.customizations?.servingPreference?.includes("Room")
      ? "Room Temp"
      : "Warmed Up";
  });

  const [selectedMilk, setSelectedMilk] = useState(() => {
    if (cartItem?.customizations?.milkOption) {
      const found = MILK_OPTIONS.find((m) => m.label === cartItem.customizations.milkOption);
      if (found) return found;
    }
    return MILK_OPTIONS[0];
  });

  const [selectedAddons, setSelectedAddons] = useState<{ label: string; price: number }[]>(() => {
    if (!cartItem?.customizations?.addOns || cartItem.customizations.addOns.length === 0) return [];
    const sourceList = isFood ? FOOD_ADDONS : BEVERAGE_ADDONS;
    return sourceList.filter((opt) =>
      cartItem.customizations.addOns?.some((str) => str.startsWith(opt.label))
    );
  });

  const [specialInstructions, setSpecialInstructions] = useState<string>(
    () => cartItem?.customizations?.specialInstructions || ""
  );

  // Sync if cartItem changes
  useEffect(() => {
    if (cartItem) {
      setQuantity(cartItem.quantity);
      if (cartItem.customizations?.iceLevel) {
        const raw = cartItem.customizations.iceLevel;
        if (raw.includes("No")) setIceLevel("Less");
        else if (raw.includes("Less")) setIceLevel("Less");
        else if (raw.includes("Extra")) setIceLevel("Extra");
        else setIceLevel("Normal");
      }
      if (cartItem.customizations?.sweetness) {
        const raw = cartItem.customizations.sweetness;
        if (raw.includes("0%")) setSweetness("0%");
        else if (raw.includes("25%")) setSweetness("25%");
        else if (raw.includes("75%")) setSweetness("75%");
        else if (raw.includes("100%")) setSweetness("100%");
      }
      if (cartItem.customizations?.milkOption) {
        const found = MILK_OPTIONS.find((m) => m.label === cartItem.customizations.milkOption);
        if (found) setSelectedMilk(found);
      }
      setSpecialInstructions(cartItem.customizations?.specialInstructions || "");
    }
  }, [cartItem]);

  if (!cartItem || !product || effectiveCart.length === 0) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans">
        <AlertCircle className="h-12 w-12 text-[#6B7280]" />
        <div>
          <h2 className="text-[16px] font-semibold text-[#1F2937]">Your Cart is Empty</h2>
          <p className="text-[12px] text-[#6B7280] mt-1 max-w-xs mx-auto">
            There are no items in your cart to edit. Browse our menu to add your favorite drinks and treats.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="px-6 py-2.5 rounded-full bg-[#00A86B] text-white text-[12px] font-bold hover:bg-[#008F5B] transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Explore Menu</span>
        </button>
      </div>
    );
  }

  const toggleAddon = (addon: { label: string; price: number }) => {
    if (selectedAddons.some((a) => a.label === addon.label)) {
      setSelectedAddons(selectedAddons.filter((a) => a.label !== addon.label));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const extraPricePerItem =
    (!isFood && product.milkOptionsAvailable ? selectedMilk.price : 0) +
    selectedAddons.reduce((sum, a) => sum + a.price, 0);

  const unitPrice = product.price + extraPricePerItem;
  const lineTotal = unitPrice * quantity;

  const handleUpdate = () => {
    if (!cartItem) return;
    const updatedCustomizations: ItemCustomization = isFood
      ? {
          servingPreference: foodWarming,
          addOns: selectedAddons.map((a) => `${a.label} (+${formatPrice(a.price)})`),
          specialInstructions: specialInstructions.trim() || undefined,
        }
      : {
          iceLevel,
          sweetness: sweetness ? `${sweetness} Sugar` : undefined,
          milkOption: product.milkOptionsAvailable ? selectedMilk.label : undefined,
          addOns: selectedAddons.map((a) => `${a.label} (+${formatPrice(a.price)})`),
          specialInstructions: specialInstructions.trim() || undefined,
        };

    updateCartItem(cartItem.id, quantity, updatedCustomizations, extraPricePerItem);
    navigate("/cart");
  };

  return (
    <div className="min-h-screen bg-[#F7F9FA] text-[#1F2937] flex flex-col font-sans pb-28">
      {/* 1. TOP BAR */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] shadow-xs">
        <div className="max-w-md md:max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/cart")}
            aria-label="Back to Cart"
            title="Back to Cart"
            className="h-10 w-10 rounded-full text-[#1F2937] hover:bg-[#F3F4F6] flex items-center justify-center transition-colors cursor-pointer -ml-2"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <span className="font-bold text-[15px] leading-[20px] text-[#1F2937]">
            Edit Customization
          </span>

          <div className="w-10" />
        </div>
      </header>

      {/* 2. MEDIA SECTION & DETAILS */}
      <main className="max-w-md md:max-w-2xl w-full mx-auto px-4 py-4 space-y-4">
        {/* Product Card */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-xs">
          <div className="relative aspect-video w-full bg-stone-100 overflow-hidden">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-4 sm:p-5 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-[18px] sm:text-[20px] font-bold text-[#1F2937] leading-tight">
                  {product.name}
                </h1>
                <p className="text-[12px] text-[#6B7280] mt-0.5">
                  Update item customization in your cart
                </p>
              </div>
              <span className="text-[18px] font-bold text-[#00A86B] shrink-0">
                {formatPrice(product.price)}
              </span>
            </div>
          </div>
        </div>

        {/* CUSTOMIZATION OPTIONS */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs space-y-5">
          {isFood ? (
            /* ===== FOOD / PASTRIES OPTIONS ===== */
            <>
              {/* Serving Preference */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-bold text-[#1F2937]">Serving Preference</h2>
                  <span className="text-[11px] text-[#6B7280]">Select 1</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {FOOD_WARMING_OPTIONS.map((opt) => {
                    const isSelected = foodWarming === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setFoodWarming(opt.label)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? "border-[#00A86B] bg-[#E6F6F0]"
                            : "border-[#E5E7EB] bg-[#F7F9FA] hover:bg-stone-100"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-[13px] font-bold flex items-center gap-1.5 ${isSelected ? "text-[#00A86B]" : "text-[#1F2937]"}`}>
                            <span>{opt.icon}</span>
                            <span>{opt.label}</span>
                          </span>
                          {isSelected && <Check className="h-4 w-4 text-[#00A86B]" />}
                        </div>
                        <p className="text-[11px] text-[#6B7280]">{opt.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Food Add-ons */}
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
            </>
          ) : (
            /* ===== BEVERAGE OPTIONS ===== */
            <>
              {/* Sugar Level */}
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

              {/* Ice Level (only when Iced) */}
              {true && (
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

              {/* Milk Option */}
              {product.milkOptionsAvailable && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-[#1F2937]">Dairy / Plant Milk</h2>
                    <span className="text-[11px] text-[#6B7280]">Optional</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {MILK_OPTIONS.map((milk) => {
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

              {/* Beverage Add-ons */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-bold text-[#1F2937]">Add-ons & Toppings</h2>
                  <span className="text-[11px] text-[#6B7280]">Optional</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BEVERAGE_ADDONS.map((addon) => {
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
            </>
          )}

          {/* Special Instructions */}
          <div className="space-y-2">
            <h2 className="text-[15px] font-bold text-[#1F2937]">Special Notes</h2>
            <textarea
              rows={2}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Special notes or preparation instructions..."
              className="w-full p-3 rounded-2xl border border-[#E5E7EB] bg-[#F7F9FA] text-[13px] text-[#1F2937] focus:bg-white focus:outline-none focus:border-[#00A86B] transition-all resize-none"
            />
          </div>
        </div>
      </main>

      {/* 3. STICKY BOTTOM BAR */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] p-3.5 sm:p-4 shadow-footer">
        <div className="max-w-md md:max-w-2xl mx-auto flex items-center gap-3">
          {/* Quantity Stepper */}
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

          {/* Save Changes Button */}
          <button
            type="button"
            onClick={handleUpdate}
            className="flex-1 h-12 rounded-full bg-[#00A86B] hover:bg-[#008F5B] text-white font-bold text-[14px] leading-[20px] flex items-center justify-center shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
          >
            Update Item • {formatPrice(lineTotal)}
          </button>
        </div>
      </div>
    </div>
  );
};
