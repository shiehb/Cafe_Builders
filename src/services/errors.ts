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
// Payment-before-kitchen is enforced: an order may reach the kitchen (PREPARING)
// only AFTER payment confirmation (PAID). The former PENDING_PAYMENT -> PREPARING
// staff override has been removed (R1): both the PayMongo webhook and the POS
// cash charge transition orders to PAID, and the kitchen then starts brewing.
//
// Documented intentional exception (kept):
//
//   COMPLETED -> READY            -- intentional KDS "Reopen" control.
//
// Every other forward skip and every backward transition is rejected with
// INVALID_TRANSITION (409). Self-transitions are allowed idempotently.
//
// NOTE: PENDING_PAYMENT orders are NEVER broadcast to the kitchen (KDS). The
// kitchen only ever receives orders that are PAID or later. A QRPH order whose
// webhook never fires remains PENDING_PAYMENT and is NOT visible to the KDS;
// this is an accepted operational limitation (no manual workaround by design).
// ---------------------------------------------------------------------------

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID"],
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