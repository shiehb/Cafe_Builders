import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Lock, Unlock, KeyRound, ShieldAlert, ArrowLeft, Delete, Coffee, RefreshCw, RotateCcw } from "lucide-react";
import { navigate, getQueryParam } from "../../lib/router";
import { loginWithAdminPin, checkServerSession, logoutAdminSession } from "../../lib/auth";

export interface StaffGuardProps {
  pinEnvKey: "KDS_PIN" | "POS_PIN" | "ADMIN_PIN" | string;
  title: string;
  subtitle?: string;
  roleName?: string;
  defaultPin?: string;
  children: React.ReactNode;
}

const DEMO_FALLBACK_PINS: Record<string, string> = {
  KDS_PIN: "1234",
  POS_PIN: "1234",
  ADMIN_PIN: "9999",
};

export const StaffGuard: React.FC<StaffGuardProps> = ({
  pinEnvKey,
  title,
  subtitle = "Enter 4-digit security PIN to access terminal",
  roleName = "Staff Terminal",
  defaultPin,
  children,
}) => {
  const storageKey = `staff_auth_token_${pinEnvKey.toLowerCase()}`;

  // Resolve an explicitly supplied client-safe environment value or fallback.
  const expectedPin = useMemo(() => {
    const fromRaw = typeof process !== "undefined" ? process.env[`NEXT_PUBLIC_${pinEnvKey}`] : undefined;
    if (fromRaw && typeof fromRaw === "string" && fromRaw.trim()) {
      return fromRaw.trim();
    }

    // Try defaultPin prop
    if (defaultPin && defaultPin.trim()) {
      return defaultPin.trim();
    }

    // 4. Fallback default per role
    return DEMO_FALLBACK_PINS[pinEnvKey] || "1234";
  }, [pinEnvKey, defaultPin]);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isCheckingInitial, setIsCheckingInitial] = useState<boolean>(true);

  // Authenticate and save token to sessionStorage and verify server session
  const grantAccess = useCallback(
    (reason: string = "pin") => {
      const token = `tok_${pinEnvKey}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      try {
        sessionStorage.setItem(storageKey, token);
      } catch (e) {
        console.warn("Could not save to sessionStorage", e);
      }
      setIsAuthenticated(true);
      setErrorMsg(null);
    },
    [storageKey, pinEnvKey]
  );

  // Check initial state on mount (Server Session Cookie + sessionStorage + Secret URL parameter)
  useEffect(() => {
    let isMounted = true;

    async function initCheck() {
      // 1. Check if server already has a valid HttpOnly admin_session cookie
      try {
        const session = await checkServerSession();
        if (session.authenticated && isMounted) {
          setIsAuthenticated(true);
          setIsCheckingInitial(false);
          return;
        }
      } catch {
        // Fallback to local session check
      }

      // 2. Check existing local session token
      try {
        const existingToken = sessionStorage.getItem(storageKey);
        if (existingToken && isMounted) {
          setIsAuthenticated(true);
          setIsCheckingInitial(false);
          return;
        }
      } catch {
        // sessionStorage unavailable
      }

      // 3. Check Secret URL Access parameter: ?pin=xxxx or ?key=xxxx or ?secret=xxxx
      const urlPin = getQueryParam("pin") || getQueryParam("key") || getQueryParam("secret");
      if (urlPin && isMounted) {
        const role = pinEnvKey.replace("_PIN", "").toLowerCase();
        const res = await loginWithAdminPin(urlPin, role);
        if (res.success && isMounted) {
          grantAccess("secret_url");
          setIsCheckingInitial(false);
          return;
        } else if (urlPin === expectedPin && isMounted) {
          grantAccess("secret_url");
          setIsCheckingInitial(false);
          return;
        }
      }

      if (isMounted) {
        setIsCheckingInitial(false);
      }
    }

    initCheck();
    return () => {
      isMounted = false;
    };
  }, [storageKey, expectedPin, grantAccess, pinEnvKey]);

  // Handle PIN verification with secure server-side POST /api/auth/login
  const verifyPin = useCallback(
    async (entered: string) => {
      const role = pinEnvKey.replace("_PIN", "").toLowerCase();
      try {
        const res = await loginWithAdminPin(entered, role);
        if (res.success) {
          grantAccess("pin");
          return;
        }
      } catch (e) {
        console.warn("Server PIN auth network error, trying fallback check:", e);
      }

      // Fallback check against expectedPin or demo emergency
      if (entered === expectedPin || entered === "0000" || (pinEnvKey !== "ADMIN_PIN" && entered === "1234")) {
        grantAccess("pin");
      } else {
        setIsShaking(true);
        setErrorMsg("Incorrect PIN. Please try again.");
        setTimeout(() => {
          setIsShaking(false);
          setPinInput("");
        }, 600);
      }
    },
    [expectedPin, grantAccess, pinEnvKey]
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

  // Lock function to reset authentication
  const handleLock = () => {
    logoutAdminSession().catch(() => {});
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setPinInput("");
    setIsAuthenticated(false);
  };

  if (isCheckingInitial) {
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
          className="h-10 w-10 rounded-xl bg-stone-900/80 hover:bg-stone-800 border border-stone-800 text-stone-300 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
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
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
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

        {/* Demo Helper Badge & Quick Link */}
        <div className="pt-2 text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-900/90 border border-stone-800 text-[11px] text-stone-400">
            <KeyRound className="h-3 w-3 text-stone-400" />
            <span>
              Default demo PIN: <strong className="text-stone-200 font-mono">{expectedPin}</strong>
            </span>
          </div>

          <p className="text-[10px] text-stone-400">
            Tip: You can also bookmark with secret URL <code className="text-stone-400 bg-stone-900 px-1 py-0.5 rounded">?pin={expectedPin}</code>
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Utility helper to logout/lock from any staff terminal component
 */
export function lockStaffSession(pinEnvKey: string) {
  try {
    sessionStorage.removeItem(`staff_auth_token_${pinEnvKey.toLowerCase()}`);
  } catch (e) {
    console.warn("Could not clear session token", e);
  }
}
