import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ToastProps {
  id?: string;
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
}

export const ToastNotification: React.FC<ToastProps> = ({
  message,
  type = "success",
  onClose,
  duration = 3500,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div
        className={cn(
          "px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-bold border backdrop-blur-md max-w-sm",
          type === "success"
            ? "bg-emerald-950/95 text-emerald-200 border-emerald-800/80 shadow-emerald-950/40"
            : type === "error"
            ? "bg-rose-950/95 text-rose-200 border-rose-800/80 shadow-rose-950/40"
            : "bg-stone-900/95 text-stone-200 border-stone-800 shadow-black/40"
        )}
      >
        {type === "success" ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        ) : type === "error" ? (
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
        ) : (
          <Info className="h-4 w-4 text-sky-400 shrink-0" />
        )}
        <span className="flex-1 leading-snug">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-stone-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
