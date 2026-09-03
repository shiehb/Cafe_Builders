import React, { useState, useEffect } from "react";
import { Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { Product } from "../types";
import { formatPrice } from "../lib/utils";

interface SeasonalHeroCarouselProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

interface SeasonalBanner {
  id: string;
  badge: string;
  title: string;
  tagline: string;
  price: number;
  imageUrl: string;
  product?: Product;
}

export const SeasonalHeroCarousel: React.FC<SeasonalHeroCarouselProps> = ({
  products,
  onSelectProduct,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  // Link to existing products where possible
  const yuenyeung = products.find((p) => p.id === "prod_yuenyeung");
  const matcha = products.find((p) => p.id === "prod_matcha_latte");
  const croissant = products.find((p) => p.id === "prod_croissant");

  const seasonalItems: SeasonalBanner[] = [
    {
      id: "season_1",
      badge: "New Seasonal Special",
      title: "Yuenyeung Coffee Tea",
      tagline: "Hong Kong style bold Ceylon black tea & rich espresso",
      price: yuenyeung?.price || 6.20,
      imageUrl: "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=1200&auto=format&fit=crop",
      product: yuenyeung || products[0],
    },
    {
      id: "season_2",
      badge: "Limited Spring Drop",
      title: "Uji Ceremonial Matcha",
      tagline: "Stone-ground Kyoto green tea topped with silky oat milk",
      price: matcha?.price || 5.80,
      imageUrl: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?q=80&w=1200&auto=format&fit=crop",
      product: matcha || products[1],
    },
    {
      id: "season_3",
      badge: "Artisan Bakery",
      title: "Golden Butter Croissant",
      tagline: "Baked fresh daily with imported French Normandy butter",
      price: croissant?.price || 3.95,
      imageUrl: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=1200&auto=format&fit=crop",
      product: croissant || products[2],
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % seasonalItems.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [seasonalItems.length]);

  const currentSlide = seasonalItems[activeIndex];

  return (
    <section className="w-full px-4 sm:px-0">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-base font-bold text-[#1F2937] flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[#00A86B]" />
          <span>New & Seasonal Products</span>
        </h2>
        <span className="text-[10px] font-medium text-[#6B7280]">
          {activeIndex + 1} of {seasonalItems.length}
        </span>
      </div>

      {/* Hero Banner Card */}
      <div
        onClick={() => {
          if (currentSlide.product) {
            onSelectProduct(currentSlide.product);
          }
        }}
        className="relative w-full rounded-2xl overflow-hidden shadow-card bg-stone-900 cursor-pointer group select-none aspect-21/9 sm:aspect-24/9"
      >
        <img
          src={currentSlide.imageUrl}
          alt={currentSlide.title}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex flex-col justify-end p-4 sm:p-5 text-white">
          {/* Top Badge */}
          <div className="mb-1.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FEF3C7] text-[#92400E] text-[10px] font-medium shadow-xs">
              <Sparkles className="h-2.5 w-2.5" />
              {currentSlide.badge}
            </span>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug truncate">
                {currentSlide.title}
              </h3>
              <p className="text-xs text-stone-200/90 line-clamp-1 mt-0.5">
                {currentSlide.tagline}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <span className="text-[10px] uppercase text-stone-300 block font-medium">
                  Starting at
                </span>
                <span className="text-sm sm:text-base font-bold text-[#00A86B] bg-white px-2 py-0.5 rounded-lg">
                  {formatPrice(currentSlide.price)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Prev/Next subtle controls */}
        <button
          type="button"
          aria-label="Previous Slide"
          onClick={(e) => {
            e.stopPropagation();
            setActiveIndex((prev) => (prev === 0 ? seasonalItems.length - 1 : prev - 1));
          }}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/40 backdrop-blur-xs text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/70 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          aria-label="Next Slide"
          onClick={(e) => {
            e.stopPropagation();
            setActiveIndex((prev) => (prev + 1) % seasonalItems.length);
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/40 backdrop-blur-xs text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/70 cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Indicator Dots */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
          {seasonalItems.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(i);
              }}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeIndex === i ? "w-5 bg-[#00A86B]" : "w-1.5 bg-white/60 hover:bg-white"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
