import React, { useState } from "react";
import { Plus, Heart, Zap } from "lucide-react";
import { Product } from "../types";
import { formatPrice } from "../lib/utils";

interface MostPopularCarouselProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
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
      <div className="flex items-center justify-between mb-2.5 px-4 sm:px-0">
        <h2 className="text-[16px] font-bold text-[#1F2937] leading-[24px]">
          Popular
        </h2>
      </div>

      {/* Horizontal Carousel - with spacer for right padding */}
      <div 
        className="overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory scroll-smooth"
        style={{
          scrollPaddingLeft: '16px',
          scrollPaddingRight: '16px',
        }}
      >
        {/* Remove paddingRight from this container since we're using a spacer */}
        <div className="flex gap-3.5" style={{ paddingLeft: '16px', paddingRight: '0px' }}>
          {popularItems.map((product) => {
            const isFav = favorites[product.id];

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="flex-none w-[200px] sm:w-[220px] snap-start bg-white rounded-2xl border border-[#E5E7EB] shadow-card hover:border-emerald-300 transition-all duration-200 overflow-hidden cursor-pointer flex flex-col justify-between group"
                style={{
                  scrollSnapMargin: '0px',
                }}
              >
                {/* Image Container */}
                <div className="relative aspect-4/3 w-full bg-stone-100 overflow-hidden">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Top-Left: Top Pick Amber Badge */}
                  <div className="absolute top-2 left-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FEF3C7] text-[#92400E] text-[10px] font-medium shadow-xs">
                      <Zap className="h-3 w-3 fill-current" />
                      Top Pick
                    </span>
                  </div>

                  {/* Top-Right: Favorite Button */}
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(product.id, e)}
                    aria-label="Favorite item"
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-[#6B7280] hover:text-rose-500 transition-all shadow-xs active:scale-90 cursor-pointer"
                  >
                    <Heart
                      className={`h-3.5 w-3.5 transition-colors ${
                        isFav ? "fill-rose-500 text-rose-500" : "text-[#6B7280]"
                      }`}
                    />
                  </button>
                </div>

                {/* Content Area */}
                <div className="p-3 flex flex-col flex-1 justify-between">
                  <div>
                    <h3 className="font-semibold text-[14px] leading-[20px] text-[#1F2937] group-hover:text-[#00A86B] transition-colors line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="mt-0.5 text-[12px] leading-[18px] text-[#6B7280] line-clamp-1">
                      {product.description}
                    </p>
                  </div>

                  {/* Price & Quick Add Button */}
                  <div className="mt-2.5 pt-2 border-t border-[#E5E7EB] flex items-center justify-between">
                    <span className="text-[14px] font-bold text-[#1F2937]">
                      {formatPrice(product.price)}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          product.sweetnessAdjustable ||
                          product.milkOptionsAvailable
                        ) {
                          onSelectProduct(product);
                        } else {
                          onQuickAdd(product);
                        }
                      }}
                      aria-label={`Add ${product.name}`}
                      className="h-8 w-8 rounded-full bg-[#00A86B] hover:bg-[#008F5B] active:scale-95 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="h-4 w-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Spacer for right padding - now matches the left padding (16px) */}
          <div className="flex-none w-4 sm:w-0" />
        </div>
      </div>
    </section>
  );
};