import React, { useEffect, useRef } from "react";
import { X, ChevronLeft } from "lucide-react";
import { cn } from "../../lib/utils";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  maxHeight?: "normal" | "tall" | "full";
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  className?: string;
  showCloseButton?: boolean;
  navButtonType?: "back" | "close";
  headerRight?: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxHeight = "full",
  maxWidth = "lg",
  className,
  showCloseButton = true,
  navButtonType = "back",
  headerRight,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (touchCurrentY.current - touchStartY.current > 70) {
      // Swiped down significantly
      onClose();
    }
    touchStartY.current = 0;
    touchCurrentY.current = 0;
  };

  if (!isOpen) return null;

  const maxWidths = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
    "3xl": "sm:max-w-3xl",
  };

  const maxHeights = {
    normal: "h-[85vh] sm:h-[88vh]",
    tall: "h-[92vh] sm:h-[90vh]",
    full: "h-full sm:h-[95vh] max-h-screen",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Bottom Sheet Card / Full-Page Dialog */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "relative z-10 w-full bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl transition-all border border-stone-200/80 flex flex-col",
          "animate-in slide-in-from-bottom duration-300 ease-out",
          maxWidths[maxWidth],
          maxHeights[maxHeight],
          className
        )}
      >
        {/* Swipe Pull Handle (Mobile Touch Indicator) */}
        <div className="pt-2.5 pb-1 flex flex-col items-center justify-center shrink-0 cursor-grab active:cursor-grabbing select-none sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-stone-300 hover:bg-stone-400 transition-colors" />
        </div>

        {/* Sheet Header with Single Top-Left Navigation Control */}
        {(title || description || showCloseButton) && (
          <div className="px-4 sm:px-6 py-3 border-b border-stone-100 flex items-center justify-between shrink-0 gap-3">
            {/* Top-Left Single Navigation Control */}
            {showCloseButton ? (
              <div className="shrink-0 flex items-center justify-start min-w-[36px]">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 w-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors active:scale-95 cursor-pointer shadow-2xs"
                  title={navButtonType === "close" ? "Close" : "Go Back"}
                  aria-label={navButtonType === "close" ? "Close" : "Go Back"}
                >
                  {navButtonType === "close" ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-5 w-5" />
                  )}
                </button>
              </div>
            ) : (
              <div className="min-w-[36px]" />
            )}

            {/* Title / Description nicely centered */}
            <div className="min-w-0 flex-1 text-center px-2">
              {title && (
                <div className="text-base sm:text-lg font-bold tracking-tight text-stone-900 font-display truncate">
                  {title}
                </div>
              )}
              {description && (
                <p className="text-[11px] text-stone-500 truncate mt-0.5">{description}</p>
              )}
            </div>

            {/* Top-Right Action Controls or balanced spacer */}
            <div className="shrink-0 flex items-center justify-end min-w-[36px]">
              {headerRight || <div className="w-9" />}
            </div>
          </div>
        )}

        {/* Sheet Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 overscroll-contain no-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};
