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
  iceLevel?: "Regular Ice" | "Less Ice" | "No Ice" | "Extra Ice" | "Normal Ice" | string;
  sweetness?: "Regular Sweetness" | "Less Sweet" | "Light Sweet" | "No Sugar" | "100%" | "75%" | "50%" | "25%" | "0%" | "50% Sugar" | string;
  temperature?: "Hot" | "Iced" | "Standard" | "Warm" | string;
  milkOption?: string;
  addOns?: string[];
  specialInstructions?: string;
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
  isAvailable: boolean;
  popular?: boolean;
  topPick?: boolean;
  houseSpecial?: boolean;
  rating?: number;
  reviewCount?: number;
  prepTimeMinutes?: number;
  calories?: number;
  temperatureOptions?: ("Hot" | "Iced")[];
  sweetnessAdjustable?: boolean;
  milkOptionsAvailable?: boolean;
  /** Explicit manager configuration; absent means legacy product defaults. */
  enabledCustomizationGroups?: CustomizationGroup[];
  milkOptions?: CustomizationOption[];
  addonOptions?: CustomizationOption[];
  tags?: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconName?: string;
  iconEmoji?: string;
  sortOrder: number;
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
    subtotal: number;
    notes?: string;
  }[];
  customerName?: string;
  orderType?: OrderType;
  paymentMethod: PaymentMethod;
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
