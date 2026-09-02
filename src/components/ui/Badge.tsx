import React from "react";
import { cn } from "../../lib/utils";
import { OrderStatus } from "../../types";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "info" | "amber";
  status?: OrderStatus;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  status,
  children,
  ...props
}) => {
  let computedVariant = variant;
  let label = children;

  if (status) {
    switch (status) {
      case "PENDING_PAYMENT":
        computedVariant = "warning";
        label = label || "Pending Payment";
        break;
      case "PAID":
        computedVariant = "info";
        label = label || "Paid";
        break;
      case "PREPARING":
        computedVariant = "amber";
        label = label || "Brewing / Preparing";
        break;
      case "READY":
        computedVariant = "success";
        label = label || "Ready for Pickup";
        break;
      case "COMPLETED":
        computedVariant = "secondary";
        label = label || "Completed";
        break;
    }
  }

  const variants = {
    default: "bg-stone-900 text-stone-100 border-stone-800",
    secondary: "bg-stone-100 text-stone-700 border-stone-200",
    outline: "bg-transparent text-stone-700 border-stone-300",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
    amber: "bg-amber-100 text-amber-900 border-amber-300",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors",
        variants[computedVariant],
        className
      )}
      {...props}
    >
      {status === "PREPARING" && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
      )}
      {status === "READY" && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      )}
      {label}
    </span>
  );
};
