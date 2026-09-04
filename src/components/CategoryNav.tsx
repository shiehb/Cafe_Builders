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
      {/* Horizontal scrolling pill tags - No padding here, parent handles it */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {categories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] leading-[18px] font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer select-none shrink-0",
                isSelected
                  ? "bg-[#00A86B] text-white shadow-xs font-bold"
                  : "bg-white text-[#1F2937] border border-[#E5E7EB] hover:bg-[#F7F9FA]"
              )}
            >
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};