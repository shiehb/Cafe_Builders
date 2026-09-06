import React, { useState, useEffect, useMemo } from "react";
import { StaffGuard } from "../components/staff/StaffGuard";
import { StaffLayout } from "../components/staff/StaffLayout";
import { Product, Category, CartItem, Order, OrderType, PaymentMethod } from "../types";
import { CATEGORIES, PRODUCTS } from "../data/menuData";
import { formatPrice, cn } from "../lib/utils";
import {
  Banknote,
  QrCode,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Receipt,
  X,
  ShoppingBag,
  Coffee,
} from "lucide-react";
import { playOrderChime } from "../lib/audio";
import { emitLocalOrderEvent, useProductInventoryRealtime } from "../lib/realtime";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

export function PosPage() {
  const [categories] = useState<Category[]>(CATEGORIES);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Cashier Ticket State
  const [ticketItems, setTicketItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>("Walk-in Guest");
  const [orderType, setOrderType] = useState<OrderType>("DINE_IN");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  // Process states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isConfirmChargeOpen, setIsConfirmChargeOpen] = useState<boolean>(false);
  const [isConfirmClearTicketOpen, setIsConfirmClearTicketOpen] = useState<boolean>(false);
  const [lastChargedOrder, setLastChargedOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && Array.isArray(json?.data)) setProducts(json.data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useProductInventoryRealtime((updatedProduct: Product) => {
    setProducts((previous) =>
      previous.map((product) =>
        product.id === updatedProduct.id ? { ...product, ...updatedProduct } : product
      )
    );
  });

  // Recent Orders Drawer / Modal
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [showRecentDrawer, setShowRecentDrawer] = useState<boolean>(false);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable))
      .filter((p) => {
        const matchCat =
          selectedCategory === "all" ||
          p.categoryId === selectedCategory ||
          p.categoryName?.toLowerCase() === selectedCategory.toLowerCase();
        const matchSearch =
          !searchQuery.trim() ||
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
      });
  }, [products, selectedCategory, searchQuery]);

  // Calculations
  const ticketSubtotal = useMemo(() => {
    return ticketItems.reduce((acc, it) => acc + it.lineTotal, 0);
  }, [ticketItems]);

  const changeDue = useMemo(() => {
    if (paymentMethod !== "CASH" || cashTendered < ticketSubtotal) return 0;
    return cashTendered - ticketSubtotal;
  }, [cashTendered, ticketSubtotal, paymentMethod]);

  // Add Product to Ticket
  const handleAddProduct = (product: Product) => {
    if (!product.isAvailable) return;
    setTicketItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.productId === product.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        const existing = copy[existingIdx];
        const nextQty = existing.quantity + 1;
        copy[existingIdx] = {
          ...existing,
          quantity: nextQty,
          lineTotal: (existing.unitPrice + existing.customizationsTotal) * nextQty,
        };
        return copy;
      }

      const newItem: CartItem = {
        id: `pos_${product.id}_${Date.now()}`,
        productId: product.id,
        product,
        quantity: 1,
        unitPrice: product.price,
        customizations: {},
        customizationsTotal: 0,
        lineTotal: product.price,
      };
      return [...prev, newItem];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setTicketItems((prev) =>
      prev
        .map((it) => {
          if (it.id === itemId) {
            const nextQty = it.quantity + delta;
            if (nextQty <= 0) return null;
            return {
              ...it,
              quantity: nextQty,
              lineTotal: (it.unitPrice + it.customizationsTotal) * nextQty,
            };
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (itemId: string) => {
    setTicketItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const clearTicket = () => {
    setTicketItems([]);
    setCustomerName("Walk-in Guest");
    setCashTendered(0);
    setNotes("");
    setErrorMessage(null);
  };

  // Fetch recent orders for staff reference
  const fetchRecentOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setRecentOrders(data.data || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchRecentOrders();
  }, []);

  // Submit and Charge Order
  const handleChargeOrder = () => {
    if (ticketItems.length === 0) {
      setErrorMessage("Please select at least one item.");
      return;
    }

    if (paymentMethod === "CASH" && cashTendered > 0 && cashTendered < ticketSubtotal) {
      setErrorMessage(`Cash tendered (${formatPrice(cashTendered)}) is less than total.`);
      return;
    }

    setErrorMessage(null);
    setIsConfirmChargeOpen(true);
  };

  const executeChargeOrder = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      items: ticketItems.map((it) => ({
        productId: it.productId,
        productName: it.product.name,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        subtotal: it.lineTotal,
        customizations: it.customizations,
        notes: "",
      })),
      customerName: customerName.trim() || "Walk-in Guest",
      orderType,
      paymentMethod,
      // P0-C: the server never trusts client paymentStatus. Orders stay
      // PENDING_PAYMENT until an authorized payment confirmation records them
      // as PAID (PayMongo webhook for QRPH; future P1 cashier confirmation
      // for CASH).
      notes: notes.trim() ? `[POS] ${notes.trim()}` : "[POS Order]",
    };

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Failed to create order (${res.status})`);
      }

      const data = await res.json();
      if (data.order) {
        setLastChargedOrder(data.order);
        emitLocalOrderEvent("order_created", data.order);
        playOrderChime();
        clearTicket();
        fetchRecentOrders();
      }
    } catch (err: any) {
      console.error("POS Charge error", err);
      setErrorMessage(err?.message || "Failed to process POS checkout");
    } finally {
      setIsSubmitting(false);
      setIsConfirmChargeOpen(false);
    }
  };

  return (
    <StaffGuard
      pinEnvKey="POS_PIN"
      title="Cashier POS Terminal"
      subtitle="Enter 4-digit PIN to access register terminal"
      roleName="Cashier Terminal"
    >
      <StaffLayout
        activeTab="pos"
        title="Cashier POS Terminal"
        subtitle="Quick counter ordering with Cash change calculator & QR Ph"
        pinEnvKey="POS_PIN"
        headerRight={
          <button
            type="button"
            onClick={() => {
              fetchRecentOrders();
              setShowRecentDrawer(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#F7F9FA] text-[#374151] text-xs font-semibold border border-[#E5E7EB] transition-all cursor-pointer"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Recent Tickets</span>
          </button>
        }
      >
        {/* 70/30 COLUMN LAYOUT */}
        <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
          
          {/* LEFT 70% COLUMN: MENU CATALOG */}
          <div className="w-full lg:w-[70%] flex flex-col space-y-4">
            {/* Search & Category Header Row */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-9 pr-8 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs text-[#1F2937] focus:outline-none focus:border-[#00A86B]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`px-3 py-1.5 text-xs font-semibold shrink-0 border-b-2 transition-all cursor-pointer ${
                    selectedCategory === "all"
                      ? "border-[#00A86B] text-[#00A86B]"
                      : "border-transparent text-[#6B7280] hover:text-[#1F2937]"
                  }`}
                >
                  All ({products.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 text-xs font-semibold shrink-0 border-b-2 transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? "border-[#00A86B] text-[#00A86B]"
                        : "border-transparent text-[#6B7280] hover:text-[#1F2937]"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Product List Rows */}
            <div className="divide-y divide-[#E5E7EB] max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
              {filteredProducts.map((product) => {
                const inTicket = ticketItems.find((it) => it.productId === product.id);

                return (
                  <div
                    key={product.id}
                    onClick={() => handleAddProduct(product)}
                    className={cn(
                      "py-3 px-2 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors cursor-pointer group select-none",
                      inTicket && "bg-[#F0FDF4]/60"
                    )}
                  >
                    {/* Left Details */}
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-12 w-12 rounded-md object-cover bg-stone-100 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-[#1F2937] truncate group-hover:text-[#00A86B] transition-colors">
                            {product.name}
                          </h3>
                          {product.popular && (
                            <span className="text-[9px] font-extrabold text-[#00A86B] uppercase tracking-wider">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#6B7280] truncate mt-0.5">
                          {product.description}
                        </p>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-mono text-xs font-bold text-[#1F2937]">
                        {formatPrice(product.price)}
                      </span>

                      {inTicket ? (
                        <div
                          className="flex items-center gap-1 bg-[#00A86B] text-white px-2 py-1 rounded text-xs font-bold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => updateQuantity(inTicket.id, -1)}
                            className="p-0.5 hover:bg-black/10 rounded"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-1">{inTicket.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(inTicket.id, 1)}
                            className="p-0.5 hover:bg-black/10 rounded"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="px-2.5 py-1 text-xs font-semibold text-[#00A86B] border border-[#00A86B] rounded hover:bg-[#00A86B] hover:text-white transition-colors"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT 30% COLUMN: REGISTER TICKET */}
          <div className="w-full lg:w-[30%] flex flex-col justify-between h-[calc(100vh-120px)] border-l border-[#E5E7EB] pl-0 lg:pl-6 sticky top-20">
            {/* Scrollable Order Details Container */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Ticket Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] sticky top-0 bg-white z-10 pt-1">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-[#00A86B]" />
                  <h2 className="font-bold text-sm text-[#1F2937] uppercase tracking-wider">
                    Current Order
                  </h2>
                </div>
                {ticketItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmClearTicketOpen(true)}
                    className="text-xs text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Customer & Dining Mode */}
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider block mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E5E7EB] rounded text-xs text-[#1F2937] focus:outline-none focus:border-[#00A86B]"
                  />
                </div>

                <div className="flex items-center border border-[#E5E7EB] rounded overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOrderType("DINE_IN")}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-bold transition-all text-center cursor-pointer",
                      orderType === "DINE_IN"
                        ? "bg-[#00A86B] text-white"
                        : "bg-white text-[#6B7280] hover:text-[#1F2937]"
                    )}
                  >
                    Dine-in
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("TAKEAWAY")}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-bold transition-all text-center cursor-pointer",
                      orderType === "TAKEAWAY"
                        ? "bg-[#00A86B] text-white"
                        : "bg-white text-[#6B7280] hover:text-[#1F2937]"
                    )}
                  >
                    Takeout
                  </button>
                </div>
              </div>

              {/* Ticket Items List */}
              <div className="divide-y divide-[#E5E7EB]">
                {ticketItems.length === 0 ? (
                  <div className="py-8 text-center text-[#6B7280]">
                    <Coffee className="h-6 w-6 mx-auto text-[#9CA3AF] mb-1" />
                    <p className="text-xs">No items selected</p>
                  </div>
                ) : (
                  ticketItems.map((item) => (
                    <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-[#1F2937] truncate">{item.product.name}</p>
                        <p className="text-[10px] text-[#6B7280]">
                          {item.quantity} x {formatPrice(item.unitPrice)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-[#1F2937]">
                          {formatPrice(item.lineTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-[#9CA3AF] hover:text-rose-600 p-0.5 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Order Notes */}
              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Order notes..."
                  className="w-full px-2.5 py-1.5 border border-[#E5E7EB] rounded text-xs text-[#1F2937] focus:outline-none focus:border-[#00A86B]"
                />
              </div>
            </div>

            {/* FIXED BOTTOM SECTION: Payment, Totals, and Charge Button */}
            <div className="shrink-0 pt-4 border-t border-[#E5E7EB] bg-white space-y-3">
              {/* Total Summary */}
              <div className="flex items-center justify-between text-xs pb-1 border-b border-[#E5E7EB]">
                <span className="font-semibold text-[#6B7280]">Total Amount</span>
                <span className="text-base font-extrabold font-mono text-[#00A86B]">
                  {formatPrice(ticketSubtotal)}
                </span>
              </div>

              {/* Payment Method Selector */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  className={cn(
                    "flex-1 py-1.5 border rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer",
                    paymentMethod === "CASH"
                      ? "border-[#00A86B] text-[#00A86B] bg-[#E6F6F0]"
                      : "border-[#E5E7EB] text-[#6B7280]"
                  )}
                >
                  <Banknote className="h-3.5 w-3.5" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("QRPH")}
                  className={cn(
                    "flex-1 py-1.5 border rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer",
                    paymentMethod === "QRPH"
                      ? "border-[#00A86B] text-[#00A86B] bg-[#E6F6F0]"
                      : "border-[#E5E7EB] text-[#6B7280]"
                  )}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>QR Ph</span>
                </button>
              </div>

              {/* Cash Calculator */}
              {paymentMethod === "CASH" && ticketSubtotal > 0 && (
                <div className="space-y-1.5 text-xs bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#6B7280] text-[11px]">Tendered</span>
                    <input
                      type="number"
                      value={cashTendered || ""}
                      onChange={(e) => setCashTendered(Number(e.target.value))}
                      placeholder={String(ticketSubtotal)}
                      className="w-20 text-right font-mono text-xs border border-[#E5E7EB] rounded px-1.5 py-0.5 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#00A86B]">
                    <span>Change</span>
                    <span className="font-mono">{formatPrice(changeDue)}</span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <p className="text-[11px] text-rose-600 font-medium">{errorMessage}</p>
              )}

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleChargeOrder}
                disabled={isSubmitting || ticketItems.length === 0}
                className={cn(
                  "w-full py-2.5 rounded font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer",
                  ticketItems.length === 0
                    ? "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
                    : "bg-[#00A86B] hover:bg-[#008F5B] text-white"
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {isSubmitting
                    ? "Processing..."
                    : `Charge ${formatPrice(ticketSubtotal)}`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* RECEIPT MODAL CONFIRMATION */}
        {lastChargedOrder && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl">
              <div className="h-12 w-12 rounded-full bg-[#E6F6F0] text-[#00A86B] mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#00A86B] font-bold uppercase">
                  Order Submitted
                </span>
                <h3 className="text-xl font-bold text-[#1F2937] font-mono mt-0.5">
                  {lastChargedOrder.orderNumber}
                </h3>
                <p className="text-xs text-[#6B7280] mt-1">
                  Customer: {lastChargedOrder.customerName} · {lastChargedOrder.orderType}
                </p>
              </div>

              <div className="bg-[#F9FAFB] p-3 rounded-lg border border-[#E5E7EB] text-left text-xs space-y-1.5">
                <div className="flex justify-between font-bold text-[#1F2937]">
                  <span>Total Paid:</span>
                  <span className="font-mono text-[#00A86B]">
                    {formatPrice(lastChargedOrder.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-[#6B7280] text-[11px]">
                  <span>Payment Method:</span>
                  <span>{lastChargedOrder.paymentMethod === "QRPH" ? "PayMongo QR Ph" : "Cash"}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLastChargedOrder(null)}
                className="w-full py-2 px-4 rounded bg-[#00A86B] hover:bg-[#008F5B] text-white font-bold text-xs transition-all cursor-pointer"
              >
                Next Order
              </button>
            </div>
          </div>
        )}

        {/* RECENT POS ORDERS MODAL */}
        {showRecentDrawer && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-[#00A86B]" />
                  <h3 className="font-bold text-sm text-[#1F2937]">Recent POS Orders</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecentDrawer(false)}
                  className="p-1 text-[#6B7280] hover:text-[#1F2937]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#E5E7EB] py-3">
                {recentOrders.length === 0 ? (
                  <p className="text-xs text-[#6B7280] text-center py-8">No recent orders found</p>
                ) : (
                  recentOrders.slice(0, 15).map((ord) => (
                    <div
                      key={ord.id}
                      className="py-2.5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#1F2937]">{ord.orderNumber}</span>
                          <Badge status={ord.status} className="scale-75 origin-left" />
                        </div>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">
                          {ord.customerName} · {ord.paymentMethod}
                        </p>
                      </div>

                      <span className="font-mono font-bold text-[#1F2937]">
                        {formatPrice(ord.totalAmount)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-[#E5E7EB] text-right">
                <button
                  type="button"
                  onClick={() => setShowRecentDrawer(false)}
                  className="px-4 py-1.5 rounded border border-[#E5E7EB] text-[#1F2937] text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRM CLEAR TICKET DIALOG */}
        <ConfirmDialog
          isOpen={isConfirmClearTicketOpen}
          title="Clear Register Ticket?"
          message="Are you sure you want to remove all items from this ticket?"
          confirmLabel="Clear Ticket"
          variant="danger"
          onConfirm={() => {
            clearTicket();
            setIsConfirmClearTicketOpen(false);
          }}
          onCancel={() => setIsConfirmClearTicketOpen(false)}
        />

        {/* CONFIRM CHARGE ORDER DIALOG */}
        <ConfirmDialog
          isOpen={isConfirmChargeOpen}
          title={paymentMethod === "CASH" ? "Confirm Cash Collection?" : "Confirm Order Charge?"}
          message={
            paymentMethod === "CASH"
              ? `Confirm cash collection for ${customerName}: Total ${formatPrice(ticketSubtotal)}${
                  cashTendered > 0 ? `, Tendered ${formatPrice(cashTendered)}` : ""
                }.`
              : `Confirm charge for ${customerName} totaling ${formatPrice(ticketSubtotal)} via QR Ph?`
          }
          confirmLabel={isSubmitting ? "Processing..." : "Confirm & Send"}
          variant="primary"
          isLoading={isSubmitting}
          onConfirm={executeChargeOrder}
          onCancel={() => setIsConfirmChargeOpen(false)}
        />
      </StaffLayout>
    </StaffGuard>
  );
}