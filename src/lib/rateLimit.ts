/**
 * F9 — dependency-free fixed-window rate limiter for the single-process
 * monolith. Counters live in memory only: a process restart resets them, which
 * is the documented tradeoff. Blocks (429) are time-boxed and auto-expire —
 * there is never a permanent lockout. No third-party package required.
 */

export type RateLimitDecision = {
  allowed: boolean;
  /** Whole seconds the caller should wait before retrying. 0 when allowed. */
  retryAfterSeconds: number;
};

export interface FixedWindowRateLimiterOptions {
  /** Fixed window width (ms). */
  windowMs: number;
  /** Max attempts per window before the key is blocked. */
  max: number;
  /** Block duration (ms) after the window's max is exceeded. */
  blockMs: number;
  /** Safety cap on tracked keys to bound memory. Defaults to 5000. */
  maxEntries?: number;
};

type Bucket = {
  count: number;
  windowStart: number;
  blockedUntil: number;
  lastSeen: number;
};

export class FixedWindowRateLimiter {
  private readonly windowMs: number;
  private readonly max: number;
  private readonly blockMs: number;
  private readonly maxEntries: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(opts: FixedWindowRateLimiterOptions) {
    if (opts.windowMs <= 0 || opts.max <= 0 || opts.blockMs <= 0) {
      throw new Error("FixedWindowRateLimiter: windowMs, max and blockMs must be positive");
    }
    this.windowMs = opts.windowMs;
    this.max = opts.max;
    this.blockMs = opts.blockMs;
    this.maxEntries = opts.maxEntries ?? 5000;
  }

  /**
   * Records one attempt against `key`. Returns whether the attempt is allowed
   * and, when blocked, the seconds to wait. While a key is blocked, further
   * attempts are rejected without counting (so the limiter adds no work for a
   * blocked attacker).
   */
  check(key: string): RateLimitDecision {
    const now = Date.now();
    let entry = this.buckets.get(key);
    if (!entry) {
      entry = { count: 0, windowStart: now, blockedUntil: 0, lastSeen: now };
      this.buckets.set(key, entry);
      this.enforceMaxEntries();
    }

    if (entry.blockedUntil > now) {
      entry.lastSeen = now;
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)) };
    }

    if (entry.blockedUntil > 0) {
      // A previous block has expired: open a fresh window unconditionally so
      // recovery is deterministic and never requires a second wait.
      entry.windowStart = now;
      entry.count = 0;
      entry.blockedUntil = 0;
    } else if (now - entry.windowStart >= this.windowMs) {
      entry.windowStart = now;
      entry.count = 0;
    }

    entry.count += 1;
    entry.lastSeen = now;

    if (entry.count > this.max) {
      entry.blockedUntil = now + this.blockMs;
      entry.windowStart = now;
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(this.blockMs / 1000)) };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Clears all history for a key (e.g. after a successful login). */
  recordSuccess(key: string): void {
    this.buckets.delete(key);
  }

  /** Number of distinct keys currently tracked (diagnostics/tests). */
  get size(): number {
    return this.buckets.size;
  }

  private enforceMaxEntries(): void {
    while (this.buckets.size > this.maxEntries) {
      const oldestKey = this.buckets.keys().next().value;
      if (oldestKey === undefined) break;
      this.buckets.delete(oldestKey);
    }
  }
}

/**
 * Parses a positive-integer env value with a fallback. Values that are
 * missing, non-numeric, or below 1 fall back (never disables the limiter by
 * accident).
 */
export function parsePositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "" || raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}