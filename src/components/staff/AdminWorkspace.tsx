import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  LayoutDashboard,
  Menu,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Tags,
  X,
} from "lucide-react";
import { StaffGuard } from "./StaffGuard";
import { StaffLayout } from "./StaffLayout";
import { Category, CustomizationGroupConfig, CustomizationOptionConfig, Ingredient, Order, Product } from "../../types";
import { CATEGORIES, PRODUCTS } from "../../data/menuData";
import { formatDateTime, formatPrice } from "../../lib/utils";
import { navigate } from "../../lib/router";

 type AdminView = "dashboard" | "products" | "inventory" | "categories" | "access";
 type ConfigKind = "ingredients" | "categories" | "customization-groups";
type ConfigOptionDraft = { id?: string; name: string; priceModifier: number; isActive: boolean };
type ConfigDialogState = {
  kind: ConfigKind;
  id?: string;
  name: string;
  productType?: "BEVERAGE" | "FOOD";
  sortOrder?: number;
  isActive?: boolean;
  selectionMode?: "SINGLE" | "MULTIPLE";
  isRequired?: boolean;
  options?: ConfigOptionDraft[];
};

const NAV_ITEMS: Array<{ id: AdminView; label: string; icon: React.ElementType }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "products", label: "Menu & Products", icon: Package },
  { id: "inventory", label: "Inventory & Ingredients", icon: Settings2 },
  { id: "categories", label: "Categories & Customizations", icon: Tags },
  { id: "access", label: "Terminal Passcodes & URLs", icon: ShieldCheck },
];

function AdminWorkspaceContent() {
  const [view, setView] = useState<AdminView>("dashboard");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<Category[]>(CATEGORIES.filter((item) => item.id !== "all"));
  const [groups, setGroups] = useState<CustomizationGroupConfig[]>([]);
  const [options, setOptions] = useState<CustomizationOptionConfig[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ConfigDialogState | null>(null);
  const [optionDialog, setOptionDialog] = useState<Partial<CustomizationOptionConfig> | null>(null);
  const [productDialog, setProductDialog] = useState<Product | null | undefined>(undefined);
  const [pendingIngredient, setPendingIngredient] = useState<Ingredient | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const requests = await Promise.allSettled([
      fetch("/api/orders"),
      fetch("/api/admin/products", { credentials: "include" }),
      fetch("/api/admin/ingredients", { credentials: "include" }),
      fetch("/api/admin/categories", { credentials: "include" }),
      fetch("/api/admin/customization-groups", { credentials: "include" }),
      fetch("/api/admin/customization-options", { credentials: "include" }),
    ]);
    const read = async (result: PromiseSettledResult<Response>) => {
      if (result.status !== "fulfilled" || !result.value.ok) return null;
      return result.value.json();
    };
    const [orderData, productData, ingredientData, categoryData, groupData, optionData] = await Promise.all(requests.map(read));
    if (Array.isArray(orderData?.data)) setOrders(orderData.data);
    if (Array.isArray(productData?.data)) setProducts(productData.data);
    if (Array.isArray(ingredientData?.data)) setIngredients(ingredientData.data);
    else setIngredients((current) => current);
    if (Array.isArray(categoryData?.data)) setCategories(categoryData.data);
    if (Array.isArray(groupData?.data)) setGroups(groupData.data);
    if (Array.isArray(optionData?.data)) setOptions(optionData.data);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectView = (nextView: AdminView) => {
    setView(nextView);
    setIsDrawerOpen(false);
    setSearch("");
  };

  const updateProduct = async (product: Product, updates: Record<string, unknown>) => {
    setBusyId(product.id);
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Product update failed");
      const data = await response.json();
      if (data.product) setProducts((current) => current.map((item) => item.id === product.id ? data.product : item));
    } catch {
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, ...updates } as Product : item));
    } finally {
      setBusyId(null);
    }
  };

  const updateIngredient = async (ingredient: Ingredient, updates: Record<string, unknown>) => {
    setBusyId(ingredient.id);
    try {
      const response = await fetch(`/api/admin/ingredients/${ingredient.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Ingredient update failed");
      const data = await response.json();
      if (data.ingredient) setIngredients((current) => current.map((item) => item.id === ingredient.id ? { ...item, ...data.ingredient } : item));
      await loadData();
    } catch {
      setIngredients((current) => current.map((item) => item.id === ingredient.id ? { ...item, ...updates } as Ingredient : item));
    } finally {
      setBusyId(null);
    }
  };

  const saveProduct = async (payload: Record<string, unknown>, productId?: string) => {
    try {
      const response = await fetch(`/api/admin/products${productId ? `/${productId}` : ""}`, {
      method: productId ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
      if (!response.ok) throw new Error("Product save failed");
      setProductDialog(undefined);
      await loadData();
    } catch {
      if (productId) setProducts((current) => current.map((item) => item.id === productId ? { ...item, ...payload } as Product : item));
      else setProducts((current) => [...current, { ...payload, id: `product_${Date.now()}`, isAvailable: payload.isAvailable !== false } as Product]);
      setProductDialog(undefined);
    }
  };

  const saveDialog = async () => {
    if (!dialog?.name.trim()) return;
    const endpoint = `/api/admin/${dialog.kind}${dialog.id ? `/${dialog.id}` : ""}`;
    const payload = dialog.kind === "ingredients"
      ? { name: dialog.name.trim(), isAvailable: dialog.isActive !== false }
      : dialog.kind === "categories"
        ? { name: dialog.name.trim(), productType: dialog.productType || "BEVERAGE", sortOrder: dialog.sortOrder ?? 0, isActive: dialog.isActive !== false }
        : { name: dialog.name.trim(), selectionMode: dialog.selectionMode || "SINGLE", isRequired: dialog.isRequired === true, sortOrder: dialog.sortOrder ?? 0, isActive: dialog.isActive !== false };
    try {
      const response = await fetch(endpoint, {
        method: dialog.id ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Admin endpoint returned ${response.status}`);
      const saved = await response.json();
      if (dialog.kind === "customization-groups" && Array.isArray(dialog.options)) {
        const groupId = saved.group?.id || dialog.id;
        for (const option of dialog.options.filter((item) => item.name.trim())) {
          await fetch(`/api/admin/customization-options${option.id ? `/${option.id}` : ""}`, {
            method: option.id ? "PATCH" : "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: option.name.trim(), groupId, priceModifier: option.priceModifier, isActive: option.isActive }),
          });
        }
      }
      setDialog(null);
      await loadData();
    } catch {
      const id = dialog.id || `${dialog.kind}_${Date.now()}`;
      if (dialog.kind === "ingredients") setIngredients((current) => dialog.id ? current.map((item) => item.id === id ? { ...item, name: dialog.name, isAvailable: dialog.isActive !== false } : item) : [...current, { id, name: dialog.name, isAvailable: dialog.isActive !== false }]);
      if (dialog.kind === "categories") setCategories((current) => dialog.id ? current.map((item) => item.id === id ? { ...item, name: dialog.name, productType: dialog.productType, sortOrder: dialog.sortOrder || 0, isActive: dialog.isActive !== false } : item) : [...current, { id, name: dialog.name, slug: dialog.name.toLowerCase().replace(/\s+/g, "-"), productType: dialog.productType || "BEVERAGE", sortOrder: dialog.sortOrder || 0, isActive: dialog.isActive !== false }]);
      if (dialog.kind === "customization-groups") setGroups((current) => dialog.id ? current.map((item) => item.id === id ? { ...item, name: dialog.name, selectionMode: dialog.selectionMode || "SINGLE", isRequired: dialog.isRequired, sortOrder: dialog.sortOrder, isActive: dialog.isActive !== false } : item) : [...current, { id, name: dialog.name, selectionMode: dialog.selectionMode || "SINGLE", isRequired: dialog.isRequired, sortOrder: dialog.sortOrder, isActive: dialog.isActive !== false }]);
      setDialog(null);
    }
  };

  const archive = async (kind: ConfigKind, id: string) => {
    try {
      const response = await fetch(`/api/admin/${kind}/${id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("Archive request failed");
      await loadData();
    } catch {
      if (kind === "ingredients") setIngredients((current) => current.map((item) => item.id === id ? { ...item, isArchived: true } : item));
      if (kind === "categories") setCategories((current) => current.map((item) => item.id === id ? { ...item, isArchived: true, isActive: false } : item));
      if (kind === "customization-groups") setGroups((current) => current.map((item) => item.id === id ? { ...item, isArchived: true, isActive: false } : item));
    }
  };

  const saveOption = async () => {
    if (!optionDialog?.name?.trim() || !optionDialog.groupId) return;
    const endpoint = `/api/admin/customization-options${optionDialog.id ? `/${optionDialog.id}` : ""}`;
    const response = await fetch(endpoint, { method: optionDialog.id ? "PATCH" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: optionDialog.name.trim(), groupId: optionDialog.groupId, priceModifier: Number(optionDialog.priceModifier) || 0, isActive: optionDialog.isActive !== false }) });
    if (response.ok) { setOptionDialog(null); await loadData(); }
  };

  const archiveOption = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/customization-options/${id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("Option archive failed");
      await loadData();
    } catch {
      setOptions((current) => current.map((option) => option.id === id ? { ...option, isArchived: true, isActive: false } : option));
    }
  };

  const copyUrl = async (key: string, path: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const filteredProducts = useMemo(() => products.filter((product) => {
    if (product.isArchived) return false;
    const query = search.toLowerCase().trim();
    const matchesQuery = !query || product.name.toLowerCase().includes(query) || product.description.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "ALL" || (statusFilter === "AVAILABLE" ? product.isAvailable : !product.isAvailable);
    return matchesQuery && matchesStatus;
  }), [products, search, statusFilter]);

  const activeOrders = orders.filter((order) => order.status !== "COMPLETED");
  const completedOrders = orders.filter((order) => order.status === "COMPLETED");
  const revenue = orders.reduce((total, order) => total + order.totalAmount, 0);
  const title = NAV_ITEMS.find((item) => item.id === view)?.label || "Dashboard";

  return (
    <StaffLayout activeTab="admin" title={title} subtitle="Catalog, inventory, and terminal operations" pinEnvKey="ADMIN_PIN" hideRoleNav>
      <div className="flex min-h-[calc(100vh-7rem)] -m-3 sm:-m-5">
        {isDrawerOpen && <button type="button" aria-label="Close navigation" onClick={() => setIsDrawerOpen(false)} className="fixed inset-0 z-40 bg-black/20 lg:hidden" />}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-[#E5E7EB] p-4 transition-transform lg:static lg:translate-x-0 lg:w-64 lg:shrink-0 ${isDrawerOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between px-2 mb-8 lg:block">
            <div><p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#6B7280]">Cafe Builders</p><h1 className="text-xl font-black mt-1">Cafe Admin</h1></div>
            <button type="button" onClick={() => setIsDrawerOpen(false)} className="lg:hidden min-h-11 min-w-11 rounded-xl border border-[#E5E7EB]" aria-label="Close menu"><X className="h-4 w-4 mx-auto" /></button>
          </div>
          <nav className="space-y-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => selectView(id)} className={`w-full min-h-11 px-3 rounded-xl flex items-center gap-3 text-left text-sm font-bold ${view === id ? "bg-[#E6F6F0] text-[#008F5B]" : "text-[#6B7280] hover:bg-[#F7F9FA] hover:text-[#1F2937]"}`}><Icon className="h-4 w-4 shrink-0" /><span>{label}</span>{view === id && <ChevronRight className="ml-auto h-4 w-4" />}</button>)}
          </nav>
          <button type="button" onClick={() => navigate("/")} className="absolute bottom-5 left-4 right-4 min-h-11 px-3 rounded-xl border border-[#E5E7EB] text-sm font-bold text-[#6B7280]">Open Storefront</button>
        </aside>

        <section className="min-w-0 flex-1 p-4 sm:p-6 bg-[#F7F9FA]">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#00A86B]">Manager workspace</p><h2 className="text-2xl sm:text-3xl font-black mt-1">{title}</h2><p className="text-sm text-[#6B7280] mt-1">{view === "dashboard" ? "Monitor today's orders and store performance." : view === "products" ? "Manage the live menu, pricing, and product availability." : view === "inventory" ? "Control ingredient stock and linked product availability." : view === "categories" ? "Configure reusable categories and customization groups." : "Open staff terminals without exposing PIN values."}</p></div>
            <div className="flex items-center gap-2 shrink-0"><button type="button" onClick={() => setIsDrawerOpen(true)} className="lg:hidden min-h-11 min-w-11 rounded-xl bg-white border border-[#E5E7EB]" aria-label="Open navigation"><Menu className="h-4 w-4 mx-auto" /></button><button type="button" onClick={() => void loadData()} className="min-h-11 min-w-11 rounded-xl bg-white border border-[#E5E7EB]" aria-label="Refresh data"><RefreshCw className="h-4 w-4 mx-auto text-[#008F5B]" /></button></div>
          </div>

          {view === "dashboard" && <DashboardView orders={orders} revenue={revenue} activeOrders={activeOrders.length} completedOrders={completedOrders.length} search={search} statusFilter={statusFilter} setSearch={setSearch} setStatusFilter={setStatusFilter} />}
          {view === "products" && <ProductsView products={filteredProducts} categories={categories} search={search} statusFilter={statusFilter} setSearch={setSearch} setStatusFilter={setStatusFilter} busyId={busyId} updateProduct={updateProduct} openEditor={(product) => setProductDialog(product)} />}
          {view === "inventory" && <InventoryView ingredients={ingredients} busyId={busyId} onToggle={(ingredient) => setPendingIngredient(ingredient)} updateIngredient={updateIngredient} openDialog={() => setDialog({ kind: "ingredients", name: "", isActive: true })} editIngredient={(ingredient) => setDialog({ kind: "ingredients", id: ingredient.id, name: ingredient.name, isActive: ingredient.isAvailable })} archiveIngredient={(ingredient) => void archive("ingredients", ingredient.id)} />}
          {view === "categories" && <ConfigurationView categories={categories} groups={groups} options={options} openDialog={(kind) => setDialog(kind === "categories" ? { kind, name: "", productType: "BEVERAGE", sortOrder: 0, isActive: true } : { kind, name: "", selectionMode: "SINGLE", isRequired: false, sortOrder: 0, isActive: true, options: [] })} edit={(kind, id, name) => { const category = categories.find((item) => item.id === id); const group = groups.find((item) => item.id === id); setDialog(kind === "categories" ? { kind, id, name, productType: category?.productType || "BEVERAGE", sortOrder: category?.sortOrder || 0, isActive: category?.isActive !== false } : { kind, id, name, selectionMode: group?.selectionMode || "SINGLE", isRequired: group?.isRequired === true, sortOrder: group?.sortOrder || 0, isActive: group?.isActive !== false, options: options.filter((option) => option.groupId === id).map((option) => ({ id: option.id, name: option.name, priceModifier: option.priceModifier, isActive: option.isActive })) }); }} archive={archive} openOptionDialog={setOptionDialog} archiveOption={archiveOption} />}
          {view === "access" && <AccessView copied={copied} copyUrl={copyUrl} />}
        </section>
      </div>
      {dialog && <ConfigDialog dialog={dialog} setDialog={setDialog} onCancel={() => setDialog(null)} onSave={saveDialog} />}
      {optionDialog && <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4"><form onSubmit={(event) => { event.preventDefault(); void saveOption(); }} className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-xl space-y-4"><div className="flex items-center justify-between"><h3 className="text-lg font-black">{optionDialog.id ? "Edit" : "Add"} Option</h3><button type="button" onClick={() => setOptionDialog(null)} className="min-h-11 min-w-11 rounded-xl border border-[#E5E7EB]" aria-label="Close"><X className="h-4 w-4 mx-auto" /></button></div><label className="block text-sm font-bold">Option name<input autoFocus required value={optionDialog.name || ""} onChange={(event) => setOptionDialog((current) => current ? { ...current, name: event.target.value } : current)} className="mt-1 w-full min-h-11 rounded-xl border border-[#E5E7EB] px-3 font-normal" /></label><label className="block text-sm font-bold">Group<select required value={optionDialog.groupId || ""} onChange={(event) => setOptionDialog((current) => current ? { ...current, groupId: event.target.value } : current)} className="mt-1 w-full min-h-11 rounded-xl border border-[#E5E7EB] px-3 font-normal"><option value="">Select group</option>{groups.filter((group) => !group.isArchived).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label className="block text-sm font-bold">Price modifier (PHP)<input type="number" min="0" step="0.01" value={optionDialog.priceModifier ?? 0} onChange={(event) => setOptionDialog((current) => current ? { ...current, priceModifier: Number(event.target.value) } : current)} className="mt-1 w-full min-h-11 rounded-xl border border-[#E5E7EB] px-3 font-normal" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setOptionDialog(null)} className="min-h-11 px-4 rounded-xl border border-[#E5E7EB] font-bold">Cancel</button><button type="submit" className="min-h-11 px-4 rounded-xl bg-[#00A86B] text-white font-bold">Save</button></div></form></div>}
      {productDialog !== undefined && <ProductEditor product={productDialog} categories={categories} ingredients={ingredients} groups={groups} options={options} onCancel={() => setProductDialog(undefined)} onSave={saveProduct} />}
      {pendingIngredient && <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4"><div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-xl space-y-4"><h3 className="text-lg font-black">Mark {pendingIngredient.name} unavailable?</h3><p className="text-sm text-[#6B7280]">This will affect:</p><ul className="list-disc pl-5 text-sm space-y-1">{pendingIngredient.productIds?.map((id) => <li key={id}>{products.find((product) => product.id === id)?.name || id} - Sold Out</li>)}<li>{pendingIngredient.name} option - Unavailable</li></ul><div className="flex justify-end gap-2"><button type="button" onClick={() => setPendingIngredient(null)} className="min-h-11 px-4 rounded-xl border border-[#E5E7EB] font-bold">Cancel</button><button type="button" onClick={() => { const ingredient = pendingIngredient; setPendingIngredient(null); void updateIngredient(ingredient, { isAvailable: false }); }} className="min-h-11 px-4 rounded-xl bg-[#00A86B] text-white font-bold">Mark Unavailable</button></div></div></div>}
    </StaffLayout>
  );
}

function DashboardView({ orders, revenue, activeOrders, completedOrders, search, statusFilter, setSearch, setStatusFilter }: { orders: Order[]; revenue: number; activeOrders: number; completedOrders: number; search: string; statusFilter: string; setSearch: (value: string) => void; setStatusFilter: (value: string) => void }) {
  const filtered = orders.filter((order) => { const query = search.toLowerCase().trim(); return (!query || order.orderNumber.toLowerCase().includes(query) || order.customerName?.toLowerCase().includes(query)) && (statusFilter === "ALL" || order.status === statusFilter); });
  return <div className="space-y-5"><div className="grid grid-cols-2 xl:grid-cols-4 gap-3"><Metric label="Gross sales" value={formatPrice(revenue)} /><Metric label="Active orders" value={String(activeOrders)} accent="amber" /><Metric label="Completed" value={String(completedOrders)} accent="blue" /><Metric label="Average ticket" value={formatPrice(orders.length ? revenue / orders.length : 0)} /></div><Panel title="Order audit log"><div className="flex flex-col sm:flex-row gap-3 mb-4"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order or customer" className="w-full min-h-11 pl-10 pr-3 rounded-xl border border-[#E5E7EB]" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 rounded-xl border border-[#E5E7EB] px-3 bg-white"><option value="ALL">All statuses</option><option value="PAID">Paid</option><option value="PREPARING">Preparing</option><option value="READY">Ready</option><option value="COMPLETED">Completed</option></select></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-[#6B7280] border-b border-[#E5E7EB]"><tr><th className="py-3 pr-3">Order</th><th className="py-3 pr-3">Time</th><th className="py-3 pr-3">Customer</th><th className="py-3 pr-3">Payment</th><th className="py-3 pr-3">Status</th><th className="py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-[#E5E7EB]">{filtered.map((order) => <tr key={order.id}><td className="py-3 pr-3 font-bold">{order.orderNumber}</td><td className="py-3 pr-3 text-[#6B7280]">{formatDateTime(order.createdAt)}</td><td className="py-3 pr-3">{order.customerName || "Guest"}</td><td className="py-3 pr-3">{order.paymentMethod === "QRPH" ? "QR Ph" : "Cash"}</td><td className="py-3 pr-3"><span className="font-bold text-xs">{order.status.replace("_", " ")}</span></td><td className="py-3 text-right font-bold">{formatPrice(order.totalAmount)}</td></tr>)}</tbody></table></div></Panel></div>;
}

function ConfigDialog({ dialog, setDialog, onCancel, onSave }: { dialog: ConfigDialogState; setDialog: React.Dispatch<React.SetStateAction<ConfigDialogState | null>>; onCancel: () => void; onSave: () => Promise<void> }) {
  const update = (changes: Partial<ConfigDialogState>) => setDialog((current) => current ? { ...current, ...changes } : current);
  const addOption = () => update({ options: [...(dialog.options || []), { name: "", priceModifier: 0, isActive: true }] });
  const updateOption = (index: number, changes: Partial<ConfigOptionDraft>) => update({ options: (dialog.options || []).map((option, optionIndex) => optionIndex === index ? { ...option, ...changes } : option) });
  const isIngredient = dialog.kind === "ingredients";
  const isCategory = dialog.kind === "categories";
  return <div className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center p-4"><form onSubmit={(event) => { event.preventDefault(); void onSave(); }} className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-xl space-y-5"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider font-bold text-[#00A86B]">Admin configuration</p><h3 className="text-xl font-black">{dialog.id ? "Edit" : "Add"} {isIngredient ? "Ingredient" : isCategory ? "Category" : "Customization Group"}</h3></div><button type="button" onClick={onCancel} className="min-h-11 min-w-11 rounded-xl border border-[#E5E7EB]" aria-label="Close"><X className="h-4 w-4 mx-auto" /></button></div><label className="block text-sm font-bold">{isIngredient ? "Ingredient Name" : isCategory ? "Category Name" : "Group Name"}<input autoFocus required value={dialog.name} onChange={(event) => update({ name: event.target.value })} className="field" /></label>{isCategory && <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-bold">Product Type<select value={dialog.productType} onChange={(event) => update({ productType: event.target.value as "BEVERAGE" | "FOOD" })} className="field"><option value="BEVERAGE">BEVERAGE</option><option value="FOOD">FOOD</option></select></label><label className="text-sm font-bold">Sort Order<input type="number" value={dialog.sortOrder ?? 0} onChange={(event) => update({ sortOrder: Number(event.target.value) })} className="field" /></label><CheckRow label="Active" checked={dialog.isActive !== false} onChange={() => update({ isActive: dialog.isActive === false })} /></div>}{isIngredient && <CheckRow label="Available" checked={dialog.isActive !== false} onChange={() => update({ isActive: dialog.isActive === false })} />}{!isIngredient && !isCategory && <><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-bold">Selection Mode<select value={dialog.selectionMode} onChange={(event) => update({ selectionMode: event.target.value as "SINGLE" | "MULTIPLE" })} className="field"><option value="SINGLE">SINGLE</option><option value="MULTIPLE">MULTIPLE</option></select></label><label className="text-sm font-bold">Sort Order<input type="number" value={dialog.sortOrder ?? 0} onChange={(event) => update({ sortOrder: Number(event.target.value) })} className="field" /></label><CheckRow label="Required" checked={dialog.isRequired === true} onChange={() => update({ isRequired: !dialog.isRequired })} /></div><section className="space-y-3"><div className="flex items-center justify-between"><h4 className="font-black">Option List</h4><button type="button" onClick={addOption} className="min-h-11 px-3 rounded-xl bg-[#00A86B] text-white text-xs font-bold"><Plus className="h-4 w-4 inline mr-1" /> Add Option</button></div>{(dialog.options || []).map((option, index) => <div key={option.id || index} className="grid gap-2 sm:grid-cols-[1fr_130px_auto] items-end"><label className="text-xs font-bold">Option Name<input value={option.name} onChange={(event) => updateOption(index, { name: event.target.value })} className="field" /></label><label className="text-xs font-bold">Modifier (PHP)<input type="number" min="0" step="0.01" value={option.priceModifier} onChange={(event) => updateOption(index, { priceModifier: Number(event.target.value) })} className="field" /></label><CheckRow label="Active" checked={option.isActive} onChange={() => updateOption(index, { isActive: !option.isActive })} /></div>)}</section></>}{!isIngredient && <div className="flex justify-end gap-2 border-t border-[#E5E7EB] pt-4"><button type="button" onClick={onCancel} className="min-h-11 px-4 rounded-xl border border-[#E5E7EB] font-bold">Cancel</button><button type="submit" className="min-h-11 px-4 rounded-xl bg-[#00A86B] text-white font-bold">Save</button></div>}{isIngredient && <div className="flex justify-end gap-2 border-t border-[#E5E7EB] pt-4"><button type="button" onClick={onCancel} className="min-h-11 px-4 rounded-xl border border-[#E5E7EB] font-bold">Cancel</button><button type="submit" className="min-h-11 px-4 rounded-xl bg-[#00A86B] text-white font-bold">Save</button></div>}</form></div>;
}

function ProductEditor({ product, categories, ingredients, groups, options, onCancel, onSave }: { product: Product | null; categories: Category[]; ingredients: Ingredient[]; groups: CustomizationGroupConfig[]; options: CustomizationOptionConfig[]; onCancel: () => void; onSave: (payload: Record<string, unknown>, productId?: string) => Promise<void> }) {
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [productType, setProductType] = useState<"BEVERAGE" | "FOOD">(product?.productType || "BEVERAGE");
  const [categoryIds, setCategoryIds] = useState<string[]>(product?.categoryIds || (product?.categoryId ? [product.categoryId] : []));
  const [price, setPrice] = useState(String(product?.price || ""));
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || "");
  const [ingredientIds, setIngredientIds] = useState<string[]>(product?.ingredientIds || []);
  const [enabledGroups, setEnabledGroups] = useState<string[]>(product?.enabledCustomizationGroups || []);
  const [allowedOptionIds, setAllowedOptionIds] = useState<string[]>(product?.allowedOptionIds || []);
  const [isAvailable, setIsAvailable] = useState(product?.isAvailable !== false);

  const toggle = (values: string[], value: string, setter: (next: string[]) => void) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSave({ name: name.trim(), description: description.trim(), productType, categoryIds, categoryId: categoryIds[0], price: Number(price), imageUrl: imageUrl.trim(), ingredientIds, enabledCustomizationGroups: enabledGroups, allowedOptionIds, isAvailable }, product?.id);
  };

  return <div className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center p-4"><form onSubmit={(event) => void submit(event)} className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl border border-[#E5E7EB] shadow-xl"><div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-5 bg-white border-b border-[#E5E7EB]"><div><p className="text-xs uppercase tracking-wider font-bold text-[#00A86B]">Menu configuration</p><h2 className="text-xl font-black">{product ? "Edit product" : "Create product"}</h2></div><button type="button" onClick={onCancel} className="min-h-11 min-w-11 rounded-xl border border-[#E5E7EB]" aria-label="Close product editor"><X className="h-4 w-4 mx-auto" /></button></div><div className="p-5 space-y-5"><FormSection title="Basic information"><div className="grid gap-3 sm:grid-cols-2"><Field label="Product name"><input required value={name} onChange={(event) => setName(event.target.value)} className="field" /></Field><Field label="Product type"><select value={productType} onChange={(event) => setProductType(event.target.value as "BEVERAGE" | "FOOD")} className="field"><option value="BEVERAGE">Beverage</option><option value="FOOD">Food</option></select></Field></div><Field label="Description"><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="field resize-none" /></Field></FormSection><FormSection title="Price and image"><div className="grid gap-3 sm:grid-cols-2"><Field label="Price (PHP)"><input required type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="field" /></Field><Field label="Image URL"><input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className="field" /></Field></div></FormSection><FormSection title="Categories"><div className="grid gap-2 sm:grid-cols-2">{categories.filter((category) => !category.isArchived).map((category) => <CheckRow key={category.id} label={category.name} checked={categoryIds.includes(category.id)} onChange={() => toggle(categoryIds, category.id, setCategoryIds)} />)}</div></FormSection><FormSection title="Required ingredients"><div className="grid gap-2 sm:grid-cols-2">{ingredients.filter((ingredient) => !ingredient.isArchived).map((ingredient) => <CheckRow key={ingredient.id} label={ingredient.name} checked={ingredientIds.includes(ingredient.id)} onChange={() => toggle(ingredientIds, ingredient.id, setIngredientIds)} />)}</div></FormSection><FormSection title="Enabled customization groups"><div className="grid gap-2 sm:grid-cols-2">{groups.filter((group) => !group.isArchived).map((group) => <CheckRow key={group.id} label={`${group.name} (${group.selectionMode.toLowerCase()})`} checked={enabledGroups.includes(group.id.replace("group_", ""))} onChange={() => toggle(enabledGroups, group.id.replace("group_", ""), setEnabledGroups)} />)}</div></FormSection><FormSection title="Allowed options and add-ons"><div className="grid gap-2 sm:grid-cols-2">{options.filter((option) => !option.isArchived).map((option) => <CheckRow key={option.id} label={`${option.name} (+${formatPrice(option.priceModifier)})`} checked={allowedOptionIds.includes(option.id)} onChange={() => toggle(allowedOptionIds, option.id, setAllowedOptionIds)} />)}</div></FormSection><FormSection title="Availability"><CheckRow label={isAvailable ? "Available to customers" : "Sold Out"} checked={isAvailable} onChange={() => setIsAvailable((current) => !current)} /></FormSection></div><div className="sticky bottom-0 flex justify-end gap-2 p-5 bg-white border-t border-[#E5E7EB]"><button type="button" onClick={onCancel} className="min-h-11 px-4 rounded-xl border border-[#E5E7EB] font-bold">Cancel</button><button type="submit" className="min-h-11 px-4 rounded-xl bg-[#00A86B] text-white font-bold">Save Product</button></div></form></div>;
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="space-y-3"><h3 className="text-sm font-black text-[#1F2937]">{title}</h3>{children}</section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold text-[#374151]">{label}{children}</label>; }
function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) { return <label className="min-h-11 px-3 rounded-xl border border-[#E5E7EB] flex items-center gap-2 text-sm font-bold cursor-pointer"><input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-[#00A86B]" />{label}</label>; }

function ProductsView({ products, categories, search, statusFilter, setSearch, setStatusFilter, busyId, updateProduct, openEditor }: { products: Product[]; categories: Category[]; search: string; statusFilter: string; setSearch: (value: string) => void; setStatusFilter: (value: string) => void; busyId: string | null; updateProduct: (product: Product, updates: Record<string, unknown>) => Promise<void>; openEditor: (product: Product | null) => void }) {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const visibleProducts = products.filter((product) => (typeFilter === "ALL" || (product.productType || "BEVERAGE") === typeFilter) && (categoryFilter === "ALL" || product.categoryIds?.includes(categoryFilter) || product.categoryId === categoryFilter));
  return <Panel title="Live catalog" action={<button type="button" onClick={() => openEditor(null)} className="min-h-11 px-3 rounded-xl bg-[#00A86B] text-white text-sm font-bold inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Create Product</button>}><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4"><label className="relative sm:col-span-2 xl:col-span-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="w-full min-h-11 pl-10 pr-3 rounded-xl border border-[#E5E7EB]" /></label><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-h-11 rounded-xl border border-[#E5E7EB] px-3 bg-white"><option value="ALL">All types</option><option value="BEVERAGE">Beverage</option><option value="FOOD">Food</option></select><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="min-h-11 rounded-xl border border-[#E5E7EB] px-3 bg-white"><option value="ALL">All categories</option>{categories.filter((category) => !category.isArchived).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 rounded-xl border border-[#E5E7EB] px-3 bg-white"><option value="ALL">All statuses</option><option value="AVAILABLE">In Stock</option><option value="SOLD_OUT">Sold Out</option></select></div><div className="space-y-2">{visibleProducts.map((product) => <div key={product.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1.5fr)_100px_130px_auto] gap-3 items-center p-3 rounded-xl border border-[#E5E7EB] bg-white"><div className="min-w-0"><p className="font-bold truncate">{product.name}</p><p className="text-xs text-[#6B7280] truncate">{product.productType || "BEVERAGE"} · {product.categoryName || "Uncategorized"}</p></div><span className="font-bold text-sm">{formatPrice(product.price)}</span><button type="button" disabled={busyId === product.id} onClick={() => void updateProduct(product, { isAvailable: !product.isAvailable })} className={`min-h-11 px-3 rounded-xl border text-xs font-bold ${product.isAvailable ? "border-emerald-200 bg-[#E6F6F0] text-[#008F5B]" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{product.isAvailable ? "In Stock" : "Sold Out"}</button><div className="flex items-center justify-end gap-2"><button type="button" onClick={() => openEditor(product)} className="min-h-11 min-w-11 rounded-xl border border-[#E5E7EB]" aria-label={`Edit ${product.name}`}><Pencil className="h-4 w-4 mx-auto" /></button><button type="button" onClick={() => void updateProduct(product, { isArchived: true })} className="min-h-11 min-w-11 rounded-xl border border-rose-200 text-rose-700" aria-label={`Archive ${product.name}`}><Archive className="h-4 w-4 mx-auto" /></button></div></div>)}</div></Panel>;
}

function InventoryView({ ingredients, busyId, onToggle, updateIngredient, openDialog, editIngredient, archiveIngredient }: { ingredients: Ingredient[]; busyId: string | null; onToggle: (ingredient: Ingredient) => void; updateIngredient: (ingredient: Ingredient, updates: Record<string, unknown>) => Promise<void>; openDialog: () => void; editIngredient: (ingredient: Ingredient) => void; archiveIngredient: (ingredient: Ingredient) => void }) {
  return <Panel title="Ingredient stock" action={<button type="button" onClick={openDialog} className="min-h-11 px-3 rounded-xl bg-[#00A86B] text-white text-sm font-bold inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Add Ingredient</button>}><p className="text-sm text-[#6B7280] mb-4">Availability is linked to products through explicit ingredient relationships.</p><div className="space-y-2">{ingredients.filter((ingredient) => !ingredient.isArchived).map((ingredient) => <div key={ingredient.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-center p-3 rounded-xl border border-[#E5E7EB] bg-white"><div><p className="font-bold">{ingredient.name}</p><p className="text-xs text-[#6B7280]">{ingredient.productIds?.length || 0} linked products</p></div><button type="button" disabled={busyId === ingredient.id} onClick={() => onToggle(ingredient)} className={`min-h-11 px-3 rounded-xl border text-xs font-bold ${ingredient.isAvailable ? "border-emerald-200 bg-[#E6F6F0] text-[#008F5B]" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{ingredient.isAvailable ? "Available" : "Out of Stock"}</button><button type="button" onClick={() => editIngredient(ingredient)} className="min-h-11 min-w-11 rounded-xl border border-[#E5E7EB]" aria-label={`Edit ${ingredient.name}`}><Pencil className="h-4 w-4 mx-auto" /></button><button type="button" onClick={() => archiveIngredient(ingredient)} className="min-h-11 min-w-11 rounded-xl border border-rose-200 text-rose-700" aria-label={`Archive ${ingredient.name}`}><Archive className="h-4 w-4 mx-auto" /></button></div>)}</div></Panel>;
}

function ConfigurationView({ categories, groups, options, openDialog, edit, archive, openOptionDialog, archiveOption }: { categories: Category[]; groups: CustomizationGroupConfig[]; options: CustomizationOptionConfig[]; openDialog: (kind: ConfigKind) => void; edit: (kind: ConfigKind, id: string, name: string) => void; archive: (kind: ConfigKind, id: string) => Promise<void>; openOptionDialog: (option: Partial<CustomizationOptionConfig>) => void; archiveOption: (id: string) => Promise<void> }) {
  return <div className="space-y-4"><div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white p-1"><button type="button" onClick={() => openDialog("categories")} className="min-h-11 px-4 rounded-lg text-sm font-bold">Categories</button><button type="button" onClick={() => openDialog("customization-groups")} className="min-h-11 px-4 rounded-lg text-sm font-bold">Customization Groups</button><button type="button" onClick={() => openOptionDialog({ groupId: groups.find((group) => !group.isArchived)?.id, priceModifier: 0, isActive: true })} className="min-h-11 px-4 rounded-lg text-sm font-bold">Options</button></div><div className="grid gap-5 xl:grid-cols-3"><Panel title="Categories" action={<button type="button" onClick={() => openDialog("categories")} className="min-h-11 px-3 rounded-xl bg-[#00A86B] text-white text-sm font-bold"><Plus className="h-4 w-4 inline mr-1" /> Add</button>}><ConfigList items={categories.filter((category) => !category.isArchived).map((category) => ({ id: category.id, name: category.name }))} onEdit={(id, name) => edit("categories", id, name)} onArchive={(id) => archive("categories", id)} /></Panel><Panel title="Customization groups" action={<button type="button" onClick={() => openDialog("customization-groups")} className="min-h-11 px-3 rounded-xl bg-[#00A86B] text-white text-sm font-bold"><Plus className="h-4 w-4 inline mr-1" /> Add</button>}><ConfigList items={groups.filter((group) => !group.isArchived).map((group) => ({ id: group.id, name: `${group.name} · ${group.selectionMode.toLowerCase()}` }))} onEdit={(id, name) => edit("customization-groups", id, name.split(" · ")[0])} onArchive={(id) => archive("customization-groups", id)} /></Panel><Panel title="Options" action={<button type="button" onClick={() => openOptionDialog({ groupId: groups.find((group) => !group.isArchived)?.id, priceModifier: 0, isActive: true })} className="min-h-11 px-3 rounded-xl bg-[#00A86B] text-white text-sm font-bold"><Plus className="h-4 w-4 inline mr-1" /> Add</button>}><div className="space-y-2">{options.filter((option) => !option.isArchived).map((option) => <div key={option.id} className="min-h-11 flex items-center justify-between gap-2 border-b border-[#E5E7EB] last:border-0"><div><p className="text-sm font-bold">{option.name}</p><p className="text-xs text-[#6B7280]">{formatPrice(option.priceModifier)}</p></div><div className="flex gap-1"><button type="button" onClick={() => openOptionDialog(option)} className="min-h-11 px-2 text-xs font-bold"><Pencil className="h-3.5 w-3.5 inline mr-1" />Edit</button><button type="button" onClick={() => void archiveOption(option.id)} className="min-h-11 px-2 text-xs font-bold text-rose-700"><Archive className="h-3.5 w-3.5 inline mr-1" />Archive</button></div></div>)}</div></Panel></div></div>;
}

function ConfigList({ items, onEdit, onArchive }: { items: Array<{ id: string; name: string }>; onEdit: (id: string, name: string) => void; onArchive: (id: string) => void }) { return <div className="space-y-2">{items.map((item) => <div key={item.id} className="min-h-11 flex items-center justify-between gap-3 border-b border-[#E5E7EB] last:border-0"><span className="text-sm font-bold">{item.name}</span><div className="flex items-center gap-1"><button type="button" onClick={() => onEdit(item.id, item.name)} className="min-h-11 px-3 text-xs font-bold text-[#374151] inline-flex items-center gap-1"><Pencil className="h-3.5 w-3.5" /> Edit</button><button type="button" onClick={() => onArchive(item.id)} className="min-h-11 px-3 text-xs font-bold text-rose-700 inline-flex items-center gap-1"><Archive className="h-3.5 w-3.5" /> Archive</button></div></div>)}</div>; }

function AccessView({ copied, copyUrl }: { copied: string | null; copyUrl: (key: string, path: string) => Promise<void> }) { return <div className="grid gap-5 md:grid-cols-3">{[{ key: "kds", title: "Kitchen KDS", path: "/kds" }, { key: "pos", title: "Cashier POS", path: "/pos" }, { key: "admin", title: "Manager Admin", path: "/admin" }].map((terminal) => <Panel key={terminal.key} title={terminal.title}><div className="flex items-center gap-2 text-sm text-[#008F5B] font-bold mb-5"><ShieldCheck className="h-4 w-4" /> PIN protection enabled</div><div className="flex gap-2"><button type="button" onClick={() => void copyUrl(terminal.key, terminal.path)} className="flex-1 min-h-11 rounded-xl border border-[#E5E7EB] text-xs font-bold inline-flex items-center justify-center gap-2">{copied === terminal.key ? <Check className="h-4 w-4 text-[#008F5B]" /> : <Copy className="h-4 w-4" />} {copied === terminal.key ? "Copied" : "Copy URL"}</button><button type="button" onClick={() => navigate(terminal.path)} className="min-h-11 min-w-11 rounded-xl bg-[#00A86B] text-white" aria-label={`Open ${terminal.title}`}><ExternalLink className="h-4 w-4 mx-auto" /></button></div></Panel>)}</div>; }

function Metric({ label, value, accent = "green" }: { label: string; value: string; accent?: string }) { return <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4"><p className="text-xs uppercase tracking-wider font-bold text-[#6B7280]">{label}</p><p className={`text-2xl font-black mt-2 ${accent === "amber" ? "text-amber-600" : accent === "blue" ? "text-sky-600" : "text-[#008F5B]"}`}>{value}</p></div>; }
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="bg-white border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 shadow-sm"><div className="flex items-center justify-between gap-3 mb-4"><h3 className="font-black text-lg">{title}</h3>{action}</div>{children}</section>; }

export function AdminWorkspace() {
  return <StaffGuard pinEnvKey="ADMIN_PIN" title="Store Manager Admin" subtitle="Enter 4-digit PIN to access the management workspace" roleName="Store Manager Terminal"><AdminWorkspaceContent /></StaffGuard>;
}
