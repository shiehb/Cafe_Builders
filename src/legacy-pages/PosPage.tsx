import React, { useState, useEffect, useMemo } from "react";
import { StaffGuard } from "../components/staff/StaffGuard";
import { StaffLayout } from "../components/staff/StaffLayout";
import { Product, Category, CartItem, Order, OrderType, PaymentMethod } from "../types";
import { CATEGORIES, PRODUCTS } from "../data/menuData";
import { formatPrice, cn } from "../lib/utils";
import {
  CreditCard,
  Banknote,
  QrCode,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Receipt,
  RotateCcw,
  Sparkles,
  Coffee,
  X,
  User,
  ShoppingBag,
  Clock,
  ArrowRight,
} from "lucide-react";
import { playOrderChime } from "../lib/audio";
import { emitLocalOrderEvent } from "../lib/realtime";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

export function PosPage() {
  const [categories] = useState<Category[]>(CATEGORIES);
  const [products] = useState<Product[]>(PRODUCTS);
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

  // Recent Orders Drawer / Modal
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [showRecentDrawer, setShowRecentDrawer] = useState<boolean>(false);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
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
        // If paid in cash directly at POS, immediately update status to PREPARING
        if (paymentMethod === "CASH") {
          try {
            await fetch(`/api/orders/${data.order.id}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "PREPARING" }),
            });
            data.order.status = "PREPARING";
          } catch {
            // ignore
          }
        }

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
      defaultPin="1234"
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
          {/* LEFT 7-8 COLS: PRODUCT CATALOG */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col space-y-4">
            {/* Search & Categories */}
            <div className="bg-white/80 border border-[#E5E7EB] rounded-2xl p-3.5 space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search drinks, espresso, matcha, pastries..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#6B7280] text-sm focus:outline-none focus:border-[#00A86B]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#374151]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    selectedCategory === "all"
                      ? "bg-[#00A86B] text-white shadow-xs"
                      : "bg-[#F7F9FA] text-[#6B7280] hover:text-[#1F2937] hover:bg-stone-700"
                  }`}
                >
                  All Items ({products.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedCategory === cat.id
                        ? "bg-[#00A86B] text-white shadow-xs"
                        : "bg-[#F7F9FA] text-[#6B7280] hover:text-[#1F2937] hover:bg-stone-700"
                    }`}
                  >
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Product Quick-Tap Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredProducts.map((product) => {
                const isSelectedInTicket = ticketItems.some((it) => it.productId === product.id);

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleAddProduct(product)}
                    className={cn(
                      "p-3 rounded-2xl bg-white/90 border border-[#E5E7EB]/90 hover:border-[#00A86B]/60 text-left flex flex-col justify-between transition-all active:scale-98 cursor-pointer group shadow-sm hover:shadow-md",
                      isSelectedInTicket && "ring-1 ring-[#00A86B] bg-white"
                    )}
                  >
                    <div>
                      <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-white mb-2 border border-[#E5E7EB]/60">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {product.popular && (
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#00A86B] text-white text-[9px] font-extrabold uppercase">
                            Best Seller
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-xs text-[#1F2937] line-clamp-1 group-hover:text-[#00A86B] transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-[10px] text-[#6B7280] line-clamp-1 mt-0.5">
                        {product.description}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[#E5E7EB]/60 flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-white">
                        {formatPrice(product.price)}
                      </span>
                      <span className="h-6 w-6 rounded-lg bg-[#F7F9FA] group-hover:bg-[#00A86B] group-hover:text-white text-[#374151] flex items-center justify-center transition-all">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT 4-5 COLS: CASHIER REGISTER TICKET */}
          <div className="lg:col-span-5 xl:col-span-4 bg-white border border-[#E5E7EB] rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xl min-h-[600px] sticky top-20">
            <div className="space-y-4">
              {/* Ticket Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-[#00A86B]" />
                  <h2 className="font-black text-sm tracking-tight text-white uppercase">
                    Register Ticket
                  </h2>
                </div>
                {ticketItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmClearTicketOpen(true)}
                    title="Clear Register Ticket"
                    aria-label="Clear Register Ticket"
                    className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Customer & Dining Type */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider block mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Guest / Order #"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-[#1F2937] text-xs focus:outline-none focus:border-[#00A86B]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider block mb-1">
                    Dining Mode
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-[#E5E7EB]">
                    <button
                      type="button"
                      onClick={() => setOrderType("DINE_IN")}
                      className={cn(
                        "py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all text-center",
                        orderType === "DINE_IN"
                          ? "bg-[#F7F9FA] text-white"
                          : "text-[#6B7280] hover:text-[#1F2937]"
                      )}
                    >
                      Dine-in
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType("TAKEAWAY")}
                      className={cn(
                        "py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all text-center",
                        orderType === "TAKEAWAY"
                          ? "bg-[#F7F9FA] text-white"
                          : "text-[#6B7280] hover:text-[#1F2937]"
                      )}
                    >
                      Takeout
                    </button>
                  </div>
                </div>
              </div>

              {/* Itemized Order List */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {ticketItems.length === 0 ? (
                  <div className="py-12 text-center text-[#6B7280] border border-dashed border-[#E5E7EB] rounded-2xl">
                    <Coffee className="h-8 w-8 mx-auto text-[#9CA3AF] mb-1" />
                    <p className="text-xs font-semibold">Register is empty</p>
                    <p className="text-[10px] text-[#6B7280] mt-0.5">
                      Tap menu items on the left to add
                    </p>
                  </div>
                ) : (
                  ticketItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-white/80 border border-[#E5E7EB]/80 flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-[#1F2937] truncate">
                          {item.product.name}
                        </h4>
                        <span className="text-[10px] font-mono text-[#6B7280]">
                          {formatPrice(item.unitPrice)} each
                        </span>
                      </div>

                      {/* Quantity buttons */}
                      <div className="flex items-center gap-1 bg-white border border-[#E5E7EB] rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="h-6 w-6 rounded flex items-center justify-center text-[#6B7280] hover:text-white cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-mono font-bold text-white px-1">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="h-6 w-6 rounded flex items-center justify-center text-[#6B7280] hover:text-white cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Line total & remove */}
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold font-mono text-white block">
                          {formatPrice(item.lineTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-[10px] text-[#6B7280] hover:text-rose-400 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Special Order Notes */}
              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Order note (e.g. VIP guest, less foam, rushed)..."
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-[#1F2937] text-xs placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#00A86B]"
                />
              </div>
            </div>

            {/* Payment & Checkout Box */}
            <div className="mt-4 pt-4 border-t border-[#E5E7EB] space-y-3">
              {/* Subtotal / Total Display */}
              <div className="bg-white p-3 rounded-2xl border border-[#E5E7EB] flex items-center justify-between">
                <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">
                  Amount Due
                </span>
                <span className="text-xl font-black font-mono text-[#00A86B]">
                  {formatPrice(ticketSubtotal)}
                </span>
              </div>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  className={cn(
                    "p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer",
                    paymentMethod === "CASH"
                      ? "bg-emerald-950/60 border-emerald-500 text-emerald-400 ring-1 ring-emerald-500/40"
                      : "bg-white border-[#E5E7EB] text-[#6B7280] hover:text-[#1F2937]"
                  )}
                >
                  <Banknote className="h-4 w-4" />
                  <span>Cash Tendered</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("QRPH")}
                  className={cn(
                    "p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer",
                    paymentMethod === "QRPH"
                      ? "bg-[#00A86B]/20 border-[#00A86B] text-[#00A86B] ring-1 ring-[#00A86B]/40"
                      : "bg-white border-[#E5E7EB] text-[#6B7280] hover:text-[#1F2937]"
                  )}
                >
                  <QrCode className="h-4 w-4" />
                  <span>PayMongo QR Ph</span>
                </button>
              </div>

              {/* Cash Change Quick Calculator */}
              {paymentMethod === "CASH" && ticketSubtotal > 0 && (
                <div className="bg-white/90 p-3 rounded-2xl border border-[#E5E7EB] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#6B7280] text-[11px] font-medium">Quick Cash Preset:</span>
                    <div className="flex gap-1">
                      {[ticketSubtotal, 200, 500, 1000].map((amt) => {
                        if (amt < ticketSubtotal && amt !== ticketSubtotal) return null;
                        return (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setCashTendered(amt)}
                            className="px-2 py-0.5 rounded bg-white hover:bg-[#F7F9FA] text-[#374151] font-mono text-[10px] font-bold border border-[#E5E7EB] cursor-pointer"
                          >
                            ₱{amt}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#E5E7EB]/60">
                    <span className="text-[#6B7280]">Tendered:</span>
                    <input
                      type="number"
                      value={cashTendered || ""}
                      onChange={(e) => setCashTendered(Number(e.target.value))}
                      placeholder={String(ticketSubtotal)}
                      className="w-24 text-right font-mono font-bold text-white bg-white px-2 py-1 rounded border border-[#D1D5DB] text-xs focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span>Change Due:</span>
                    <span className="font-mono text-sm">{formatPrice(changeDue)}</span>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 font-medium">
                  {errorMessage}
                </div>
              )}

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleChargeOrder}
                disabled={isSubmitting || ticketItems.length === 0}
                className={cn(
                  "w-full py-3.5 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98",
                  ticketItems.length === 0
                    ? "bg-[#F7F9FA] text-[#6B7280] cursor-not-allowed"
                    : "bg-[#00A86B] hover:bg-emerald-600 text-white shadow-[#00A86B]/20"
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {isSubmitting
                    ? "Submitting to Kitchen..."
                    : `Charge & Send to Kitchen (${formatPrice(ticketSubtotal)})`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* RECEIPT MODAL CONFIRMATION */}
        {lastChargedOrder && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E5E7EB] rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center shadow-lg">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#00A86B] font-bold uppercase">
                  Order Successfully Sent to KDS
                </span>
                <h3 className="text-2xl font-black text-white font-mono mt-0.5">
                  {lastChargedOrder.orderNumber}
                </h3>
                <p className="text-xs text-[#6B7280] mt-1">
                  Customer: {lastChargedOrder.customerName} · {lastChargedOrder.orderType}
                </p>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-[#E5E7EB] text-left text-xs space-y-1.5">
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
                <div className="flex justify-between text-[#6B7280] text-[11px]">
                  <span>Items:</span>
                  <span>{lastChargedOrder.items.length} items</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLastChargedOrder(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#00A86B] hover:bg-emerald-600 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Start Next Order
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RECENT POS ORDERS MODAL */}
        {showRecentDrawer && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E5E7EB] rounded-3xl max-w-lg w-full max-h-[80vh] flex flex-col p-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-[#00A86B]" />
                  <h3 className="font-black text-sm text-white">Recent POS Orders</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecentDrawer(false)}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 py-3">
                {recentOrders.length === 0 ? (
                  <p className="text-xs text-[#6B7280] text-center py-8">No recent orders found</p>
                ) : (
                  recentOrders.slice(0, 15).map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white">{ord.orderNumber}</span>
                          <Badge status={ord.status} className="scale-75 origin-left" />
                        </div>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">
                          {ord.customerName} · {ord.paymentMethod} · {ord.items.length} items
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-white block">
                          {formatPrice(ord.totalAmount)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-[#E5E7EB] text-right">
                <button
                  type="button"
                  onClick={() => setShowRecentDrawer(false)}
                  className="px-4 py-2 rounded-xl bg-[#F7F9FA] hover:bg-stone-700 text-[#1F2937] text-xs font-semibold"
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
          message="Are you sure you want to remove all items from this customer's register ticket?"
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
              ? `Confirm cash collection for ${customerName}: Order Total ${formatPrice(ticketSubtotal)}${
                  cashTendered > 0
                    ? `, Tendered ${formatPrice(cashTendered)}, Change Due ${formatPrice(changeDue)}`
                    : ""
                }. Send order directly to kitchen?`
              : `Confirm sending order for ${customerName} totaling ${formatPrice(ticketSubtotal)} via QR Ph?`
          }
          confirmLabel={isSubmitting ? "Processing..." : "Confirm & Send to Kitchen"}
          variant="primary"
          isLoading={isSubmitting}
          onConfirm={executeChargeOrder}
          onCancel={() => setIsConfirmChargeOpen(false)}
        />
      </StaffLayout>
    </StaffGuard>
  );
}
