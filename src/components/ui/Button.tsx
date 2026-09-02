import React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "amber";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none rounded-xl cursor-pointer";

    const variants = {
      primary:
        "bg-stone-900 text-stone-50 hover:bg-stone-800 active:scale-[0.98] shadow-sm focus-visible:ring-stone-900",
      amber:
        "bg-amber-600 text-white hover:bg-amber-700 active:scale-[0.98] shadow-sm focus-visible:ring-amber-600",
      secondary:
        "bg-stone-100 text-stone-900 hover:bg-stone-200 active:scale-[0.98] focus-visible:ring-stone-300",
      outline:
        "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 active:scale-[0.98] shadow-2xs focus-visible:ring-stone-400",
      ghost:
        "text-stone-700 hover:bg-stone-100 active:scale-[0.98] focus-visible:ring-stone-300",
      danger:
        "bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.98] shadow-sm focus-visible:ring-rose-500",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
      icon: "h-10 w-10 p-0 text-sm",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin text-current"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Processing...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
