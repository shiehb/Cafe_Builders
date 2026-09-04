import React, { useState, useRef, useEffect } from "react";
import { Coffee, Search, X } from "lucide-react";
import { cn } from "../lib/utils";

interface NavbarProps {
  onOpenCart?: () => void;
  onOpenReceipts?: () => void;
  onOpenKds?: () => void;
  cartCount?: number;
  cartTotal?: number;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  isCategoryStuck?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery = "",
  onSearchChange,
  isCategoryStuck = false,
}) => {
  const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-white/95 backdrop-blur-md transition-all duration-150 safe-top",
        isCategoryStuck
          ? "border-b border-transparent shadow-none"
          : "border-b border-[#E5E7EB] shadow-xs"
      )}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Left: Brand Logo + Name ("Artisan Brew & Kitchen") */}
        <div
          className={`flex items-center gap-2.5 shrink-0 transition-opacity duration-200 ${
            isSearchExpanded ? "hidden xs:flex" : "flex"
          }`}
        >
          <div className="h-8 w-8 rounded-full bg-[#00A86B] flex items-center justify-center text-white shadow-xs font-bold text-sm">
            <Coffee className="h-4 w-4" />
          </div>
          <span className="font-bold text-[16px] leading-[24px] tracking-tight text-[#1F2937]">
            Artisan Brew & Kitchen
          </span>
        </div>

        {/* Right: Search Icon that expands horizontally into an active search input field when clicked */}
        <div className="flex items-center gap-2 justify-end flex-1">
          {isSearchExpanded ? (
            <div className="flex items-center gap-2 w-full max-w-md animate-in fade-in slide-in-from-right-3 duration-200">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder="Search coffee, pastries, pasta..."
                  className="w-full bg-[#F7F9FA] border border-[#E5E7EB] rounded-full pl-9 pr-8 py-2 text-[12px] leading-[18px] text-[#1F2937] placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#00A86B] focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange?.("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center text-[10px] hover:bg-stone-300 transition-colors cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSearchExpanded(false);
                  onSearchChange?.("");
                }}
                aria-label="Close search"
                className="h-8 w-8 rounded-full bg-stone-100 hover:bg-stone-200 text-[#6B7280] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSearchExpanded(true)}
              aria-label="Search Menu"
              title="Search Menu"
              className="h-9 w-9 rounded-full bg-[#F7F9FA] hover:bg-stone-100 border border-[#E5E7EB] text-[#1F2937] flex items-center justify-center transition-colors cursor-pointer"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};