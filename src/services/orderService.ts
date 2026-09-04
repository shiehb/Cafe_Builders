import { Prisma } from "@prisma/client";
import { getDb } from "../lib/prisma";
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
 */
async function generateOrderNumber(): Promise<string> {
  const db = getDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const countToday = await db.order.count({
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

/**
 * Creates an order, calculating all item prices and modifier adjustments strictly
 * from server-side database records.
 *
 * All operations execute within a single Prisma transaction.
 */
export async function createOrder(input: CreateOrderInput): Promise<OrderDto> {
  const db = getDb();

  if (!input.items || input.items.length === 0) {
    throw new Error("Cannot create an order with an empty cart");
  }

  // Execute entire order creation within an atomic transaction
  const createdOrder = await db.$transaction(
    async (tx) => {
      // 1. Gather all product IDs and fetch them with allowed groups and options
      const productIds = Array.from(new Set(input.items.map((it) => it.productId)));
    const products = await tx.product.findMany({
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

    const calculatedItems: CalculatedItem[] = [];
    let orderSubtotal = 0;

    for (const itemInput of input.items) {
      const product = productMap.get(itemInput.productId);
      if (!product) {
        throw new Error(`Product with ID '${itemInput.productId}' not found`);
      }

      if (product.isArchived) {
        throw new Error(`Product "${product.name}" is no longer available`);
      }

      if (!product.isAvailable) {
        throw new Error(`Product "${product.name}" is currently sold out`);
      }

      const quantity = Math.max(1, Math.floor(Number(itemInput.quantity) || 1));
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
        const optionsInDb = await tx.customizationOption.findMany({
          where: {
            id: { in: optionIds },
            isArchived: false,
          },
          include: {
            group: true,
          },
        });

        const optionMap = new Map(optionsInDb.map((o) => [o.id, o]));

        for (const req of requestedOptionIds) {
          const opt = optionMap.get(req.optionId);
          if (!opt) {
            throw new Error(`Customization option '${req.optionId}' not found or is archived`);
          }

          if (!opt.isActive) {
            throw new Error(`Customization option "${opt.name}" is currently disabled`);
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

    const serviceFee = roundMoney(Math.max(0, Number(input.serviceFee) || 0));
    const totalAmount = roundMoney(orderSubtotal + serviceFee);

    // 3. Generate unique order number
    const orderNumber = await generateOrderNumber();

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
 */
export async function updateOrderStatus(
  idOrOrderNumber: string,
  status: OrderStatus
): Promise<OrderDto> {
  const db = getDb();

  const existing = await fetchDbOrderFull(idOrOrderNumber);
  if (!existing) {
    throw new Error(`Order '${idOrOrderNumber}' not found`);
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
    throw new Error(`Order '${input.idOrOrderNumber}' not found`);
  }

  const updated = await db.order.update({
    where: { id: existing.id },
    data: {
      status: input.status ?? "PREPARING",
      paymentIntentId: input.paymentIntentId || existing.paymentIntentId,
      paymentMethodId: input.paymentMethodId || existing.paymentMethodId,
    },
    include: orderFullInclude,
  });

  return mapOrderToDto(updated);
}
