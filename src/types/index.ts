export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PREPARING"
  | "READY"
  | "COMPLETED";

export type PaymentMethod = "QRPH" | "CASH";

export type OrderType = "DINE_IN" | "TAKEAWAY";

export interface CustomizationOption {
  name: string;
  price: number;
}

export type CustomizationGroup = "ice" | "sugar" | "milk" | "addons";

export interface ItemCustomization {
  size?: string;
  iceLevel?: "Less" | "Regular" | "Extra" | string;
  sweetness?: "Regular Sweetness" | "Less Sweet" | "Light Sweet" | "No Sugar" | "100%" | "75%" | "50%" | "25%" | "0%" | "50% Sugar" | string;
  milkOption?: string;
  addOns?: string[];
  /** DB option ids (from the product's customizationGroups) the customer selected. */
  selectedOptionIds?: string[];
  specialInstructions?: string;
}

/** Raw option payload as it arrives from the server inside product.customizationGroups. */
export interface ProductCustomizationOptionData {
  id: string;
  groupId: string;
  name: string;
  priceModifier: number;
  isActive: boolean;
  isArchived?: boolean;
}

/** Raw group payload as it arrives from the server inside product.customizationGroups. */
export interface ProductCustomizationGroupData {
  productId?: string;
  groupId: string;
  sortOrder: number;
  group: {
    id: string;
    name: string;
    selectionMode: "SINGLE" | "MULTIPLE";
    isRequired: boolean;
    sortOrder: number;
    isActive: boolean;
    isArchived: boolean;
    options: ProductCustomizationOptionData[];
  };
}

/** Raw allowlist payload as it arrives from the server inside product.allowedOptions. */
export interface ProductAllowedOptionData {
  productId?: string;
  optionId: string;
  option: ProductCustomizationOptionData;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  categoryId: string;
  categoryName?: string;
  categoryIds?: string[];
  productType?: "BEVERAGE" | "FOOD";
  isAvailable: boolean;
  manualAvailability?: boolean;
  isArchived?: boolean;
  ingredientIds?: string[];

  popular?: boolean;
  topPick?: boolean;
  houseSpecial?: boolean;
  rating?: number;
  reviewCount?: number;
  prepTimeMinutes?: number;
  calories?: number;
  sweetnessAdjustable?: boolean;
  milkOptionsAvailable?: boolean;
  /** Explicit manager configuration; absent means legacy product defaults. */
  enabledCustomizationGroups?: CustomizationGroup[];
  milkOptions?: CustomizationOption[];
  addonOptions?: CustomizationOption[];
  allowedOptionIds?: string[];
  /** Raw authoritative customization groups from the server (array when a server product). */
  customizationGroups?: ProductCustomizationGroupData[];
  /** Raw authoritative option allowlist from the server (array when a server product). */
  allowedOptions?: ProductAllowedOptionData[];
  tags?: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  iconName?: string;
  sortOrder: number;
  productType?: "BEVERAGE" | "FOOD";
  isActive?: boolean;
  isArchived?: boolean;
}

export interface CustomizationGroupConfig {
  id: string;
  name: string;
  selectionMode: "SINGLE" | "MULTIPLE";
  isActive: boolean;
  isRequired?: boolean;
  sortOrder?: number;
  isArchived?: boolean;
}

export interface CustomizationOptionConfig {
  id: string;
  groupId: string;
  name: string;
  priceModifier: number;
  isActive: boolean;
  isArchived?: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  isAvailable: boolean;
  isArchived?: boolean;
  productIds?: string[];
}

export interface CartItem {
  id: string; // unique item id in cart (product.id + custom hash)
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  customizations: ItemCustomization;
  customizationsTotal: number; // Extra cost from add-ons/milk
  lineTotal: number;
}

export interface OrderItemSnapshot {
  id?: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  customizations?: ItemCustomization;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. "C-001"
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentIntentId?: string | null;
  paymentMethodId?: string | null;
  qrCodeUrl?: string | null;
  customerName?: string | null;
  orderType: OrderType;
  notes?: string | null;
  subtotal: number;
  discount?: number;
  promoCode?: string | null;
  serviceFee: number;
  totalAmount: number;
  items: OrderItemSnapshot[];
  createdAt: string;
  updatedAt: string;
  estimatedReadyTime?: string;
}

export interface CheckoutPayload {
  items: {
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    customizations?: ItemCustomization;
    selectedOptionIds?: string[];
    subtotal: number;
    notes?: string;
  }[];
  customerName?: string;
  orderType?: OrderType;
  paymentMethod: PaymentMethod;
  paymentStatus?: "PENDING" | "PAID";
  cashTendered?: number;
  notes?: string;
  discount?: number;
  promoCode?: string;
}

export interface CheckoutResponse {
  success: boolean;
  orderNumber: string;
  order: Order;
  qrCodeUrl?: string | null;
  paymentIntentId?: string | null;
  message?: string;
}

export interface PayMongoPaymentIntent {
  id: string;
  type: string;
  attributes: {
    amount: number; // in centavos
    currency: string; // "PHP"
    status: "awaiting_payment_method" | "awaiting_next_action" | "processing" | "succeeded" | "failed";
    payment_method_allowed: string[];
    next_action?: {
      type: "consume_qr_code" | string;
      code?: {
        image_url?: string;
        data?: string;
      };
    };
  };
}
