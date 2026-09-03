import React, { useState, useEffect, useMemo, useCallback } from "react";
import { StaffGuard } from "../components/staff/StaffGuard";
import { StaffLayout } from "../components/staff/StaffLayout";
import { Order, OrderStatus, Product } from "../types";
import { PRODUCTS, CATEGORIES } from "../data/menuData";
import { formatPrice, formatDateTime, cn } from "../lib/utils";
import { Badge } from "../components/ui/Badge";
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  KeyRound,
  Copy,
  Check,
  ShieldCheck,
  Coffee,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Pencil,
  Flame,
  X,
  Layers,
  Sparkles,
  SlidersHorizontal,
  Lock,
} from "lucide-react";
import {
  useKitchenRealtime,
  emitLocalOrderEvent,
  useProductInventoryRealtime,
  emitLocalProductEvent,
} from "../lib/realtime";
import { logoutAdminSession } from "../lib/auth";
import { navigate } from "../lib/router";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Plus } from "lucide-react";

export function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpdatingProduct, setIsUpdatingProduct] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [copiedUrlKey, setCopiedUrlKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "menu" | "access">("orders");

  // Menu Management State
  const [productSearch, setProductSearch] = useState<string>("");
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"ALL" | "IN_STOCK" | "SOLD_OUT">("ALL");

  // Price & Details Editor Modal State
  const [productToToggle, setProductToToggle] = useState<{ product: Product; nextAvailable: boolean } | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    price: number | string;
    description: string;
    popular: boolean;
  }>({
    name: "",
    price: 0,
    description: "",
    popular: false,
  });

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(
    null
  );

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load admin orders", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
          setProducts(data.data);
        }
      }
    } catch (err) {
      console.warn("Failed to load admin products from server, using local store:", err);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, [fetchOrders, fetchProducts]);

  // Real-time kitchen order updates
  useKitchenRealtime(
    useCallback(
      ({ order }: { event: string; order: Order }) => {
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === order.id);
          if (exists) {
            return prev.map((o) => (o.id === order.id ? order : o));
          }
          return [order, ...prev];
        });
      },
      []
    )
  );

  // Real-time product inventory updates from server/SSE/other admin terminals
  useProductInventoryRealtime(
    useCallback((updatedProduct: Product) => {
      if (!updatedProduct || !updatedProduct.id) return;
      setProducts((prev) =>
        prev.map((p) => (p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p))
      );
    }, [])
  );

  // Status update for order
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.order || { id: orderId, status: nextStatus };
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
        );
        emitLocalOrderEvent("order_status_updated", updated);
      }
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  // Toggle product availability (In Stock / Sold Out 86'd)
  const toggleProductAvailability = async (product: Product) => {
    const nextAvailable = !product.isAvailable;
    setIsUpdatingProduct(product.id);

    // Optimistically update UI
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isAvailable: nextAvailable } : p))
    );
    emitLocalProductEvent({ ...product, isAvailable: nextAvailable });

    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: nextAvailable }),
      });

      if (!res.ok) {
        throw new Error("Server rejected inventory toggle");
      }

      const data = await res.json();
      if (data?.product) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? data.product : p))
        );
      }

      showToast(
        `${product.name} is now ${nextAvailable ? "IN STOCK" : "86'd (SOLD OUT)"}`,
        "success"
      );
    } catch (err) {
      console.error("Failed to update product availability", err);
      // Revert optimistic update
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isAvailable: product.isAvailable } : p))
      );
      emitLocalProductEvent(product);
      showToast(`Failed to update ${product.name}. Check admin session.`, "error");
    } finally {
      setIsUpdatingProduct(null);
    }
  };

  // Open Edit Modal for a Product
  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      price: product.price,
      description: product.description || "",
      popular: Boolean(product.popular),
    });
  };

  // Save Product Price & Details
  const handleSaveProductDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const parsedPrice = Number(editForm.price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      showToast("Please enter a valid price in PHP.", "error");
      return;
    }

    setIsUpdatingProduct(editingProduct.id);

    try {
      const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          price: parsedPrice,
          description: editForm.description.trim(),
          popular: editForm.popular,
        }),
      });

      if (!res.ok) {
        throw new Error("Server rejected product update");
      }

      const data = await res.json();
      const updated = data?.product || {
        ...editingProduct,
        name: editForm.name.trim(),
        price: parsedPrice,
        description: editForm.description.trim(),
        popular: editForm.popular,
      };

      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? updated : p))
      );
      emitLocalProductEvent(updated);
      setEditingProduct(null);
      showToast(`Updated details for "${updated.name}"`, "success");
    } catch (err) {
      console.error("Failed to save product details:", err);
      showToast("Could not save changes. Please try again.", "error");
    } finally {
      setIsUpdatingProduct(null);
    }
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalGross = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const completedOrders = orders.filter((o) => o.status === "COMPLETED");
    const activeOrders = orders.filter(
      (o) => o.status === "PENDING_PAYMENT" || o.status === "PREPARING" || o.status === "READY"
    );
    const qrPhOrders = orders.filter((o) => o.paymentMethod === "QRPH");
    const cashOrders = orders.filter((o) => o.paymentMethod === "CASH");
    const avgTicket = orders.length > 0 ? totalGross / orders.length : 0;

    return {
      totalGross,
      totalOrders: orders.length,
      completedCount: completedOrders.length,
      activeCount: activeOrders.length,
      qrPhPercentage: orders.length > 0 ? Math.round((qrPhOrders.length / orders.length) * 100) : 0,
      cashPercentage: orders.length > 0 ? Math.round((cashOrders.length / orders.length) * 100) : 0,
      avgTicket,
    };
  }, [orders]);

  // Product Inventory Metrics
  const productMetrics = useMemo(() => {
    const total = products.length;
    const inStock = products.filter((p) => p.isAvailable).length;
    const soldOut = total - inStock;
    const popular = products.filter((p) => p.popular).length;
    return { total, inStock, soldOut, popular };
  }, [products]);

  // Filtered products for inventory management
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !productSearch.trim() ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(productSearch.toLowerCase()));

      const matchCategory =
        selectedMenuCategory === "all" ||
        p.categoryId === selectedMenuCategory ||
        p.categoryName === selectedMenuCategory;

      const matchStock =
        stockFilter === "ALL" ||
        (stockFilter === "IN_STOCK" && p.isAvailable) ||
        (stockFilter === "SOLD_OUT" && !p.isAvailable);

      return matchSearch && matchCategory && matchStock;
    });
  }, [products, productSearch, selectedMenuCategory, stockFilter]);

  // Group filtered products by category name
  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filteredProducts) {
      const catKey = p.categoryName || p.categoryId || "General Items";
      if (!map.has(catKey)) {
        map.set(catKey, []);
      }
      map.get(catKey)!.push(p);
    }
    return map;
  }, [filteredProducts]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        !searchQuery.trim() ||
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.customerName && o.customerName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === "ALL" || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  // Copy Secret URL helper
  const handleCopySecretUrl = (key: string, path: string, pin: string) => {
    const fullUrl = `${window.location.origin}${path}?pin=${pin}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrlKey(key);
    setTimeout(() => setCopiedUrlKey(null), 2500);
  };

  return (
    <StaffGuard
      pinEnvKey="ADMIN_PIN"
      title="Store Manager Admin"
      subtitle="Enter 4-digit PIN to access store analytics and management"
      roleName="Store Manager Terminal"
      defaultPin="9999"
    >
      <StaffLayout
        activeTab="admin"
        title="Store Manager Admin"
        subtitle="Sales analytics, live order audit, 86'd menu manager, and terminal PIN credentials"
        pinEnvKey="ADMIN_PIN"
        headerRight={
          <button
            type="button"
            onClick={fetchOrders}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white hover:bg-[#F7F9FA] text-[#374151] border border-[#E5E7EB] transition-all cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin text-[#00A86B]")} />
          </button>
        }
      >
        <div className="space-y-6">
          {/* TOP METRICS CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Metric 1: Total Revenue */}
            <div className="bg-white border border-[#E5E7EB]/90 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#6B7280] mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Gross Sales</span>
                <span className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <DollarSign className="h-4 w-4" />
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-[#1F2937] tracking-tight">
                {formatPrice(metrics.totalGross)}
              </div>
              <p className="text-[10px] text-[#6B7280] mt-1">Across {metrics.totalOrders} total orders</p>
            </div>

            {/* Metric 2: Active Orders */}
            <div className="bg-white border border-[#E5E7EB]/90 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#6B7280] mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Active Queue</span>
                <span className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-amber-400 tracking-tight">
                {metrics.activeCount}
              </div>
              <p className="text-[10px] text-[#6B7280] mt-1">In kitchen or pending payment</p>
            </div>

            {/* Metric 3: Completed Orders */}
            <div className="bg-white border border-[#E5E7EB]/90 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#6B7280] mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Completed</span>
                <span className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-[#1F2937] tracking-tight">
                {metrics.completedCount}
              </div>
              <p className="text-[10px] text-[#6B7280] mt-1">Served and closed</p>
            </div>

            {/* Metric 4: Avg Ticket */}
            <div className="bg-white border border-[#E5E7EB]/90 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#6B7280] mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Avg Ticket</span>
                <span className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-[#1F2937] tracking-tight">
                {formatPrice(metrics.avgTicket)}
              </div>
              <p className="text-[10px] text-[#6B7280] mt-1">
                QR Ph: {metrics.qrPhPercentage}% | Cash: {metrics.cashPercentage}%
              </p>
            </div>
          </div>

          {/* TAB SELECTOR */}
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                activeTab === "orders"
                  ? "bg-[#00A86B] text-white border border-[#D1D5DB] shadow-xs"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              )}
            >
              Order Audit Log ({orders.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("menu")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === "menu"
                  ? "bg-[#00A86B] text-white border border-[#D1D5DB] shadow-xs"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Inventory & Menu ({products.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("access")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === "access"
                  ? "bg-[#00A86B]/20 text-[#00A86B] border border-[#00A86B]/40 shadow-xs"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              )}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Terminal Passcodes & Secret URLs</span>
            </button>
          </div>

          {/* TAB 1: ORDER AUDIT LOG */}
          {activeTab === "orders" && (
            <div className="bg-white border border-[#E5E7EB] rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm">
              {/* Filter & Search */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6B7280]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Order # or Customer..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-[#1F2937] text-xs focus:outline-none focus:border-[#00A86B]"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  {["ALL", "PENDING_PAYMENT", "PREPARING", "READY", "COMPLETED"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer",
                        statusFilter === st
                          ? "bg-[#00A86B] text-white"
                          : "bg-[#F7F9FA]/80 text-[#6B7280] hover:text-[#1F2937]"
                      )}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orders Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#374151]">
                  <thead className="bg-white text-[#6B7280] uppercase text-[10px] tracking-wider border-b border-[#E5E7EB]">
                    <tr>
                      <th className="py-2.5 px-3">Order #</th>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]/60 font-medium">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-[#6B7280]">
                          No orders matched your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-white/40 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-[#1F2937]">
                            {ord.orderNumber}
                          </td>
                          <td className="py-3 px-3 text-[#6B7280] text-[11px]">
                            {formatDateTime(ord.createdAt)}
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[#1F2937] font-semibold">{ord.customerName}</span>
                            <span className="block text-[10px] text-[#6B7280]">
                              {ord.orderType} · {ord.items.length} items
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[11px]">
                            {ord.paymentMethod === "QRPH" ? (
                              <span className="text-emerald-400 font-semibold">PayMongo QR Ph</span>
                            ) : (
                              <span className="text-[#374151]">Cash</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <Badge status={ord.status} className="scale-85 origin-left" />
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-[#1F2937]">
                            {formatPrice(ord.totalAmount)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {ord.status !== "COMPLETED" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(ord.id, "COMPLETED")}
                                  className="px-2 py-0.5 rounded bg-[#F7F9FA] hover:bg-emerald-600 hover:text-[#1F2937] text-[10px] font-bold text-[#374151] cursor-pointer transition-colors"
                                >
                                  Complete
                                </button>
                              )}
                              {ord.status === "COMPLETED" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(ord.id, "READY")}
                                  className="px-2 py-0.5 rounded bg-[#F7F9FA] hover:bg-[#E6F6F0] text-[10px] text-[#6B7280] cursor-pointer"
                                >
                                  Reopen
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY & MENU MANAGEMENT */}
          {activeTab === "menu" && (
            <div className="space-y-6">
              {/* Header & Quick Action Bar */}
              <div className="bg-white border border-[#E5E7EB] rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                        <Coffee className="h-4 w-4" />
                      </span>
                      <h3 className="font-black text-base text-[#1F2937]">Live Inventory & Menu Management</h3>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-1">
                      Toggle item availability in real-time or update pricing. All changes broadcast immediately to Customer Menu, POS, and KDS terminals.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => navigate("/admin/products/new")}
                      className="px-3.5 py-1.5 rounded-xl bg-[#00A86B] hover:bg-emerald-600 text-black text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Product</span>
                    </button>
                    <button
                      type="button"
                      onClick={fetchProducts}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F7F9FA] text-[#374151] text-xs font-semibold border border-[#E5E7EB] flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-[#00A86B]" />
                      <span>Sync</span>
                    </button>
                  </div>
                </div>

                {/* Real-time Inventory Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-white/80 border border-[#E5E7EB]/80 rounded-2xl p-3">
                    <span className="text-[10px] uppercase font-bold text-[#6B7280] block">Total Items</span>
                    <span className="text-xl font-black font-mono text-[#1F2937]">{productMetrics.total}</span>
                    <span className="text-[10px] text-[#6B7280] block mt-0.5">Active catalogue SKUs</span>
                  </div>

                  <div className="bg-white/80 border border-[#E5E7EB]/80 rounded-2xl p-3">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block">In Stock</span>
                    <span className="text-xl font-black font-mono text-emerald-400">{productMetrics.inStock}</span>
                    <span className="text-[10px] text-[#6B7280] block mt-0.5">Orderable by customers</span>
                  </div>

                  <div className="bg-white/80 border border-[#E5E7EB]/80 rounded-2xl p-3">
                    <span className="text-[10px] uppercase font-bold text-rose-400 block">86'd / Sold Out</span>
                    <span className="text-xl font-black font-mono text-rose-400">{productMetrics.soldOut}</span>
                    <span className="text-[10px] text-[#6B7280] block mt-0.5">Disabled on customer menu</span>
                  </div>

                  <div className="bg-white/80 border border-[#E5E7EB]/80 rounded-2xl p-3">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block">Featured / Popular</span>
                    <span className="text-xl font-black font-mono text-amber-400">{productMetrics.popular}</span>
                    <span className="text-[10px] text-[#6B7280] block mt-0.5">Highlighted on home carousel</span>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="pt-2 border-t border-[#E5E7EB]/80 flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                    <input
                      type="text"
                      placeholder="Search menu items by name or description..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:border-[#00A86B]"
                    />
                    {productSearch && (
                      <button
                        type="button"
                        onClick={() => setProductSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#374151]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Stock Availability Quick Filter */}
                  <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#E5E7EB]">
                    <button
                      type="button"
                      onClick={() => setStockFilter("ALL")}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        stockFilter === "ALL"
                          ? "bg-[#00A86B] text-white shadow-xs"
                          : "text-[#6B7280] hover:text-[#1F2937]"
                      )}
                    >
                      All ({products.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockFilter("IN_STOCK")}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                        stockFilter === "IN_STOCK"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "text-[#6B7280] hover:text-[#1F2937]"
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                      <span>In Stock ({productMetrics.inStock})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockFilter("SOLD_OUT")}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                        stockFilter === "SOLD_OUT"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : "text-[#6B7280] hover:text-[#1F2937]"
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                      <span>86'd ({productMetrics.soldOut})</span>
                    </button>
                  </div>
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedMenuCategory("all")}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                      selectedMenuCategory === "all"
                        ? "bg-[#00A86B] text-black font-extrabold shadow-sm"
                        : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:text-[#1F2937]"
                    )}
                  >
                    All Categories
                  </button>
                  {CATEGORIES.map((cat) => {
                    const count = products.filter(
                      (p) => p.categoryId === cat.id || p.categoryName === cat.name
                    ).length;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedMenuCategory(cat.id)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5",
                          selectedMenuCategory === cat.id
                            ? "bg-[#00A86B] text-black font-extrabold shadow-sm"
                            : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:text-[#1F2937]"
                        )}
                      >
                        <span>{cat.name}</span>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded-full",
                            selectedMenuCategory === cat.id
                              ? "bg-black/20 text-black font-mono font-bold"
                              : "bg-white text-[#6B7280] font-mono"
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grouped Product Listings */}
              {Array.from(productsByCategory.entries()).length === 0 ? (
                <div className="p-12 text-center bg-white border border-[#E5E7EB] rounded-3xl space-y-3">
                  <Coffee className="h-8 w-8 text-[#9CA3AF] mx-auto" />
                  <p className="text-sm font-bold text-[#374151]">No items match your filter</p>
                  <p className="text-xs text-[#6B7280]">
                    Try changing your search terms or category selection.
                  </p>
                </div>
              ) : (
                Array.from(productsByCategory.entries()).map(([categoryName, items]) => (
                  <div key={categoryName} className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <Layers className="h-4 w-4 text-[#00A86B]" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#374151]">
                        {categoryName} ({items.length})
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3.5 relative",
                            item.isAvailable
                              ? "bg-white/90 border-[#E5E7EB]/90 shadow-xs"
                              : "bg-white/70 border-rose-950/50 opacity-90"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative shrink-0">
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className={cn(
                                  "h-16 w-16 rounded-xl object-cover bg-white border border-[#E5E7EB] shrink-0",
                                  !item.isAvailable && "grayscale brightness-75"
                                )}
                              />
                              {item.popular && (
                                <span
                                  className="absolute -top-1.5 -right-1.5 bg-amber-500 text-[#1F2937] p-1 rounded-full shadow-xs"
                                  title="Featured Popular Item"
                                >
                                  <Flame className="h-3 w-3 fill-stone-950" />
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <h5 className="text-sm font-bold text-[#1F2937] truncate leading-tight">
                                  {item.name}
                                </h5>
                              </div>
                              <span className="text-xs font-mono font-bold text-[#00A86B] block mt-0.5">
                                {formatPrice(item.price)}
                              </span>
                              {item.description && (
                                <p className="text-[11px] text-[#6B7280] line-clamp-2 mt-1 leading-relaxed">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Control Footer */}
                          <div className="pt-3 border-t border-[#E5E7EB]/80 flex items-center justify-between gap-2">
                            {/* Interactive Availability Toggle Switch */}
                            <button
                              type="button"
                              role="switch"
                              aria-checked={item.isAvailable}
                              disabled={isUpdatingProduct === item.id}
                              onClick={() =>
                                setProductToToggle({
                                  product: item,
                                  nextAvailable: !item.isAvailable,
                                })
                              }
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                                item.isAvailable
                                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30"
                              )}
                            >
                              {/* Sliding Toggle Pill Indicator */}
                              <div
                                className={cn(
                                  "w-8 h-4.5 rounded-full p-0.5 transition-colors relative flex items-center shrink-0",
                                  item.isAvailable ? "bg-emerald-500" : "bg-stone-700"
                                )}
                              >
                                <div
                                  className={cn(
                                    "w-3.5 h-3.5 rounded-full bg-white transition-transform transform shadow-xs",
                                    item.isAvailable ? "translate-x-3.5" : "translate-x-0"
                                  )}
                                />
                              </div>
                              <span>
                                {isUpdatingProduct === item.id
                                  ? "Updating..."
                                  : item.isAvailable
                                  ? "In Stock"
                                  : "86'd (Sold Out)"}
                              </span>
                            </button>

                            {/* Edit Price & Details Button */}
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/products/${item.id}/edit`)}
                              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#F7F9FA] text-[#374151] text-xs font-semibold border border-[#E5E7EB] flex items-center gap-1.5 transition-all cursor-pointer"
                              title="Edit item price & details"
                            >
                              <Pencil className="h-3.5 w-3.5 text-[#6B7280]" />
                              <span className="hidden sm:inline">Edit Details</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: PASSCODES & SECRET URLS */}
          {activeTab === "access" && (
            <div className="bg-white border border-[#E5E7EB] rounded-3xl p-4 sm:p-5 space-y-5 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#00A86B]" />
                  <h3 className="font-black text-sm text-[#1F2937]">Staff Terminal Passcode Security</h3>
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Terminals are protected by 4-digit PIN access guards. You can also generate direct Secret URLs for hardware tablets or bookmarks.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* KDS Access */}
                <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1F2937] uppercase tracking-wider">
                      🍳 Kitchen KDS
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#6B7280] border border-[#E5E7EB]">
                      KDS_PIN
                    </span>
                  </div>

                  <div className="bg-white/90 p-2.5 rounded-xl border border-[#E5E7EB] flex items-center justify-between">
                    <span className="text-[11px] text-[#6B7280] font-medium">Terminal PIN:</span>
                    <strong className="font-mono text-base text-emerald-400">1234</strong>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider font-bold block">
                      Secret URL for kitchen tablets:
                    </label>
                    <button
                      type="button"
                      onClick={() => handleCopySecretUrl("kds", "/kds", "1234")}
                      className="w-full py-2 px-3 rounded-xl bg-white hover:bg-[#F7F9FA] text-[#374151] text-xs font-mono font-medium border border-[#E5E7EB] flex items-center justify-between cursor-pointer transition-all"
                    >
                      <span className="truncate">/kds?pin=1234</span>
                      {copiedUrlKey === "kds" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-[#6B7280] shrink-0" />
                      )}
                    </button>
                  </div>
                </div>

                {/* POS Access */}
                <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1F2937] uppercase tracking-wider">
                      💳 Cashier POS
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#6B7280] border border-[#E5E7EB]">
                      POS_PIN
                    </span>
                  </div>

                  <div className="bg-white/90 p-2.5 rounded-xl border border-[#E5E7EB] flex items-center justify-between">
                    <span className="text-[11px] text-[#6B7280] font-medium">Terminal PIN:</span>
                    <strong className="font-mono text-base text-emerald-400">1234</strong>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider font-bold block">
                      Secret URL for cashier counter:
                    </label>
                    <button
                      type="button"
                      onClick={() => handleCopySecretUrl("pos", "/pos", "1234")}
                      className="w-full py-2 px-3 rounded-xl bg-white hover:bg-[#F7F9FA] text-[#374151] text-xs font-mono font-medium border border-[#E5E7EB] flex items-center justify-between cursor-pointer transition-all"
                    >
                      <span className="truncate">/pos?pin=1234</span>
                      {copiedUrlKey === "pos" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-[#6B7280] shrink-0" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Admin Access */}
                <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1F2937] uppercase tracking-wider">
                      📊 Manager Admin
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#6B7280] border border-[#E5E7EB]">
                      ADMIN_PIN
                    </span>
                  </div>

                  <div className="bg-white/90 p-2.5 rounded-xl border border-[#E5E7EB] flex items-center justify-between">
                    <span className="text-[11px] text-[#6B7280] font-medium">Terminal PIN:</span>
                    <strong className="font-mono text-base text-purple-400">9999</strong>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider font-bold block">
                      Secret URL for manager device:
                    </label>
                    <button
                      type="button"
                      onClick={() => handleCopySecretUrl("admin", "/admin", "9999")}
                      className="w-full py-2 px-3 rounded-xl bg-white hover:bg-[#F7F9FA] text-[#374151] text-xs font-mono font-medium border border-[#E5E7EB] flex items-center justify-between cursor-pointer transition-all"
                    >
                      <span className="truncate">/admin?pin=9999</span>
                      {copiedUrlKey === "admin" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-[#6B7280] shrink-0" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </StaffLayout>

      {/* PRICE & DETAILS EDITOR MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#00A86B]/10 text-[#00A86B]">
                  <Pencil className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-black text-base text-[#1F2937]">Edit Menu Item</h3>
                  <p className="text-[11px] text-[#6B7280] font-mono">ID: {editingProduct.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1.5 rounded-xl text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F7F9FA] transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProductDetails} className="space-y-4">
              {/* Product Preview Header */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-[#E5E7EB]">
                <img
                  src={editingProduct.imageUrl}
                  alt={editingProduct.name}
                  className="h-12 w-12 rounded-xl object-cover bg-white shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-[#6B7280]">
                    {editingProduct.categoryName || "Specialty"}
                  </span>
                  <p className="text-xs font-bold text-[#1F2937] truncate">
                    {editForm.name || editingProduct.name}
                  </p>
                  <p className="text-xs font-mono font-bold text-[#00A86B]">
                    {formatPrice(Number(editForm.price) || 0)}
                  </p>
                </div>
              </div>

              {/* Item Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#374151]">Item Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs text-[#1F2937] focus:outline-none focus:border-[#00A86B]"
                />
              </div>

              {/* Price in PHP */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#374151]">Price (PHP ₱)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] font-mono text-xs">
                    ₱
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={editForm.price}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, price: e.target.value }))}
                    className="w-full pl-7 pr-3.5 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-mono text-[#1F2937] focus:outline-none focus:border-[#00A86B]"
                  />
                </div>
                <p className="text-[10px] text-[#6B7280]">
                  Updated price immediately applies to customer checkout and cashier POS tickets.
                </p>
              </div>

              {/* Popular / Featured Badge */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E5E7EB]">
                <div className="flex items-center gap-2">
                  <Flame
                    className={cn(
                      "h-4 w-4",
                      editForm.popular ? "text-amber-400 fill-amber-400" : "text-[#6B7280]"
                    )}
                  />
                  <div>
                    <p className="text-xs font-bold text-[#1F2937]">Featured / Popular Badge</p>
                    <p className="text-[10px] text-[#6B7280]">Highlight in customer carousel</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={editForm.popular}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, popular: e.target.checked }))}
                  className="h-4 w-4 rounded accent-[#00A86B] cursor-pointer"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#374151]">Item Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Ingredients, tasting notes, roast profile..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs text-[#1F2937] focus:outline-none focus:border-[#00A86B] resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#F7F9FA] text-[#6B7280] text-xs font-bold border border-[#E5E7EB] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProduct !== null}
                  className="px-5 py-2 rounded-xl bg-[#00A86B] hover:bg-[#00925c] text-black text-xs font-black transition-all cursor-pointer flex items-center gap-2"
                >
                  {isUpdatingProduct !== null ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK TOGGLE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(productToToggle)}
        title={productToToggle?.nextAvailable ? "Mark Item as In Stock?" : "Mark Item as 86'd (Sold Out)?"}
        message={`Confirm changing "${productToToggle?.product.name}" to ${
          productToToggle?.nextAvailable ? "In Stock (customers can order)" : "86'd (Sold Out on customer menu)"
        }?`}
        confirmLabel={productToToggle?.nextAvailable ? "Mark In Stock" : "Mark Sold Out"}
        variant={productToToggle?.nextAvailable ? "primary" : "warning"}
        isLoading={isUpdatingProduct !== null}
        onConfirm={() => {
          if (productToToggle) {
            toggleProductAvailability(productToToggle.product);
            setProductToToggle(null);
          }
        }}
        onCancel={() => setProductToToggle(null)}
      />

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={cn(
              "px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border",
              toastMessage.type === "success"
                ? "bg-emerald-950/90 text-emerald-300 border-emerald-800/80 backdrop-blur-md"
                : "bg-rose-950/90 text-rose-300 border-rose-800/80 backdrop-blur-md"
            )}
          >
            {toastMessage.type === "success" ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </StaffGuard>
  );
}
