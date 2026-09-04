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
  const [isScrolled, setIsScrolled] = useState<boolean>(false);

  // Scroll listener: Header shows product name when scrolled past hero
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 250);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const effectiveCart = useMemo(() => cart, [cart]);

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
    <div className="min-h-screen bg-[#F7F9FA] text-[#1F2937] flex flex-col font-sans">
      {/* 1. UNCOVERABLE FLOATING BACK BUTTON */}
      <button
        type="button"
        onClick={() => navigate("/cart")}
        aria-label="Back to Cart"
        title="Back to Cart"
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
            className="w-full h-full object-cover"
          />
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
            {/* Current customization summary */}
            <div className="mt-1.5 text-[12px] text-[#6B7280] bg-[#F7F9FA] p-2 rounded-xl border border-[#E5E7EB]">
              <span className="font-medium text-[#1F2937]">Current: </span>
              {!isFood && (
                <>
                  {iceLevel !== "Normal" && `${iceLevel} ice, `}
                  {sweetness && `${sweetness} sugar, `}
                  {selectedMilk.label !== "Whole Fresh Milk" && `${selectedMilk.label}, `}
                </>
              )}
              {selectedAddons.length > 0 && `${selectedAddons.length} add-on(s)`}
              {specialInstructions && `• "${specialInstructions}"`}
              {!isFood && selectedAddons.length === 0 && !specialInstructions && 
                iceLevel === "Normal" && sweetness === "50%" && selectedMilk.label === "Whole Fresh Milk" && 
                "Standard preparation"}
              {isFood && selectedAddons.length === 0 && !specialInstructions && "Standard preparation"}
            </div>
          </div>

          <div className="border-b border-[#E5E7EB]" />

          {/* CUSTOMIZATION OPTIONS */}
          {isFood ? (
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

              {/* Ice Level */}
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

              {/* Milk */}
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

              {/* Add-ons */}
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

              {/* Special Instructions */}
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