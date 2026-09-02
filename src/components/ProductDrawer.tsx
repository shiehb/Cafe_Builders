import React, { useState, useEffect } from "react";
import { Product, ItemCustomization } from "../types";
import { formatPrice } from "../lib/utils";
import {
  X,
  ChevronLeft,
  Share2,
  Heart,
  Plus,
  Minus,
  Check,
  Clock,
  Flame,
  CheckCircle2,
} from "lucide-react";

interface ProductDrawerProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (
    product: Product,
    quantity: number,
    customizations: ItemCustomization,
    customizationsTotal: number
  ) => void;
}

const ICE_LEVELS: ("Regular Ice" | "Less Ice" | "No Ice" | "Extra Ice")[] = [
  "Less Ice",
  "Regular Ice",
  "No Ice",
  "Extra Ice",
];

const SWEETNESS_CHOICES: ("Regular Sweetness" | "Less Sweet" | "Light Sweet" | "No Sugar")[] = [
  "Regular Sweetness",
  "Less Sweet",
  "Light Sweet",
  "No Sugar",
];

const MILK_OPTIONS = [
  { label: "Whole Fresh Milk", price: 0 },
  { label: "Oat Milk", price: 0.85 },
  { label: "Almond Milk", price: 0.85 },
  { label: "Soy Milk", price: 0.65 },
];

const ADDON_OPTIONS = [
  { label: "Extra Espresso Shot", price: 1.0 },
  { label: "Himalayan Sea Salt Foam", price: 0.75 },
  { label: "Artisan Coffee Jelly", price: 0.65 },
  { label: "Vanilla Bean Syrup", price: 0.5 },
];

export const ProductDrawer: React.FC<ProductDrawerProps> = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
}) => {
  if (!product || !isOpen) return null;

  const [quantity, setQuantity] = useState<number>(1);
  const [iceLevel, setIceLevel] = useState<"Regular Ice" | "Less Ice" | "No Ice" | "Extra Ice">("Less Ice");
  const [sweetness, setSweetness] = useState<"Regular Sweetness" | "Less Sweet" | "Light Sweet" | "No Sugar">("Regular Sweetness");
  const [selectedMilk, setSelectedMilk] = useState<{ label: string; price: number }>(MILK_OPTIONS[0]);
  const [selectedAddons, setSelectedAddons] = useState<{ label: string; price: number }[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState<string>("");
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [sharedToast, setSharedToast] = useState<boolean>(false);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);

  useEffect(() => {
    if (product) {
      setQuantity(1);
      setIceLevel("Less Ice");
      setSweetness("Regular Sweetness");
      setSelectedMilk(MILK_OPTIONS[0]);
      setSelectedAddons([]);
      setSpecialInstructions("");
      setIsFavorited(false);
      setSharedToast(false);
      setIsScrolled(false);
    }
  }, [product]);

  const toggleAddon = (addon: { label: string; price: number }) => {
    if (selectedAddons.some((a) => a.label === addon.label)) {
      setSelectedAddons(selectedAddons.filter((a) => a.label !== addon.label));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
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
      setSharedToast(true);
      setTimeout(() => setSharedToast(false), 2000);
    }
  };

  const extraPricePerItem =
    (product.milkOptionsAvailable ? selectedMilk.price : 0) +
    selectedAddons.reduce((sum, a) => sum + a.price, 0);

  const unitPrice = product.price + extraPricePerItem;
  const totalPrice = unitPrice * quantity;

  const handleAdd = () => {
    const customizations: ItemCustomization = {
      iceLevel: product.temperatureOptions?.includes("Iced") ? iceLevel : undefined,
      sweetness: product.sweetnessAdjustable ? sweetness : undefined,
      milkOption: product.milkOptionsAvailable ? selectedMilk.label : undefined,
      addOns: selectedAddons.map((a) => `${a.label} (+${formatPrice(a.price)})`),
      specialInstructions: specialInstructions.trim() || undefined,
    };

    onAddToCart(product, quantity, customizations, extraPricePerItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet Container - Full Page Height */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-full sm:h-[95vh] max-h-screen overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Sticky Top Header Bar with Dynamic Title on Scroll */}
        <div
          className={`sticky top-0 z-30 w-full px-4 py-3 flex items-center justify-between transition-all duration-300 ${
            isScrolled
              ? "bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-2xs text-stone-900"
              : "bg-gradient-to-b from-black/50 via-black/20 to-transparent text-white pointer-events-none"
          }`}
        >
          {/* Top-Left Navigation Control: Single Back Button */}
          <div className="flex items-center pointer-events-auto">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back to Menu"
              title="Back to Menu"
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs ${
                isScrolled
                  ? "bg-stone-100 hover:bg-stone-200 text-stone-700"
                  : "bg-black/40 backdrop-blur-md text-white hover:bg-black/60"
              }`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>

          {/* Dynamically Faded-In Centered Product Title */}
          <div
            className={`flex-1 px-3 text-center transition-all duration-300 ${
              isScrolled
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-2 pointer-events-none"
            }`}
          >
            <h3 className="font-extrabold text-sm sm:text-base text-stone-900 truncate max-w-[180px] sm:max-w-[240px] mx-auto">
              {product.name}
            </h3>
          </div>

          {/* Top Right Action Buttons: Share & Favorite */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share item"
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs ${
                isScrolled
                  ? "bg-stone-100 hover:bg-stone-200 text-stone-700"
                  : "bg-black/40 backdrop-blur-md text-white hover:bg-black/60"
              }`}
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsFavorited(!isFavorited)}
              aria-label="Favorite"
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs ${
                isScrolled
                  ? "bg-stone-100 hover:bg-stone-200 text-stone-700"
                  : "bg-black/40 backdrop-blur-md text-white hover:bg-black/60"
              }`}
            >
              <Heart
                className={`h-4 w-4 transition-colors ${
                  isFavorited
                    ? "fill-rose-500 text-rose-500"
                    : isScrolled
                    ? "text-stone-700"
                    : "text-white"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          onScroll={(e) => setIsScrolled(e.currentTarget.scrollTop > 90)}
          className="flex-1 overflow-y-auto no-scrollbar pb-32 -mt-[56px]"
        >
          
          {/* Full-Bleed Hero Product Photo at Top */}
          <div className="relative aspect-16/10 w-full bg-stone-100 overflow-hidden">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />

            {sharedToast && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-stone-900/90 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-xs flex items-center gap-1.5 shadow-md z-10">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Link copied to clipboard!</span>
              </div>
            )}
          </div>

          {/* Product Header & Meta Details */}
          <div className="p-5 border-b border-stone-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight leading-tight">
                  {product.name}
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-stone-500 leading-relaxed">
                  {product.description}
                </p>
              </div>
            </div>

            {/* Meta Row: Base Price, Prep Time (~4 min), Calories (190 kcal) */}
            <div className="flex flex-wrap items-center gap-4 mt-3.5 pt-3 border-t border-stone-100 text-xs text-stone-600 font-medium">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-stone-900 font-display">
                  {formatPrice(product.price)}
                </span>
                {product.originalPrice && (
                  <span className="text-xs text-stone-400 line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
              </div>

              <div className="h-3.5 w-px bg-stone-200" />

              <div className="flex items-center gap-1 text-stone-600">
                <Clock className="h-3.5 w-3.5 text-[#00A86B]" />
                <span>~{product.prepTimeMinutes || 4} min prep</span>
              </div>

              <div className="h-3.5 w-px bg-stone-200" />

              <div className="flex items-center gap-1 text-stone-600">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                <span>{product.calories || 190} kcal</span>
              </div>
            </div>
          </div>

          {/* Clean Grouped Customization Options */}
          <div className="p-5 space-y-6">
            
            {/* 1. Ice Level (Pick 1) */}
            {product.temperatureOptions?.includes("Iced") && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Ice Level
                  </span>
                  <span className="text-[11px] font-semibold text-[#00A86B] bg-emerald-50 px-2 py-0.5 rounded-full">
                    Pick 1
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ICE_LEVELS.map((level) => {
                    const isSelected = iceLevel === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setIceLevel(level)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-emerald-50/70 border-[#00A86B] text-emerald-900 shadow-2xs"
                            : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <span>{level}</span>
                        <div
                          className={`h-4 w-4 rounded-full flex items-center justify-center border ${
                            isSelected
                              ? "bg-[#00A86B] border-[#00A86B] text-white"
                              : "border-stone-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Choice of Sweetness (Pick 1) */}
            {product.sweetnessAdjustable && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Choice of Sweetness
                  </span>
                  <span className="text-[11px] font-semibold text-[#00A86B] bg-emerald-50 px-2 py-0.5 rounded-full">
                    Pick 1
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SWEETNESS_CHOICES.map((sw) => {
                    const isSelected = sweetness === sw;
                    return (
                      <button
                        key={sw}
                        type="button"
                        onClick={() => setSweetness(sw)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-emerald-50/70 border-[#00A86B] text-emerald-900 shadow-2xs"
                            : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <span>{sw}</span>
                        <div
                          className={`h-4 w-4 rounded-full flex items-center justify-center border ${
                            isSelected
                              ? "bg-[#00A86B] border-[#00A86B] text-white"
                              : "border-stone-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Milk Preference (Optional, max 1) */}
            {product.milkOptionsAvailable && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Milk Preference
                  </span>
                  <span className="text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                    Optional, max 1
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MILK_OPTIONS.map((milk) => {
                    const isSelected = selectedMilk.label === milk.label;
                    return (
                      <button
                        key={milk.label}
                        type="button"
                        onClick={() => setSelectedMilk(milk)}
                        className={`flex flex-col items-start justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-emerald-50/70 border-[#00A86B] text-emerald-900 shadow-2xs"
                            : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{milk.label}</span>
                          <div
                            className={`h-4 w-4 rounded-full flex items-center justify-center border ${
                              isSelected
                                ? "bg-[#00A86B] border-[#00A86B] text-white"
                                : "border-stone-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                          </div>
                        </div>
                        <span className="text-[11px] font-normal text-stone-500 mt-1">
                          {milk.price > 0 ? `+${formatPrice(milk.price)}` : "Included"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Extra Add-ons & Toppings */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Extras & Add-ons
                </span>
                <span className="text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                  Optional
                </span>
              </div>
              <div className="space-y-2">
                {ADDON_OPTIONS.map((addon) => {
                  const isSelected = selectedAddons.some((a) => a.label === addon.label);
                  return (
                    <button
                      key={addon.label}
                      type="button"
                      onClick={() => toggleAddon(addon)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-emerald-50/70 border-[#00A86B] text-emerald-900 shadow-2xs"
                          : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                      }`}
                    >
                      <span className="text-stone-900">{addon.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-stone-600 font-medium">
                          +{formatPrice(addon.price)}
                        </span>
                        <div
                          className={`h-4 w-4 rounded-md flex items-center justify-center border ${
                            isSelected
                              ? "bg-[#00A86B] border-[#00A86B] text-white"
                              : "border-stone-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Special Instructions */}
            <div>
              <label
                htmlFor="instructions"
                className="text-xs font-bold text-stone-900 uppercase tracking-wider block mb-2"
              >
                Special Request (Optional)
              </label>
              <input
                id="instructions"
                type="text"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Extra hot, separate lid, sauce on the side..."
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#00A86B] focus:border-transparent bg-stone-50/50"
              />
            </div>
          </div>
        </div>

        {/* Sticky Bottom Bar: Floating Quantity Selector + Full-Width Solid Green Button */}
        <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-stone-200/80 p-4 shadow-xl flex flex-col gap-3">
          
          {/* Quantity Stepper Row */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-600">Quantity</span>
            <div className="inline-flex items-center bg-stone-100 rounded-full p-1 border border-stone-200">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                aria-label="Decrease quantity"
                className="h-7 w-7 rounded-full bg-white text-stone-800 flex items-center justify-center shadow-xs hover:bg-stone-50 active:scale-90 transition-all cursor-pointer"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-xs font-bold text-stone-900">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                aria-label="Increase quantity"
                className="h-7 w-7 rounded-full bg-white text-stone-800 flex items-center justify-center shadow-xs hover:bg-stone-50 active:scale-90 transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Full-Width Solid Green Button */}
          <button
            type="button"
            onClick={handleAdd}
            className="w-full h-12 rounded-full bg-[#00A86B] hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm sm:text-base flex items-center justify-center shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <span>Add to Basket - {formatPrice(totalPrice)}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
