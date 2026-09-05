import React, { useState, useEffect, useCallback } from "react";
import { Lock, ArrowLeft, Delete, RefreshCw, RotateCcw } from "lucide-react";
import { navigate } from "../../lib/router";
import { loginWithAdminPin, checkServerSession, logoutAdminSession } from "../../lib/auth";

export interface StaffGuardProps {
  pinEnvKey: "KDS_PIN" | "POS_PIN" | "ADMIN_PIN" | string;
  title: string;
  subtitle?: string;
  roleName?: string;
  children: React.ReactNode;
}

/**
 * Client-side gate for staff terminals.
 *
 * The ONLY source of truth for authentication is the server session
 * (HttpOnly admin_session cookie). This component never derives
 * authentication from local state: no sessionStorage tokens, no URL
 * parameters, and no client-side PIN comparison. All PIN verification goes
 * through the server's /api/auth/login endpoint.
 */
export const StaffGuard: React.FC<StaffGuardProps> = ({
  pinEnvKey,
  title,
  subtitle = "Enter 4-digit security PIN to access terminal",
  roleName = "Staff Terminal",
  children,
}) => {
  const role = pinEnvKey.replace("_PIN", "").toLowerCase();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  // Keep the SSR output and the first client render on the same placeholder.
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isCheckingInitial, setIsCheckingInitial] = useState<boolean>(true);

  const grantAccess = useCallback(() => {
    setIsAuthenticated(true);
    setErrorMsg(null);
  }, []);

  // Authoritative initial check: only the server session grants access.
  useEffect(() => {
    let isActive = true;

    setIsMounted(true);

    async function initCheck() {
      try {
        const session = await checkServerSession();
        if (session.authenticated && isActive) {
          setIsAuthenticated(true);
        }
      } catch {
        // No session authority available; remain locked.
      }

      if (isActive) {
        setIsCheckingInitial(false);
      }
    }

    initCheck();
    return () => {
      isActive = false;
    };
  }, []);

  // Verify the PIN with the server. There is no client-side fallback: a failed
  // server response keeps the terminal locked.
  const verifyPin = useCallback(
    async (entered: string) => {
      try {
        const res = await loginWithAdminPin(entered, role);
        if (res.success) {
          grantAccess();
          return;
        }
      } catch (e) {
        console.warn("Server PIN auth error:", e);
      }

      setIsShaking(true);
      setErrorMsg("Incorrect PIN. Please try again.");
      setTimeout(() => {
        setIsShaking(false);
        setPinInput("");
      }, 600);
    },
    [grantAccess, role]
  );

  // Auto-verify when 4 digits are reached
  const handleDigitPress = (digit: string) => {
    if (pinInput.length >= 4) return;
    const next = pinInput + digit;
    setPinInput(next);
    setErrorMsg(null);

    if (next.length === 4) {
      verifyPin(next);
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    setPinInput("");
    setErrorMsg(null);
  };

  // Keyboard navigation for physical POS/KDS terminals
  useEffect(() => {
    if (isAuthenticated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleDigitPress(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape") {
        handleClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthenticated, pinInput, handleDigitPress, handleBackspace, handleClear]);

  // Lock clears the server session cookie and returns to the PIN screen.
  const handleLock = () => {
    logoutAdminSession().catch(() => {});
    setPinInput("");
    setIsAuthenticated(false);
  };

  if (!isMounted || isCheckingInitial) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center text-stone-400">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-[#00A86B]" />
          <span className="text-sm font-medium">Checking terminal credentials...</span>
        </div>
      </div>
    );
  }

  // If authorized, render children
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Full-screen Clean 4-digit PIN Modal Guard
  return (
    <div className="min-h-screen w-full bg-radial from-stone-900 via-stone-950 to-black text-stone-100 flex flex-col items-center justify-center p-4 sm:p-6 select-none relative overflow-hidden">
      {/* Background ambient decorative shapes */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#00A86B]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar: Return to Customer App */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="Back to Customer Menu"
          title="Back to Customer Menu"
          className="h-10 w-10 rounded-xl bg-stone-900/80 hover:bg-stone-900 border border-stone-800 text-stone-300 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Terminal PIN Box */}
      <div className="w-full max-w-sm flex flex-col items-center space-y-6">
        {/* Terminal Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-stone-900 border border-stone-800 text-[#00A86B] shadow-xl shadow-black/40 mb-1">
            <Lock className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-[10px] font-mono tracking-widest text-[#00A86B] uppercase font-bold px-2 py-0.5 rounded-full bg-[#00A86B]/10 border border-[#00A86B]/20 inline-block mb-1">
              {roleName}
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">{title}</h1>
            <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">{subtitle}</p>
          </div>
        </div>

        {/* 4-Digit Indicator Circles */}
        <div
          className={`flex items-center justify-center gap-4 py-3 transition-transform ${
            isShaking ? "animate-shake" : ""
          }`}
        >
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pinInput.length > index;
            return (
              <div
                key={index}
                className={`h-5 w-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                  isFilled
                    ? "bg-[#00A86B] border-[#00A86B] scale-110 shadow-md shadow-[#00A86B]/40"
                    : "border-stone-700 bg-stone-900/80"
                }`}
              >
                {isFilled && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
            );
          })}
        </div>

        {/* Error Notification */}
        <div className="min-h-[22px] flex items-center justify-center text-center">
          {errorMsg ? (
            <div className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-semibold animate-in fade-in">
              <Lock className="h-3.5 w-3.5" />
              <span>{errorMsg}</span>
            </div>
          ) : (
            <span className="text-[11px] text-stone-500 font-mono">
              Use on-screen keypad or physical keyboard
            </span>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitPress(digit)}
              className="h-14 rounded-2xl bg-stone-900/90 hover:bg-stone-800 active:bg-[#00A86B] active:text-white border border-stone-800/80 text-xl font-bold font-mono text-stone-100 transition-all cursor-pointer flex items-center justify-center shadow-md active:scale-95 hover:border-stone-700"
            >
              {digit}
            </button>
          ))}

          {/* Clear Button (Icon) */}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl bg-stone-900/40 hover:bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800/60 transition-all cursor-pointer flex items-center justify-center active:scale-95"
            title="Clear all digits"
            aria-label="Clear all digits"
          >
            <RotateCcw className="h-5 w-5" />
          </button>

          {/* 0 Button */}
          <button
            type="button"
            onClick={() => handleDigitPress("0")}
            className="h-14 rounded-2xl bg-stone-900/90 hover:bg-stone-800 active:bg-[#00A86B] active:text-white border border-stone-800/80 text-xl font-bold font-mono text-stone-100 transition-all cursor-pointer flex items-center justify-center shadow-md active:scale-95 hover:border-stone-700"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-stone-900/40 hover:bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800/60 transition-all cursor-pointer flex items-center justify-center active:scale-95"
            title="Delete last digit"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Locks a staff terminal by clearing the server session (the only
 * authentication authority) and reloading into the PIN gate.
 */
export function lockStaffSession(_pinEnvKey: string) {
  logoutAdminSession()
    .catch(() => {})
    .finally(() => {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    });
}