import { Prisma } from "@prisma/client";

/**
 * ============================================================================
 * DECIMAL & MONETARY SERIALIZATION STRATEGY
 * ============================================================================
 *
 * 1. Storage / Database:
 *    - All monetary fields in PostgreSQL / Prisma schema use Decimal(10, 2):
 *      Product.price, CustomizationOption.priceModifier,
 *      Order.subtotal, Order.serviceFee, Order.totalAmount,
 *      OrderItem.unitPrice, OrderItem.subtotal,
 *      OrderItemModifier.priceAdjustment.
 *
 * 2. Service-to-API / DTO Representation:
 *    - Monetary fields are serialized as standard JavaScript `number` rounded
 *      to 2 decimal places (cents/centavos precision).
 *    - Reason: The entire client application (React components, CartContext,
 *      formatPrice helpers, PayMongo integration) relies on numeric arithmetic
 *      and formatting without needing client-side Decimal libraries.
 *
 * 3. Write / Mutation Representation:
 *    - When accepting prices from API inputs or calculating order totals,
 *      values are rounded to 2 decimal places using `roundMoney()` and converted
 *      to `Prisma.Decimal` via `toDecimal()` before writing to the database.
 */

/**
 * Rounds a number to exactly 2 decimal places using Number.EPSILON
 * to prevent floating point inaccuracies.
 */
export function roundMoney(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Safely converts a Prisma.Decimal, number, string, or null/undefined
 * into a JavaScript number rounded to 2 decimal places.
 */
export function decimalToNumber(
  value: Prisma.Decimal | number | string | null | undefined,
  fallback = 0
): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return roundMoney(value);
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : roundMoney(parsed);
  }
  // Prisma.Decimal (implements .toNumber() and .toString())
  if (typeof (value as Prisma.Decimal).toNumber === "function") {
    return roundMoney((value as Prisma.Decimal).toNumber());
  }
  const parsed = Number(value);
  return isNaN(parsed) ? fallback : roundMoney(parsed);
}

/**
 * Converts a number or numeric string to a Prisma.Decimal with 2 decimal places.
 */
export function toDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  const num = typeof value === "string" ? parseFloat(value) : value;
  const rounded = roundMoney(isNaN(num) ? 0 : num);
  return new Prisma.Decimal(rounded.toFixed(2));
}

/**
 * Formats a monetary value to a standard 2-decimal string representation (e.g. "165.00").
 */
export function formatMoney(amount: number | Prisma.Decimal): string {
  return decimalToNumber(amount).toFixed(2);
}
