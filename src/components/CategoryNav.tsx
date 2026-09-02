import React from "react";
import { Category } from "../types";
import { cn } from "../lib/utils";

interface CategoryNavProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
}) => {
  return (
    <div className="w-full">
      {/* Horizontal scrolling pill buttons with icons */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-4 sm:px-0">
        {categories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer select-none",
                isSelected
                  ? "bg-[#00A86B] text-white shadow-sm shadow-emerald-500/20 scale-[1.02]"
                  : "bg-white text-stone-700 border border-stone-200/80 hover:bg-stone-50 hover:border-stone-300"
              )}
            >
              {cat.iconEmoji && <span className="text-sm">{cat.iconEmoji}</span>}
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
