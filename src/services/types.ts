import {
  Category,
  CustomizationGroup,
  CustomizationOption,
  Ingredient,
  Order,
  OrderItem,
  OrderItemModifier,
  OrderStatus,
  OrderType,
  PaymentMethod,
  Product,
  ProductCustomizationGroup,
  ProductCustomizationOption,
  ProductIngredient,
  SelectionMode,
} from "@prisma/client";

// Re-export Prisma enums so callers can import everything from services
export { OrderStatus, PaymentMethod, OrderType, SelectionMode };

// ---------------------------------------------------------------------------
// CATEGORY TYPES & DTOs
// ---------------------------------------------------------------------------

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryInput {
  id?: string;
  name: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// INGREDIENT TYPES & DTOs
// ---------------------------------------------------------------------------

export interface IngredientDto {
  id: string;
  name: string;
  isAvailable: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIngredientInput {
  id?: string;
  name: string;
  isAvailable?: boolean;
}

export interface UpdateIngredientInput {
  name?: string;
  isAvailable?: boolean;
  isArchived?: boolean;
}

// ---------------------------------------------------------------------------
// CUSTOMIZATION OPTION & GROUP TYPES & DTOs
// ---------------------------------------------------------------------------

export interface CustomizationOptionDto {
  id: string;
  groupId: string;
  name: string;
  priceModifier: number; // Serialized as number (Decimal in DB)
  ingredientId: string | null; // Ingredient-backed option (milk alt/add-on)
  ingredient?: IngredientDto | null;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomizationOptionInput {
  id?: string;
  groupId: string;
  name: string;
  priceModifier?: number;
  ingredientId?: string | null;
  isActive?: boolean;
}

export interface UpdateCustomizationOptionInput {
  groupId?: string;
  name?: string;
  priceModifier?: number;
  ingredientId?: string | null;
  isActive?: boolean;
  isArchived?: boolean;
}

export interface CustomizationGroupDto {
  id: string;
  name: string;
  selectionMode: SelectionMode;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  isArchived: boolean;
  options?: CustomizationOptionDto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomizationGroupInput {
  id?: string;
  name: string;
  selectionMode?: SelectionMode;
  isRequired?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCustomizationGroupInput {
  name?: string;
  selectionMode?: SelectionMode;
  isRequired?: boolean;
  sortOrder?: number;
  isActive?: boolean;
  isArchived?: boolean;
}

// ---------------------------------------------------------------------------
// PRODUCT TYPES & DTOs
// ---------------------------------------------------------------------------

export interface ProductIngredientDto {
  productId: string;
  ingredientId: string;
  isRequired: boolean;
  isBase: boolean; // true = the product's default ingredient (matrix "base")
  ingredient: IngredientDto;
}

export interface ProductCustomizationGroupDto {
  productId: string;
  groupId: string;
  sortOrder: number;
  group: CustomizationGroupDto;
}

export interface ProductCustomizationOptionDto {
  productId: string;
  optionId: string;
  // Product-specific surcharge: overrides the option's priceModifier when the
  // product has an explicit allowlist row (authoritative server pricing).
  surcharge: number;
  sortOrder: number; // Deterministic option ordering within the product
  option: CustomizationOptionDto;
}

export interface ProductDto {
  id: string;
  name: string;
  description: string;
  price: number; // Serialized as number (Decimal in DB)
  imageUrl: string;
  categoryId: string;
  category?: CategoryDto;
  isAvailable: boolean;
  manualAvailability: boolean;
  popular: boolean;
  isArchived: boolean;
  ingredients?: ProductIngredientDto[];
  customizationGroups?: ProductCustomizationGroupDto[];
  allowedOptions?: ProductCustomizationOptionDto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  id?: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  categoryId: string;
  manualAvailability?: boolean;
  popular?: boolean;
  ingredients?: Array<{ ingredientId: string; isRequired?: boolean }>;
  customizationGroupIds?: Array<string | { groupId: string; sortOrder?: number }>;
  allowedOptionIds?: string[];
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  categoryId?: string;
  manualAvailability?: boolean;
  popular?: boolean;
  isArchived?: boolean;
  ingredients?: Array<{ ingredientId: string; isRequired?: boolean }>;
  customizationGroupIds?: Array<string | { groupId: string; sortOrder?: number }>;
  allowedOptionIds?: string[];
}

export interface ListProductsOptions {
  includeArchived?: boolean;
  categoryId?: string;
  isAvailable?: boolean;
}

// ---------------------------------------------------------------------------
// ORDER TYPES & DTOs
// ---------------------------------------------------------------------------

export interface OrderItemModifierDto {
  id: string;
  orderItemId: string;
  optionId: string | null;
  groupName: string;
  optionName: string;
  priceAdjustment: number; // Serialized as number (Decimal in DB)
  quantity: number;
  createdAt: Date;
}

export interface OrderItemDto {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  unitPrice: number; // Serialized as number (Decimal in DB)
  quantity: number;
  subtotal: number; // Serialized as number (Decimal in DB)
  customizations?: any;
  notes: string | null;
  modifiers: OrderItemModifierDto[];
  createdAt: Date;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentIntentId: string | null;
  paymentMethodId: string | null;
  qrCodeUrl: string | null;
  customerName: string | null;
  orderType: OrderType;
  notes: string | null;
  subtotal: number; // Serialized as number (Decimal in DB)
  serviceFee: number; // Serialized as number (Decimal in DB)
  totalAmount: number; // Serialized as number (Decimal in DB)
  paidAt: Date | null; // Stamped when the order enters PAID (R1)
  promoCode: string | null; // Reserved for promotion redemption (R5)
  promoDiscount: number; // Serialized as number (Decimal in DB)
  promotionId: string | null;
  items: OrderItemDto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderModifierInput {
  optionId?: string | null;
  groupName?: string;
  optionName?: string;
  priceAdjustment?: number;
  quantity?: number;
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  selectedOptionIds?: string[];
  modifiers?: CreateOrderModifierInput[];
  notes?: string;
  customizations?: any;
}

export interface CreateOrderInput {
  customerName?: string | null;
  orderType?: OrderType;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  items: CreateOrderItemInput[];
  serviceFee?: number;
  paymentIntentId?: string | null;
  paymentMethodId?: string | null;
  qrCodeUrl?: string | null;
}

export interface ListOrdersOptions {
  status?: OrderStatus;
  excludeStatus?: OrderStatus[]; // e.g. KDS hides PENDING_PAYMENT
  paymentMethod?: PaymentMethod;
  limit?: number;
  orderType?: OrderType;
}
