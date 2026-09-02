import React, { useState } from "react";
import { Plus, Heart, Star, ChevronRight, LayoutGrid, List, Zap, Flame } from "lucide-react";
import { Product } from "../types";
import { formatPrice } from "../lib/utils";

interface SpecialtySectionProps {
  title?: string;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
  onFullView?: () => void;
  isGrid?: boolean;
  onToggleViewMode?: () => void;
}

export const SpecialtySection: React.FC<SpecialtySectionProps> = ({
  title = "Artisan Specialties",
  products,
  onSelectProduct,
  onQuickAdd,
  onFullView,
  isGrid = false,
  onToggleViewMode,
}) => {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFavorite = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-stone-200/60 my-4 mx-4 sm:mx-0">
        <p className="text-sm text-stone-500 font-medium">
          No items found matching your filter or search.
        </p>
      </div>
    );
  }

  return (
    <section className="w-full">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 sm:px-0 mb-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight">
            {title}
          </h2>
          <span className="text-xs font-semibold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
            {products.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout Toggle (2-Col Grid vs 1-Col List) */}
          {onToggleViewMode && (
            <div className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200/60">
              <button
                type="button"
                onClick={onToggleViewMode}
                aria-label="List View"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  !isGrid
                    ? "bg-white text-[#00A86B] shadow-2xs"
                    : "text-stone-400 hover:text-stone-700"
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onToggleViewMode}
                aria-label="2-Column Grid View"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isGrid
                    ? "bg-white text-[#00A86B] shadow-2xs"
                    : "text-stone-400 hover:text-stone-700"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {onFullView && (
            <button
              onClick={onFullView}
              className="inline-flex items-center gap-0.5 text-xs sm:text-sm font-bold text-[#00A86B] hover:text-emerald-700 transition-colors cursor-pointer"
            >
              <span>Full View</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2-COLUMN GRID VIEW */}
      {isGrid ? (
        <div className="grid grid-cols-2 gap-3 px-4 sm:px-0">
          {products.map((product) => {
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
      ) : (
        /* SINGLE VERTICAL LIST OF HORIZONTAL CARDS */
        <div className="flex flex-col gap-3 px-4 sm:px-0">
          {products.map((product) => {
            const isFav = favorites[product.id];
            const rating = product.rating || 4.9;
            const reviewCount = product.reviewCount || 120;
            const prepTime = product.prepTimeMinutes || 4;

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="bg-white rounded-2xl p-3 sm:p-3.5 border border-stone-200/70 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-3 sm:gap-4 cursor-pointer group"
              >
                {/* Left Column: Image Thumbnail with Heart Overlay */}
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 rounded-xl overflow-hidden bg-stone-100">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />

                  {/* Heart Icon Overlay */}
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(product.id, e)}
                    aria-label="Favorite"
                    className="absolute top-1.5 left-1.5 h-6 w-6 rounded-full bg-black/40 backdrop-blur-xs flex items-center justify-center text-white hover:text-rose-400 transition-all active:scale-90 cursor-pointer"
                  >
                    <Heart
                      className={`h-3.5 w-3.5 ${
                        isFav ? "fill-rose-500 text-rose-500" : "text-white"
                      }`}
                    />
                  </button>
                </div>

                {/* Middle Column: Bold Title, Rating & Prep Time, Large Bold Price */}
                <div className="flex-1 min-w-0 pr-1">
                  <h3 className="font-bold text-sm sm:text-base text-stone-900 group-hover:text-[#00A86B] transition-colors line-clamp-1">
                    {product.name}
                  </h3>

                  {/* Rating & Prep Time: ★ 4.9 (140) · 4 min */}
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-stone-500">
                    <div className="flex items-center gap-0.5 text-amber-500 font-semibold">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span>{rating.toFixed(1)}</span>
                    </div>
                    <span className="text-stone-400 font-normal">({reviewCount})</span>
                    <span className="text-stone-300">·</span>
                    <span className="text-stone-500 font-medium">{prepTime} min</span>
                  </div>

                  {/* Large Bold Price with Optional Strikethrough */}
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight">
                      {formatPrice(product.price)}
                    </span>
                    {product.originalPrice && (
                      <span className="text-xs sm:text-sm text-stone-400 line-through font-medium">
                        {formatPrice(product.originalPrice)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Side: Large Circular Dark Green "+" Action Button */}
                <div className="flex-shrink-0">
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
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-[#00A86B] hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center shadow-xs transition-transform cursor-pointer"
                  >
                    <Plus className="h-5 w-5 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
