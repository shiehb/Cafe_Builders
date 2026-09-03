import React, { useState, useEffect } from "react";
import { ArrowLeft, Check, Minus, Plus, AlertCircle } from "lucide-react";
import { ItemCustomization } from "../types";
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

interface EditCartItemPageProps {
  cartItemId: string;
}

export const EditCartItemPage: React.FC<EditCartItemPageProps> = ({ cartItemId }) => {
  const { cart, updateCartItem } = useCart();

  const normalizedSearchId = decodeURIComponent(cartItemId || "").trim().toLowerCase();
  const cartItem =
    cart.find((i) => {
      if (i.id === cartItemId) return true;
      if (decodeURIComponent(i.id) === decodeURIComponent(cartItemId)) return true;
      if (i.id.toLowerCase() === normalizedSearchId) return true;
      if (decodeURIComponent(i.id).toLowerCase() === normalizedSearchId) return true;
      return false;
    }) ||
    (cart.length === 1 ? cart[0] : cart.find((i) => i.productId === cartItemId || i.productId === normalizedSearchId));

  const product = cartItem?.product;

  // Customization States
  const [quantity, setQuantity] = useState<number>(cartItem?.quantity || 1);
  const [temperature, setTemperature] = useState<"Hot" | "Iced">(() => {
    if (cartItem?.customizations?.iceLevel) return "Iced";
    if (
      product?.temperatureOptions?.includes("Hot") &&
      !product?.temperatureOptions?.includes("Iced")
    ) {
      return "Hot";
    }
    return "Iced";
  });

  const [iceLevel, setIceLevel] = useState<"Regular Ice" | "Less Ice" | "No Ice" | "Extra Ice">(() => {
    return (cartItem?.customizations?.iceLevel as any) || "Less Ice";
  });

  const [sweetness, setSweetness] = useState<
    "Regular Sweetness" | "Less Sweet" | "Light Sweet" | "No Sugar"
  >(() => {
    return (cartItem?.customizations?.sweetness as any) || "Regular Sweetness";
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
    return ADDON_OPTIONS.filter((opt) =>
      cartItem.customizations.addOns?.some((str) => str.startsWith(opt.label))
    );
  });

  const [specialInstructions, setSpecialInstructions] = useState<string>(
    cartItem?.customizations?.specialInstructions || ""
  );

  // Sync if cartItem changes
  useEffect(() => {
    if (cartItem) {
      setQuantity(cartItem.quantity);
      if (cartItem.customizations?.iceLevel) {
        setTemperature("Iced");
        setIceLevel(cartItem.customizations.iceLevel as any);
      }
      if (cartItem.customizations?.sweetness) {
        setSweetness(cartItem.customizations.sweetness as any);
      }
      if (cartItem.customizations?.milkOption) {
        const found = MILK_OPTIONS.find((m) => m.label === cartItem.customizations.milkOption);
        if (found) setSelectedMilk(found);
      }
      if (cartItem.customizations?.addOns) {
        setSelectedAddons(
          ADDON_OPTIONS.filter((opt) =>
            cartItem.customizations.addOns?.some((str) => str.startsWith(opt.label))
          )
        );
      }
      setSpecialInstructions(cartItem.customizations?.specialInstructions || "");
    }
  }, [cartItem]);

  if (!cartItem || !product) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans">
        <AlertCircle className="h-12 w-12 text-[#6B7280]" />
        <div>
          <h2 className="text-[16px] font-semibold text-[#1F2937]">Item Not in Cart</h2>
          <p className="text-[12px] text-[#6B7280] mt-1">
            This item may have been removed or already modified.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/cart")}
          className="px-4 py-2 rounded-xl bg-[#00A86B] text-white text-[12px] font-bold hover:bg-[#008F5B] transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Cart</span>
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
    (product.milkOptionsAvailable ? selectedMilk.price : 0) +
    selectedAddons.reduce((sum, a) => sum + a.price, 0);

  const unitPrice = product.price + extraPricePerItem;
  const lineTotal = unitPrice * quantity;

  const handleUpdate = () => {
    if (!cartItem) return;
    const updatedCustomizations: ItemCustomization = {
      iceLevel: temperature === "Iced" ? iceLevel : undefined,
      sweetness: product.sweetnessAdjustable ? sweetness : undefined,
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
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/cart")}
            aria-label="Back to Cart"
            title="Back to Cart"
            className="h-10 w-10 rounded-xl text-[#1F2937] hover:bg-[#F7F9FA] flex items-center justify-center transition-colors cursor-pointer -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <span className="font-semibold text-[14px] leading-[20px] text-[#1F2937]">
            Edit Cart Item
          </span>

          <div className="w-10" />
        </div>
      </header>

      {/* 2. MEDIA SECTION & DETAILS */}
      <main className="max-w-2xl w-full mx-auto px-4 py-4 space-y-4">
        {/* Media Card */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-card">
          <div className="relative aspect-video w-full bg-stone-100 overflow-hidden">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-[20px] font-semibold text-[#1F2937] leading-[28px]">
                  {product.name}
                </h1>
                <p className="text-[12px] text-[#6B7280] mt-0.5">
                  Modifying item in your active tray
                </p>
              </div>
              <span className="text-[16px] font-bold text-[#00A86B] shrink-0">
                {formatPrice(product.price)}
              </span>
            </div>

            {product.description && (
              <div className="pt-2 border-t border-[#E5E7EB]">
                <h2 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
                  About This Item
                </h2>
                <p className="text-[12px] text-[#6B7280] leading-[18px]">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Temperature - Hot vs Iced */}
          {product.temperatureOptions && product.temperatureOptions.length > 1 && (
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
                  Temperature
                </h2>
                <span className="text-[11px] font-bold text-[#00A86B] uppercase tracking-wider">
                  Required
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {(["Iced", "Hot"] as const).map((opt) => {
                  const isSelected = temperature === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setTemperature(opt)}
                      className={`h-11 rounded-xl border text-[13px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isSelected
                          ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold shadow-2xs"
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
          )}

          {/* Ice Level (if Iced) */}
          {temperature === "Iced" && (
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
                  Ice Preference
                </h2>
                <span className="text-[11px] font-bold text-[#00A86B] uppercase tracking-wider">
                  Select 1
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {ICE_LEVELS.map((opt) => {
                  const isSelected = iceLevel === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setIceLevel(opt)}
                      className={`h-11 px-3 rounded-xl border text-[12px] font-semibold transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold shadow-2xs"
                          : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F7F9FA]"
                      }`}
                    >
                      <span>{opt}</span>
                      {isSelected && <Check className="h-4 w-4 text-[#00A86B]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sweetness Level */}
          {product.sweetnessAdjustable && (
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
                  Sweetness Level
                </h2>
                <span className="text-[11px] font-bold text-[#00A86B] uppercase tracking-wider">
                  Select 1
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {SWEETNESS_CHOICES.map((opt) => {
                  const isSelected = sweetness === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSweetness(opt)}
                      className={`h-11 px-3 rounded-xl border text-[12px] font-semibold transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold shadow-2xs"
                          : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F7F9FA]"
                      }`}
                    >
                      <span>{opt}</span>
                      {isSelected && <Check className="h-4 w-4 text-[#00A86B]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Milk Options */}
          {product.milkOptionsAvailable && (
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
                  Milk Option
                </h2>
                <span className="text-[11px] font-bold text-[#00A86B] uppercase tracking-wider">
                  Select 1
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {MILK_OPTIONS.map((milk) => {
                  const isSelected = selectedMilk.label === milk.label;
                  return (
                    <button
                      key={milk.label}
                      type="button"
                      onClick={() => setSelectedMilk(milk)}
                      className={`p-3 rounded-xl border text-[12px] font-semibold transition-all flex items-center justify-between cursor-pointer text-left ${
                        isSelected
                          ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold shadow-2xs"
                          : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F7F9FA]"
                      }`}
                    >
                      <div>
                        <span className="block leading-tight">{milk.label}</span>
                        {milk.price > 0 && (
                          <span className="text-[11px] text-[#6B7280]">
                            +{formatPrice(milk.price)}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-[#00A86B] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB] shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#1F2937] leading-[20px]">
                Add-ons & Enhancements
              </h2>
              <span className="text-[11px] text-[#6B7280]">Optional</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ADDON_OPTIONS.map((addon) => {
                const isChecked = selectedAddons.some((a) => a.label === addon.label);
                return (
                  <button
                    key={addon.label}
                    type="button"
                    onClick={() => toggleAddon(addon)}
                    className={`p-3 rounded-xl border text-[12px] font-semibold transition-all flex items-center justify-between cursor-pointer ${
                      isChecked
                        ? "border-[#00A86B] bg-[#E6F6F0] text-[#00A86B] font-bold shadow-2xs"
                        : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F7F9FA]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-4 w-4 rounded-md border flex items-center justify-center ${
                          isChecked
                            ? "border-[#00A86B] bg-[#00A86B] text-white"
                            : "border-[#E5E7EB] bg-white"
                        }`}
                      >
                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span>{addon.label}</span>
                    </div>
                    <span className="text-[11px] text-[#6B7280]">
                      +{formatPrice(addon.price)}
                    </span>
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
              className="w-full p-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FA] text-[12px] text-[#1F2937] focus:bg-white focus:outline-none focus:border-[#00A86B] transition-all resize-none"
            />
          </div>
        </div>
      </main>

      {/* 3. STICKY BOTTOM BAR: Quantity Stepper & Update Cart Item button */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] p-3 sm:p-4 shadow-footer">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {/* Quantity Stepper */}
          <div className="flex items-center border border-[#E5E7EB] bg-[#F7F9FA] rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="h-9 w-9 rounded-lg flex items-center justify-center text-[#1F2937] hover:bg-white hover:shadow-xs transition-all cursor-pointer"
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
              className="h-9 w-9 rounded-lg flex items-center justify-center text-[#1F2937] hover:bg-white hover:shadow-xs transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Wide Button ("Update Cart Item • ₱...") */}
          <button
            type="button"
            onClick={handleUpdate}
            className="flex-1 h-11 rounded-xl bg-[#00A86B] hover:bg-[#008F5B] text-white font-bold text-[14px] leading-[20px] flex items-center justify-center shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
          >
            Update Cart Item • {formatPrice(lineTotal)}
          </button>
        </div>
      </div>
    </div>
  );
};
