import React, { useState, useEffect } from "react";
import { ArrowLeft, Save, Trash2, Image as ImageIcon, Flame, AlertCircle, RefreshCw } from "lucide-react";
import { Ingredient, Product } from "../types";
import { CATEGORIES, PRODUCTS } from "../data/menuData";
import { formatPrice } from "../lib/utils";
import { navigate } from "../lib/router";
import { StaffGuard } from "../components/staff/StaffGuard";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ToastNotification } from "../components/ui/ToastNotification";

interface AdminProductEditPageProps {
  productId: string;
}

export const AdminProductEditPage: React.FC<AdminProductEditPageProps> = ({ productId }) => {
  return (
    <StaffGuard
      pinEnvKey="ADMIN_PIN"
      title="Admin Portal Access"
      subtitle="Enter security PIN to edit product details"
      roleName="Inventory Manager"
    >
      <AdminProductEditContent productId={productId} />
    </StaffGuard>
  );
};

const AdminProductEditContent: React.FC<{ productId: string }> = ({ productId }) => {
  const [product, setProduct] = useState<Product | null>(() => {
    return PRODUCTS.find((p) => p.id === productId) || null;
  });
  const [loading, setLoading] = useState<boolean>(!product);

  // Form Fields
  const [name, setName] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("cat_coffee");
  const [price, setPrice] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [popular, setPopular] = useState<boolean>(false);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientIds, setIngredientIds] = useState<string[]>([]);

  // Modal / Confirm States
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState<boolean>(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Fetch product from API
  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/products/${productId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.product && isMounted) {
            setProduct(json.product);
          }
        }
      } catch {
        // fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [productId]);

  useEffect(() => {
    fetch("/api/admin/ingredients", { credentials: "include" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setIngredients(Array.isArray(data?.data) ? data.data : []))
      .catch(() => undefined);
  }, []);

  // Sync state when product is loaded
  useEffect(() => {
    if (product) {
      setName(product.name);
      setCategoryId(product.categoryId || "cat_coffee");
      setPrice(String(product.price));
      setDescription(product.description || "");
      setImageUrl(product.imageUrl || "");
      setPopular(Boolean(product.popular));
      setIsAvailable(product.isAvailable !== false);
      setIngredientIds(product.ingredientIds || []);
    }
  }, [product]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#00A86B] border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-stone-400 font-bold">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-stone-500" />
        <div>
          <h2 className="text-base font-black text-white">Product Not Found</h2>
          <p className="text-xs text-stone-400 mt-1">ID "{productId}" does not exist in inventory.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="px-5 py-2.5 rounded-xl bg-[#00A86B] text-black text-xs font-black cursor-pointer"
        >
          Back to Inventory
        </button>
      </div>
    );
  }

  const handleOpenSaveConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setToast({ message: "Product name cannot be empty", type: "error" });
      return;
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setToast({ message: "Please enter a valid price in PHP", type: "error" });
      return;
    }
    setIsConfirmSaveOpen(true);
  };

  const handleExecuteSave = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          price: Number(price),
          description: description.trim(),
          popular,
          isAvailable,
          ingredientIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to update (${res.status})`);
      }

      setToast({ message: `Updated "${name}" successfully!`, type: "success" });
      setTimeout(() => {
        navigate("/admin");
      }, 1000);
    } catch (err: any) {
      setToast({ message: err?.message || "Failed to save product", type: "error" });
    } finally {
      setIsSubmitting(false);
      setIsConfirmSaveOpen(false);
    }
  };

  const handleExecuteDelete = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to delete product (${res.status})`);
      }

      setToast({ message: `Deleted "${product.name}" from menu`, type: "success" });
      setTimeout(() => {
        navigate("/admin");
      }, 1000);
    } catch (err: any) {
      setToast({ message: err?.message || "Failed to delete product", type: "error" });
    } finally {
      setIsSubmitting(false);
      setIsConfirmDeleteOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col font-sans pb-24">
      {/* 1. TOP HEADER */}
      <header className="sticky top-0 z-30 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 shadow-md">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            aria-label="Back to Inventory"
            title="Back to Inventory"
            className="p-2 -ml-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <h1 className="text-sm font-black text-white">Edit Menu Item</h1>

          <button
            type="button"
            onClick={() => setIsConfirmDeleteOpen(true)}
            className="p-2 -mr-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 transition-colors cursor-pointer"
            aria-label="Delete product"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* 2. FORM BODY */}
      <main className="max-w-3xl w-full mx-auto px-4 py-6 space-y-6">
        <form onSubmit={handleOpenSaveConfirm} className="space-y-6">
          {/* Item Preview */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 flex items-center gap-4">
            <img
              src={imageUrl || product.imageUrl}
              alt={product.name}
              className="h-20 w-20 rounded-2xl object-cover bg-stone-950 border border-stone-800 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-stone-400">
                  {product.categoryName}
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isAvailable ? "bg-emerald-950 text-[#00A86B]" : "bg-rose-950 text-rose-400"
                  }`}
                >
                  {isAvailable ? "In Stock" : "86'd / Sold Out"}
                </span>
              </div>
              <h2 className="text-base font-black text-white truncate mt-0.5">
                {name || product.name}
              </h2>
              <p className="text-sm font-bold font-display text-[#00A86B] mt-0.5">
                {formatPrice(Number(price) || 0)}
              </p>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 space-y-4">
            <h2 className="text-xs font-black uppercase text-stone-400 tracking-wider">
              Item Details
            </h2>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1">
                Item Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:outline-none focus:border-[#00A86B]"
              />
            </div>

            {/* Price in Philippine Peso */}
            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1">
                Price in Philippine Peso (PHP ₱) <span className="text-rose-500">*</span>
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 font-bold font-mono text-xs">
                  ₱
                </span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs font-mono font-bold text-white focus:outline-none focus:border-[#00A86B]"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1">
                Item Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:outline-none focus:border-[#00A86B] resize-none"
              />
            </div>
          </div>

          {/* Availability & Featured Toggles */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 space-y-4">
            <h2 className="text-xs font-black uppercase text-stone-400 tracking-wider">
              Inventory & Display Flags
            </h2>

            {/* In Stock Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-950 border border-stone-800">
              <div>
                <p className="text-xs font-bold text-stone-200">Stock Availability (In Stock / 86'd)</p>
                <p className="text-[10px] text-stone-500">
                  {isAvailable ? "Available to customers for checkout" : "Disabled and marked as Sold Out"}
                </p>
              </div>
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="h-5 w-5 rounded accent-[#00A86B] cursor-pointer"
              />
            </div>

            {/* Popular Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-950 border border-stone-800">
              <div className="flex items-center gap-2.5">
                <Flame className={`h-4 w-4 ${popular ? "text-amber-400 fill-amber-400" : "text-stone-500"}`} />
                <div>
                  <p className="text-xs font-bold text-stone-200">Featured / Popular Tag</p>
                  <p className="text-[10px] text-stone-500">Highlight in customer carousel</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={popular}
                onChange={(e) => setPopular(e.target.checked)}
                className="h-5 w-5 rounded accent-[#00A86B] cursor-pointer"
              />
            </div>
          </div>

          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 space-y-3">
            <div><h2 className="text-xs font-black uppercase text-stone-400 tracking-wider">Required Ingredients</h2><p className="text-[10px] text-stone-500 mt-1">Linked stock controls this product's availability.</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ingredients.filter((ingredient) => !ingredient.isArchived).map((ingredient) => (
                <label key={ingredient.id} className="min-h-11 px-3 rounded-xl bg-stone-950 border border-stone-800 flex items-center gap-2 text-xs font-bold text-stone-200 cursor-pointer">
                  <input type="checkbox" checked={ingredientIds.includes(ingredient.id)} onChange={(event) => setIngredientIds((previous) => event.target.checked ? [...previous, ingredient.id] : previous.filter((id) => id !== ingredient.id))} className="h-4 w-4 accent-[#00A86B]" />
                  {ingredient.name}
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setIsConfirmDeleteOpen(true)}
              className="px-4 py-2.5 rounded-xl border border-rose-900/80 bg-rose-950/40 text-rose-400 text-xs font-bold hover:bg-rose-950 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Item</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="px-5 py-2.5 rounded-xl border border-stone-800 bg-stone-900 text-stone-300 text-xs font-bold hover:bg-stone-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-[#00A86B] hover:bg-emerald-600 text-black text-xs font-black transition-all cursor-pointer flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </main>

      {/* 3. CONFIRM SAVE DIALOG */}
      <ConfirmDialog
        isOpen={isConfirmSaveOpen}
        title="Save Product Changes?"
        message={`Confirm updating "${name}" at ${formatPrice(Number(price) || 0)} with availability: ${
          isAvailable ? "In Stock" : "86'd (Sold Out)"
        }?`}
        confirmLabel={isSubmitting ? "Saving..." : "Yes, Save Changes"}
        variant="primary"
        isLoading={isSubmitting}
        onConfirm={handleExecuteSave}
        onCancel={() => setIsConfirmSaveOpen(false)}
      />

      {/* 4. CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        title="Delete Menu Item?"
        message={`Are you sure you want to permanently delete "${product.name}"? This action cannot be undone.`}
        confirmLabel={isSubmitting ? "Deleting..." : "Permanently Delete"}
        variant="danger"
        isLoading={isSubmitting}
        onConfirm={handleExecuteDelete}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />

      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
