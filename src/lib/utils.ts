import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return `₱${safeAmount.toFixed(2)}`;
}

export function formatPHP(amount: number): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return `₱${safeAmount.toFixed(2)}`;
}

export function formatDateTime(dateInput: string | Date | number): string {
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
