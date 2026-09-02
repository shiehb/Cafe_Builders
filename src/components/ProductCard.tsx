import React from "react";
import { Plus, Flame, Sparkles, Snowflake, Sun } from "lucide-react";
import { Product } from "../types";
import { formatPHP } from "../lib/utils";

interface ProductCardProps {
  product: Product;
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelectProduct,
  onQuickAdd,
}) => {
  return (
    <div
      onClick={() => onSelectProduct(product)}
      className="group relative flex flex-col bg-white rounded-2xl border border-stone-200/80 shadow-2xs hover:shadow-md hover:border-amber-700/30 transition-all duration-300 overflow-hidden cursor-pointer"
    >
      {/* Product Image Frame */}
      <div className="relative aspect-4/3 w-full bg-stone-100 overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Overlay Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {product.popular && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-700 text-white text-[10px] font-bold tracking-wide shadow-xs">
              <Flame className="h-3 w-3" />
              Popular
            </span>
          )}
          {product.tags && product.tags[0] && !product.popular && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-medium tracking-wide">
              <Sparkles className="h-2.5 w-2.5" />
              {product.tags[0]}
            </span>
          )}
        </div>

        {/* Temperature Badges */}
        {product.temperatureOptions && product.temperatureOptions.length > 0 && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-md border border-stone-200/60 text-[10px] font-semibold text-stone-700 shadow-2xs">
            {product.temperatureOptions.includes("Hot") && (
              <Sun className="h-3 w-3 text-amber-600" />
            )}
            {product.temperatureOptions.includes("Iced") && (
              <Snowflake className="h-3 w-3 text-sky-600" />
            )}
            <span>{product.temperatureOptions.join("/")}</span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-base text-stone-900 group-hover:text-amber-800 transition-colors leading-snug">
              {product.name}
            </h3>
          </div>
          <p className="mt-1.5 text-xs text-stone-500 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Footer: Price & Quick Action */}
        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400 block">
              Price
            </span>
            <span className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight font-display">
              {formatPHP(product.price)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (product.temperatureOptions || product.milkOptionsAvailable) {
                  onSelectProduct(product);
                } else {
                  onQuickAdd(product);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-amber-800 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{product.temperatureOptions ? "Customize" : "Add"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
