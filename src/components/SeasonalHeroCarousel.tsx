import React, { useState, useEffect } from "react";
import { Product } from "../types";

interface SeasonalHeroCarouselProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

interface SeasonalBanner {
  id: string;
  imageUrl: string;
  product?: Product;
}

export const SeasonalHeroCarousel: React.FC<SeasonalHeroCarouselProps> = ({
  products,
  onSelectProduct,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const yuenyeung = products.find((p) => p.id === "prod_yuenyeung");
  const matcha = products.find((p) => p.id === "prod_matcha_latte" || p.id === "prod_emerald_mint" || p.id === "prod_pure_uji_matcha");
  const croissant = products.find((p) => p.id === "prod_croissant" || p.id === "prod_butter_croissant" || p.id === "prod_pistachio_croissant");

  const seasonalItems: SeasonalBanner[] = [
    {
      id: "season_1",
      imageUrl: "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=1200&auto=format&fit=crop",
      product: yuenyeung || products[0],
    },
    {
      id: "season_2",
      imageUrl: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?q=80&w=1200&auto=format&fit=crop",
      product: matcha || products[1],
    },
    {
      id: "season_3",
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
    <section className="w-full pt-0 p-0">
      {/* 4:3 Landscape Aspect Ratio Hero Image Container without rounded corners */}
      <div
        onClick={() => {
          if (currentSlide.product) {
            onSelectProduct(currentSlide.product);
          }
        }}
        className="relative w-full aspect-[4/3] rounded-none overflow-hidden shadow-card bg-stone-900 cursor-pointer group select-none"
      >
        <img
          src={currentSlide.imageUrl}
          alt="Seasonal Promotion"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
        />
      </div>
    </section>
  );
};