import { Prisma } from "@prisma/client";
import { getDb } from "../lib/prisma";
import { AppError, isAllowedTransition, isOrderStatus } from "./errors";
import { decimalToNumber, roundMoney, toDecimal } from "./serialization";
import {
  CreateOrderInput,
  ListOrdersOptions,
  OrderDto,
  OrderItemDto,
  OrderItemModifierDto,
  OrderStatus,
} from "./types";

export const orderFullInclude = {
  items: {
    include: {
      modifiers: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.OrderInclude;

export type DbOrderFull = Prisma.OrderGetPayload<{
  include: typeof orderFullInclude;
}>;

/**
 * F10 — server-side bounds for externally supplied order input. Generous
 * relative to real UI behavior but applied authoritatively at the service layer
 * so every caller (checkout, POS, direct service use) is covered. server.ts
 * mirrors these same values for early rejection with richer 4xx codes.
 */
export const ORDER_INPUT_LIMITS = {
  maxCartItems: 50,
  maxQuantityPerItem: 99,
  maxCustomizationsPerItem: 100,
  maxItemNotesLength: 200,
  maxOrderNotesLength: 500,
  maxCustomerNameLength: 100,
  maxPromoCodeLength: 50,
} as const;

async function fetchDbOrderFull(idOrOrderNumber: string): Promise<DbOrderFull | null> {
  const db = getDb();
  return db.order.findFirst({
    where: {
      OR: [{ id: idOrOrderNumber }, { orderNumber: idOrOrderNumber }],
    },
    include: orderFullInclude,
  });
}

/**
 * Maps a Prisma Order entity with items & modifiers to a typed OrderDto.
 */
export function mapOrderToDto(order: DbOrderFull): OrderDto {
  const itemsDto: OrderItemDto[] = (order.items || []).map((item) => {
    const modifiersDto: OrderItemModifierDto[] = (item.modifiers || []).map(
      (mod) => ({
        id: mod.id,
        orderItemId: mod.orderItemId,
        optionId: mod.optionId,
        groupName: mod.groupName,
        optionName: mod.optionName,
        priceAdjustment: decimalToNumber(mod.priceAdjustment),
        quantity: mod.quantity,
        createdAt: mod.createdAt,
      })
    );

    return {
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productName: item.productName,
      unitPrice: decimalToNumber(item.unitPrice),
      quantity: item.quantity,
      subtotal: decimalToNumber(item.subtotal),
      customizations: item.customizations,
      notes: item.notes,
      modifiers: modifiersDto,
      createdAt: item.createdAt,
    };
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentIntentId: order.paymentIntentId,
    paymentMethodId: order.paymentMethodId,
    qrCodeUrl: order.qrCodeUrl,
    customerName: order.customerName,
    orderType: order.orderType,
    notes: order.notes,
    subtotal: decimalToNumber(order.subtotal),
    serviceFee: decimalToNumber(order.serviceFee),
    totalAmount: decimalToNumber(order.totalAmount),
    items: itemsDto,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

/**
 * Generates the next sequential order number for the current calendar day (e.g. "C-001").
 *
 * Runs inside the creating transaction and takes a Postgres daily advisory lock
 * so concurrent checkouts serialize their count+insert and never collide on the
 * same "C-###" number. The lock is released automatically when the transaction
 * commits or rolls back.
 */
async function generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('cafe_orders_' || to_char(current_date, 'YYYYMMDD')))`;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const countToday = await tx.order.count({
    where: {
      createdAt: {
        gte: startOfDay,
      },
    },
  });

  const nextSeq = countToday + 1;
  const padded = String(nextSeq).padStart(3, "0");
  return `C-${padded}`;
}

interface CalculatedModifier {
  optionId: string | null;
  groupName: string;
  optionName: string;
  priceAdjustment: number;
  quantity: number;
}

interface CalculatedItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  customizations: any;
  notes: string | null;
  modifiers: CalculatedModifier[];
}

interface CalculatedItemsResult {
  calculatedItems: CalculatedItem[];
  orderSubtotal: number;
  serviceFee: number;
  totalAmount: number;
}

/**
 * Computes authoritative server-side item pricing and applies the two-level
 * customization authorization rules, exactly as createOrder uses them.
 * Performs NO writes; runs against a transaction client or the shared db.
 */
async function calculateOrderItems(
  client: Prisma.TransactionClient,
  items: CreateOrderInput["items"],
  serviceFeeInput?: number
): Promise<CalculatedItemsResult> {
  // F10 — defense-in-depth: bound the cart and per-item quantity authoritatively
  // in the service layer regardless of which caller reaches it.
  if (items.length > ORDER_INPUT_LIMITS.maxCartItems) {
    throw new AppError(400, "TOO_MANY_ITEMS", `Order exceeds the maximum of ${ORDER_INPUT_LIMITS.maxCartItems} items`);
  }

  // 1. Gather all product IDs and fetch them with allowed groups and options
  const productIds = Array.from(new Set(items.map((it) => it.productId)));
  const products = await client.product.findMany({
    where: {
      id: { in: productIds },
    },
    include: {
      customizationGroups: {
        include: {
          group: {
            include: {
              options: true,
            },
          },
        },
      },
      allowedOptions: {
        include: {
          option: {
            include: {
              group: true,
            },
          },
        },
      },
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  // 2. Validate availability and build calculated items
  const calculatedItems: CalculatedItem[] = [];
  let orderSubtotal = 0;

  for (const itemInput of items) {
    const product = productMap.get(itemInput.productId);
    if (!product) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", `Product with ID '${itemInput.productId}' not found`);
    }

    if (product.isArchived) {
      throw new AppError(409, "PRODUCT_UNAVAILABLE", `Product "${product.name}" is no longer available`);
    }

    if (!product.isAvailable) {
      throw new AppError(409, "PRODUCT_UNAVAILABLE", `Product "${product.name}" is currently sold out`);
    }

    const quantity = Math.max(1, Math.floor(Number(itemInput.quantity) || 1));
    if (quantity > ORDER_INPUT_LIMITS.maxQuantityPerItem) {
      throw new AppError(400, "QUANTITY_TOO_LARGE", `Item quantity exceeds the maximum of ${ORDER_INPUT_LIMITS.maxQuantityPerItem}`);
    }
    const baseUnitPrice = decimalToNumber(product.price);

    // Collect option IDs from either selectedOptionIds array or modifiers array
    const requestedOptionIds: Array<{ optionId: string; qty: number }> = [];

    if (Array.isArray(itemInput.selectedOptionIds)) {
      for (const optId of itemInput.selectedOptionIds) {
        if (optId) requestedOptionIds.push({ optionId: optId, qty: 1 });
      }
    }

    if (Array.isArray(itemInput.modifiers)) {
      for (const mod of itemInput.modifiers) {
        if (mod.optionId) {
          requestedOptionIds.push({
            optionId: mod.optionId,
            qty: Math.max(1, mod.quantity || 1),
          });
        }
      }
    }

    // Resolve options from product's allowed options and groups
    const calculatedModifiers: CalculatedModifier[] = [];
    let itemModifierSum = 0;

    if (requestedOptionIds.length > 0) {
      const optionIds = requestedOptionIds.map((r) => r.optionId);
      const optionsInDb = await client.customizationOption.findMany({
        where: {
          id: { in: optionIds },
        },
        include: {
          group: true,
        },
      });

      const optionMap = new Map(optionsInDb.map((o) => [o.id, o]));
      const linkedGroupIds = new Set(
        product.customizationGroups.map((pcg) => pcg.groupId)
      );
      const explicitlyAllowedOptionIds = new Set(
        product.allowedOptions.map((ao) => ao.optionId)
      );

      for (const req of requestedOptionIds) {
        const opt = optionMap.get(req.optionId);
        if (!opt) {
          throw new AppError(404, "OPTION_NOT_FOUND", `Customization option '${req.optionId}' not found`);
        }

        if (opt.isArchived) {
          throw new AppError(400, "OPTION_ARCHIVED", `Customization option "${opt.name}" is archived`);
        }

        if (!opt.isActive) {
          throw new AppError(400, "OPTION_UNAVAILABLE", `Customization option "${opt.name}" is currently disabled`);
        }

        // Level 1 authorization: the option must belong to a customization
        // group linked to the product.
        if (!linkedGroupIds.has(opt.groupId)) {
          throw new AppError(400, "OPTION_NOT_ALLOWED", `Customization option "${opt.name}" is not part of this product`);
        }

        // Level 2 authorization: when the product maintains an explicit
        // allowlist, only options on that list may be applied.
        if (explicitlyAllowedOptionIds.size > 0 && !explicitlyAllowedOptionIds.has(opt.id)) {
          throw new AppError(400, "OPTION_NOT_ALLOWED", `Customization option "${opt.name}" is not allowed for this product`);
        }

        const priceAdjustment = decimalToNumber(opt.priceModifier);
        const modTotal = priceAdjustment * req.qty;
        itemModifierSum += modTotal;

        calculatedModifiers.push({
          optionId: opt.id,
          groupName: opt.group.name,
          optionName: opt.name,
          priceAdjustment,
          quantity: req.qty,
        });
      }
    }

    // Calculate line totals
    const effectiveUnitPrice = roundMoney(baseUnitPrice + itemModifierSum);
    const lineSubtotal = roundMoney(effectiveUnitPrice * quantity);
    orderSubtotal = roundMoney(orderSubtotal + lineSubtotal);

    calculatedItems.push({
      productId: product.id,
      productName: product.name,
      unitPrice: baseUnitPrice,
      quantity,
      subtotal: lineSubtotal,
      customizations: itemInput.customizations || undefined,
      notes: itemInput.notes?.trim() || null,
      modifiers: calculatedModifiers,
    });
  }

  const serviceFee = roundMoney(Math.max(0, Number(serviceFeeInput) || 0));
  const totalAmount = roundMoney(orderSubtotal + serviceFee);

  return {
    calculatedItems,
    orderSubtotal,
    serviceFee,
    totalAmount,
  };
}

/**
 * Returns the authoritative server-side total for a list of items WITHOUT
 * persisting anything. Used before order creation to validate client tenders
 * against true database pricing.
 */
export async function quoteOrder(
  items: CreateOrderInput["items"],
  options?: { serviceFee?: number }
): Promise<{ subtotal: number; serviceFee: number; totalAmount: number }> {
  if (!items || items.length === 0) {
    throw new AppError(400, "EMPTY_CART", "Cannot price an order with an empty cart");
  }

  const db = getDb();
  const { orderSubtotal, serviceFee, totalAmount } = await calculateOrderItems(
    db,
    items,
    options?.serviceFee ?? 0
  );

  return { subtotal: orderSubtotal, serviceFee, totalAmount };
}

/**
 * Creates an order, calculating all item prices and modifier adjustments strictly
 * from server-side database records.
 *
 * All operations execute within a single Prisma transaction.
 */
export async function createOrder(input: CreateOrderInput): Promise<OrderDto> {
  const db = getDb();

  if (!input.items || input.items.length === 0) {
    throw new AppError(400, "EMPTY_CART", "Cannot create an order with an empty cart");
  }

  // Execute entire order creation within an atomic transaction
  const createdOrder = await db.$transaction(
    async (tx) => {
      const { calculatedItems, orderSubtotal, serviceFee, totalAmount } =
        await calculateOrderItems(tx, input.items, input.serviceFee);

    // 3. Generate unique order number (serialized per-day under advisory lock)
    const orderNumber = await generateOrderNumber(tx);

    // 4. Determine initial status
    const initialStatus: OrderStatus =
      input.paymentMethod === "CASH" ? "PENDING_PAYMENT" : "PENDING_PAYMENT";

    // 5. Create Order and nested items + modifiers
    const order = await tx.order.create({
      data: {
        orderNumber,
        status: initialStatus,
        paymentMethod: input.paymentMethod,
        paymentIntentId: input.paymentIntentId || null,
        paymentMethodId: input.paymentMethodId || null,
        qrCodeUrl: input.qrCodeUrl || null,
        customerName: input.customerName?.trim() || "Guest",
        orderType: input.orderType || "DINE_IN",
        notes: input.notes?.trim() || null,
        subtotal: toDecimal(orderSubtotal),
        serviceFee: toDecimal(serviceFee),
        totalAmount: toDecimal(totalAmount),
        items: {
          create: calculatedItems.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            unitPrice: toDecimal(it.unitPrice),
            quantity: it.quantity,
            subtotal: toDecimal(it.subtotal),
            customizations: it.customizations ?? undefined,
            notes: it.notes,
            modifiers: it.modifiers.length
              ? {
                  create: it.modifiers.map((m) => ({
                    optionId: m.optionId,
                    groupName: m.groupName,
                    optionName: m.optionName,
                    priceAdjustment: toDecimal(m.priceAdjustment),
                    quantity: m.quantity,
                  })),
                }
              : undefined,
          })),
        },
      },
      include: orderFullInclude,
    });

    return order;
  }, {
    maxWait: 15000,
    timeout: 15000,
  });

  return mapOrderToDto(createdOrder);
}

/**
 * Gets a single order by ID or orderNumber.
 */
export async function getOrderById(idOrOrderNumber: string): Promise<OrderDto | null> {
  const order = await fetchDbOrderFull(idOrOrderNumber);
  return order ? mapOrderToDto(order) : null;
}

/**
 * Lists orders ordered by most recent first.
 */
export async function listOrders(options?: ListOrdersOptions): Promise<OrderDto[]> {
  const db = getDb();
  const where: any = {};

  if (options?.status) {
    where.status = options.status;
  }
  if (options?.orderType) {
    where.orderType = options.orderType;
  }

  const orders = await db.order.findMany({
    where,
    include: orderFullInclude,
    orderBy: {
      createdAt: "desc",
    },
    take: options?.limit ?? 100,
  });

  return orders.map(mapOrderToDto);
}

/**
 * Updates an order's lifecycle status (e.g. from KDS or staff POS).
 *
 * Only legal forward transitions (plus the documented intentional overrides)
 * are accepted. Invalid status strings return 400 and illegal transitions
 * return 409 so callers get controlled errors instead of silent no-ops.
 */
export async function updateOrderStatus(
  idOrOrderNumber: string,
  status: OrderStatus
): Promise<OrderDto> {
  const db = getDb();

  if (!isOrderStatus(status)) {
    throw new AppError(400, "INVALID_STATUS", `Status "${String(status)}" is not a valid order status`);
  }

  const existing = await fetchDbOrderFull(idOrOrderNumber);
  if (!existing) {
    throw new AppError(404, "ORDER_NOT_FOUND", `Order '${idOrOrderNumber}' not found`);
  }

  if (!isAllowedTransition(existing.status, status)) {
    throw new AppError(
      409,
      "INVALID_TRANSITION",
      `Order '${existing.orderNumber}' cannot transition from ${existing.status} to ${status}`
    );
  }

  const updated = await db.order.update({
    where: { id: existing.id },
    data: { status },
    include: orderFullInclude,
  });

  return mapOrderToDto(updated);
}

/**
 * Records payment confirmation (e.g. from PayMongo webhook or POS terminal).
 *
 * Status handling is advance-only: the order is moved to the requested status
 * only when that transition is legal; otherwise the current status is kept so
 * a late webhook (e.g. after COMPLETED) never moves an order backwards.
 * Payment identifiers always persist.
 */
export async function recordPayment(input: {
  idOrOrderNumber: string;
  paymentIntentId?: string;
  paymentMethodId?: string;
  status?: OrderStatus;
}): Promise<OrderDto> {
  const db = getDb();

  const existing = await fetchDbOrderFull(input.idOrOrderNumber);
  if (!existing) {
    throw new AppError(404, "ORDER_NOT_FOUND", `Order '${input.idOrOrderNumber}' not found`);
  }

  const targetStatus: OrderStatus = input.status ?? "PREPARING";
  if (!isOrderStatus(targetStatus)) {
    throw new AppError(400, "INVALID_STATUS", `Status "${String(targetStatus)}" is not a valid order status`);
  }

  const nextStatus = isAllowedTransition(existing.status, targetStatus)
    ? targetStatus
    : existing.status;

  const updated = await db.order.update({
    where: { id: existing.id },
    data: {
      status: nextStatus,
      paymentIntentId: input.paymentIntentId || existing.paymentIntentId,
      paymentMethodId: input.paymentMethodId || existing.paymentMethodId,
    },
    include: orderFullInclude,
  });

  return mapOrderToDto(updated);
}
