import React, { useState, useEffect } from "react";
import { ChefHat, CreditCard, LayoutDashboard, ShoppingBag, Lock, Volume2, VolumeX, Radio, Sparkles, Coffee } from "lucide-react";
import { navigate } from "../../lib/router";
import { lockStaffSession } from "./StaffGuard";

export interface StaffLayoutProps {
  activeTab: "kds" | "pos" | "admin";
  title: string;
  subtitle?: string;
  pinEnvKey: "KDS_PIN" | "POS_PIN" | "ADMIN_PIN" | string;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  activeOrderCount?: number;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export const StaffLayout: React.FC<StaffLayoutProps> = ({
  activeTab,
  title,
  subtitle,
  pinEnvKey,
  soundEnabled = true,
  onToggleSound,
  activeOrderCount = 0,
  headerRight,
  children,
}) => {
  const [livePulse, setLivePulse] = useState<boolean>(true);

  const handleLock = () => {
    lockStaffSession(pinEnvKey);
    // Reload page to trigger StaffGuard lock screen
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#F7F9FA] text-[#1F2937] flex flex-col font-sans">
      {/* Staff Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-3">
          {/* Brand & Terminal Info */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#00A86B] flex items-center justify-center text-white shadow-xs font-bold text-base shrink-0">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base tracking-tight text-[#1F2937]">
                  Artisan Staff Hub
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E6F6F0] border border-emerald-200 text-[#008F5B] text-[10px] font-mono font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280] truncate hidden md:block">
                {subtitle || "Operational KDS, POS, and Store Management"}
              </p>
            </div>
          </div>

          {/* Center: Quick Navigation Tabs */}
          <nav className="flex items-center bg-[#F7F9FA] p-1 rounded-xl border border-[#E5E7EB]">
            <button
              type="button"
              onClick={() => navigate("/kds")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "kds"
                  ? "bg-[#00A86B] text-white shadow-xs"
                  : "text-[#6B7280] hover:text-[#1F2937] hover:bg-white"
              }`}
            >
              <ChefHat className="h-3.5 w-3.5" />
              <span>KDS</span>
              {activeOrderCount > 0 && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-black ${
                    activeTab === "kds" ? "bg-black/30 text-white" : "bg-emerald-500/20 text-emerald-400"
                  }`}
                >
                  {activeOrderCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate("/pos")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "pos"
                  ? "bg-[#00A86B] text-white shadow-xs"
                  : "text-[#6B7280] hover:text-[#1F2937] hover:bg-white"
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>POS</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/admin")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "admin"
                  ? "bg-[#00A86B] text-white shadow-xs"
                  : "text-[#6B7280] hover:text-[#1F2937] hover:bg-white"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Admin</span>
            </button>
          </nav>

          {/* Right: Sound toggle, Storefront Link, Lock */}
          <div className="flex items-center gap-2">
            {headerRight}

            {onToggleSound && (
              <button
                type="button"
                onClick={onToggleSound}
                className={`p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  soundEnabled
                    ? "bg-white text-[#1F2937] border-[#E5E7EB] hover:bg-[#F7F9FA]"
                    : "bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#F7F9FA]"
                }`}
                title={soundEnabled ? "Mute chimes" : "Enable order chimes"}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4" />}
              </button>
            )}

            {/* Switch to Public Customer View */}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-[#F7F9FA] border border-[#E5E7EB] text-[#6B7280] hover:text-[#1F2937] text-xs font-semibold transition-all cursor-pointer"
              title="Return to Customer Storefront"
            >
              <ShoppingBag className="h-3.5 w-3.5 text-stone-400" />
              <span className="hidden sm:inline">Storefront</span>
            </button>

            {/* Lock / Sign Out */}
            <button
              type="button"
              onClick={handleLock}
              className="p-2 rounded-xl bg-stone-900 hover:bg-rose-950/40 text-stone-400 hover:text-rose-400 border border-stone-800 hover:border-rose-900/50 transition-all cursor-pointer"
              title="Lock Terminal (Clear Session)"
            >
              <Lock className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col">{children}</main>
    </div>
  );
};
