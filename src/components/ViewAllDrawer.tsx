import React, { useState } from "react";
import { ChevronLeft, X, Plus, Heart, Star, Zap, Search } from "lucide-react";
import { Product } from "../types";
import { formatPrice } from "../lib/utils";

interface ViewAllDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
}

export const ViewAllDrawer: React.FC<ViewAllDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  products,
  onSelectProduct,
  onQuickAdd,
}) => {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (!isOpen) return null;

  const toggleFavorite = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const filtered = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.categoryName.toLowerCase().includes(q) ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Full-Page Drawer Container */}
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-full sm:h-[95vh] max-h-screen overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Top Drag Handle Indicator */}
        <div className="w-full flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-12 h-1.5 bg-stone-300 rounded-full" />
        </div>

        {/* Top Header with Single Back Button on Top-Left */}
        <div className="px-4 sm:px-6 py-3 border-b border-stone-200/80 bg-white/95 backdrop-blur-md flex items-center justify-between shrink-0 gap-3">
          {/* Top-Left Single Navigation Control */}
          <div className="shrink-0 flex items-center justify-start min-w-[36px]">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back to Menu"
              title="Back to Menu"
              className="h-9 w-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors active:scale-95 cursor-pointer shadow-2xs"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>

          {/* Centered Header Title */}
          <div className="min-w-0 text-center flex-1 px-2">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-stone-900 truncate font-display">
                {title}
              </h2>
              <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full shrink-0">
                {products.length}
              </span>
            </div>
            {subtitle && (
              <p className="text-[11px] text-stone-400 truncate mt-0.5">{subtitle}</p>
            )}
          </div>

          {/* Top-Right balanced element */}
          <div className="shrink-0 flex items-center justify-end min-w-[36px]">
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60 hidden sm:inline-block">
              2-Col Grid
            </span>
            <div className="w-9 sm:hidden" />
          </div>
        </div>

        {/* Search filter within Full-Page Drawer */}
        <div className="px-4 sm:px-6 py-2.5 bg-stone-50/80 border-b border-stone-200/60 shrink-0">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search in ${title.toLowerCase()}...`}
              className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-8 py-2 text-xs text-stone-900 placeholder:text-stone-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#00A86B] focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Drawer Body: 2-Column Card Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-stone-500">
              <p className="text-sm font-semibold">No items match your search</p>
              <p className="text-xs text-stone-400 mt-1">Try a different keyword</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 pb-8">
              {filtered.map((product) => {
                const isFav = favorites[product.id];
                const rating = product.rating || 4.9;
                const prepTime = product.prepTimeMinutes || 4;

                return (
                  <div
                    key={product.id}
                    onClick={() => onSelectProduct(product)}
                    className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between group"
                  >
                    {/* Product Top Image Container */}
                    <div className="relative aspect-4/3 w-full bg-stone-100 overflow-hidden">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />

                      {/* Top-Left: Badge */}
                      {(product.popular || product.topPick) && (
                        <div className="absolute top-2 left-2">
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold shadow-xs">
                            <Zap className="h-2.5 w-2.5 fill-current" />
                            Top Pick
                          </span>
                        </div>
                      )}

                      {/* Top-Right: Favorite Heart Button */}
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(product.id, e)}
                        aria-label="Favorite item"
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-stone-600 hover:text-rose-500 transition-all shadow-xs active:scale-90 cursor-pointer"
                      >
                        <Heart
                          className={`h-3.5 w-3.5 transition-colors ${
                            isFav ? "fill-rose-500 text-rose-500" : "text-stone-700"
                          }`}
                        />
                      </button>

                      {/* Bottom-Left: House Special tag */}
                      {product.houseSpecial && (
                        <div className="absolute bottom-2 left-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-white text-[9px] font-medium">
                            House Special
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="p-3 sm:p-3.5 flex flex-col flex-1 justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-xs sm:text-sm text-stone-900 group-hover:text-[#00A86B] transition-colors line-clamp-1 leading-snug">
                          {product.name}
                        </h3>

                        {/* Rating & Prep Time */}
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-stone-500">
                          <div className="flex items-center gap-0.5 text-amber-500 font-semibold">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span>{rating.toFixed(1)}</span>
                          </div>
                          <span className="text-stone-300">·</span>
                          <span>{prepTime} min</span>
                        </div>
                      </div>

                      {/* Price & Action Button */}
                      <div className="flex items-center justify-between pt-1 border-t border-stone-100 mt-1">
                        <div>
                          <span className="text-xs sm:text-sm font-extrabold text-stone-900 font-display tracking-tight">
                            {formatPrice(product.price)}
                          </span>
                          {product.originalPrice && (
                            <span className="text-[10px] text-stone-400 line-through block font-medium">
                              {formatPrice(product.originalPrice)}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              product.temperatureOptions ||
                              product.sweetnessAdjustable ||
                              product.milkOptionsAvailable
                            ) {
                              onSelectProduct(product);
                            } else {
                              onQuickAdd(product);
                            }
                          }}
                          aria-label={`Add ${product.name}`}
                          className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-[#00A86B] hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center shadow-xs transition-transform cursor-pointer"
                        >
                          <Plus className="h-4 w-4 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
