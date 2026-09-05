import { OrderStatus } from "./types";

/**
 * Typed domain error used across the service layer.
 *
 * Expected validation/domain failures carry an HTTP status and a machine code so
 * route handlers can return controlled 4xx responses instead of leaking
 * internal details as generic 500s.
 */
export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "READY",
  "COMPLETED",
];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// ORDER STATUS LIFECYCLE
// ---------------------------------------------------------------------------
//
// Normal lifecycle:
//   PENDING_PAYMENT -> PAID -> PREPARING -> READY -> COMPLETED
//
// Documented intentional exceptions (verified against the current server & UI):
//
//   1. PENDING_PAYMENT -> PREPARING  -- intentional staff/POS override.
//      The POS cash charge (PosPage), KDS "Accept Cash & Brew", KDS "Manual
//      Override & Brew", and the PayMongo webhook/simulate flow all create
//      orders as PENDING_PAYMENT and immediately dispatch them to the kitchen.
//      No integrated flow currently offers a standalone "Mark Paid" control, so
//      this override is the only way those tickets reach PREPARING.
//
//   2. COMPLETED -> READY            -- intentional KDS "Reopen" control.
//
// Every other forward skip and every backward transition is rejected with
// INVALID_TRANSITION (409). Self-transitions are allowed idempotently.
// ---------------------------------------------------------------------------

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "PREPARING"],
  PAID: ["PREPARING"],
  PREPARING: ["READY"],
  READY: ["COMPLETED"],
  COMPLETED: ["READY"],
};

export function isAllowedTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  if (from === to) return true; // idempotent self-transition
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}