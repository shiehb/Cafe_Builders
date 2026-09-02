import React, { useState } from "react";
import { Plus, Heart, Zap } from "lucide-react";
import { Product } from "../types";
import { formatPrice } from "../lib/utils";

interface MostPopularCarouselProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
  onViewAll?: () => void;
}

export const MostPopularCarousel: React.FC<MostPopularCarouselProps> = ({
  products,
  onSelectProduct,
  onQuickAdd,
}) => {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFavorite = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const popularItems = products.filter((p) => p.popular || p.topPick);

  if (popularItems.length === 0) return null;

  return (
    <section className="w-full">
      {/* Header Row */}
      <div className="flex items-center justify-between px-4 sm:px-0 mb-3">
        <h2 className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight">
          Most Popular
        </h2>
      </div>

      {/* Horizontal Carousel */}
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 px-4 sm:px-0 snap-x snap-mandatory">
        {popularItems.map((product) => {
          const isFav = favorites[product.id];

          return (
            <div
              key={product.id}
              onClick={() => onSelectProduct(product)}
              className="flex-none w-[220px] sm:w-[240px] snap-start bg-white rounded-2xl border border-stone-200/70 shadow-xs hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between group"
            >
              {/* Rounded Image Container */}
              <div className="relative aspect-4/3 w-full bg-stone-100 overflow-hidden">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />

                {/* Top-Left: Top Pick Orange Badge */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-bold shadow-xs tracking-wide">
                    <Zap className="h-3 w-3 fill-current" />
                    Top Pick
                  </span>
                </div>

                {/* Top-Right: Floating Favorite Heart Button */}
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(product.id, e)}
                  aria-label="Favorite item"
                  className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-stone-600 hover:text-rose-500 transition-all shadow-xs active:scale-90 cursor-pointer"
                >
                  <Heart
                    className={`h-4 w-4 transition-colors ${
                      isFav ? "fill-rose-500 text-rose-500" : "text-stone-700"
                    }`}
                  />
                </button>

                {/* Bottom-Left: House Special Tag */}
                {product.houseSpecial && (
                  <div className="absolute bottom-2.5 left-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-semibold tracking-wide">
                      House Special
                    </span>
                  </div>
                )}
              </div>

              {/* Content Area */}
              <div className="p-3.5 flex flex-col flex-1 justify-between">
                <div>
                  <h3 className="font-bold text-sm text-stone-900 group-hover:text-[#00A86B] transition-colors line-clamp-1">
                    {product.name}
                  </h3>
                  <p className="mt-1 text-xs text-stone-500 line-clamp-1 leading-relaxed">
                    {product.description}
                  </p>
                </div>

                {/* Price & Solid Green Circular + Action Button */}
                <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-extrabold text-stone-900 tracking-tight">
                      Price {formatPrice(product.price)}
                    </span>
                    {product.originalPrice && (
                      <span className="text-xs text-stone-400 line-through">
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
                    className="h-8 w-8 rounded-full bg-[#00A86B] hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center shadow-xs transition-transform cursor-pointer"
                  >
                    <Plus className="h-4 w-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
