import React, { useState } from "react";
import { ArrowLeft, Plus, Image as ImageIcon, Flame, Check, AlertCircle, RefreshCw } from "lucide-react";
import { CATEGORIES } from "../data/menuData";
import { formatPrice } from "../lib/utils";
import { navigate } from "../lib/router";
import { StaffGuard } from "../components/staff/StaffGuard";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ToastNotification } from "../components/ui/ToastNotification";

const PRESET_IMAGES = [
  { label: "Espresso / Latte", url: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&auto=format&fit=crop&q=80" },
  { label: "Iced Spanish Latte", url: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80" },
  { label: "Matcha Latte", url: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80" },
  { label: "Croissant / Pastry", url: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80" },
  { label: "Cold Brew", url: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80" },
];

export const AdminProductNewPage: React.FC = () => {
  return (
    <StaffGuard
      pinEnvKey="ADMIN_PIN"
      title="Admin Portal Access"
      subtitle="Enter security PIN to create new products"
      roleName="Inventory Manager"
      defaultPin="9999"
    >
      <AdminProductNewContent />
    </StaffGuard>
  );
};

const AdminProductNewContent: React.FC = () => {
  const [name, setName] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("cat_coffee");
  const [price, setPrice] = useState<string>("165");
  const [description, setDescription] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>(PRESET_IMAGES[0].url);
  const [popular, setPopular] = useState<boolean>(false);
  const [sweetnessAdjustable, setSweetnessAdjustable] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setToast({ message: "Product name is required", type: "error" });
      return;
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setToast({ message: "Please enter a valid price in PHP", type: "error" });
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleExecuteSave = async () => {
    setIsSubmitting(true);
    try {
      const selectedCategory = CATEGORIES.find((c) => c.id === categoryId);
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          categoryId,
          categoryName: selectedCategory?.name || "Artisan Coffee",
          price: Number(price),
          description: description.trim(),
          imageUrl: imageUrl.trim(),
          popular,
          isAvailable: true,
          sweetnessAdjustable,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to create product (${res.status})`);
      }

      setToast({ message: `Created "${name}" successfully!`, type: "success" });
      setTimeout(() => {
        navigate("/admin");
      }, 1000);
    } catch (err: any) {
      setToast({ message: err?.message || "Failed to create product", type: "error" });
    } finally {
      setIsSubmitting(false);
      setIsConfirmOpen(false);
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

          <h1 className="text-sm font-black text-white">Add New Menu Item</h1>

          <div className="w-9" />
        </div>
      </header>

      {/* 2. FORM BODY */}
      <main className="max-w-3xl w-full mx-auto px-4 py-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Preview Card */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 flex items-center gap-4">
            <img
              src={imageUrl || PRESET_IMAGES[0].url}
              alt="Preview"
              className="h-20 w-20 rounded-2xl object-cover bg-stone-950 border border-stone-800 shrink-0"
            />
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-[#00A86B]">
                {CATEGORIES.find((c) => c.id === categoryId)?.name || "Artisan Coffee"}
              </span>
              <h2 className="text-base font-black text-white truncate">
                {name || "Untitled Menu Item"}
              </h2>
              <p className="text-sm font-bold font-display text-[#00A86B] mt-0.5">
                {formatPrice(Number(price) || 0)}
              </p>
            </div>
          </div>

          {/* Core Info */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 space-y-4">
            <h2 className="text-xs font-black uppercase text-stone-400 tracking-wider">
              Product Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Spanish Latte"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:outline-none focus:border-[#00A86B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:outline-none focus:border-[#00A86B]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
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
                Item Description & Tasting Notes
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Rich espresso blended with condensed milk and steamed fresh milk..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:outline-none focus:border-[#00A86B] resize-none"
              />
            </div>
          </div>

          {/* Image Selection */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 space-y-4">
            <h2 className="text-xs font-black uppercase text-stone-400 tracking-wider">
              Product Image
            </h2>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1.5">
                Preset Image Library
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PRESET_IMAGES.map((img) => (
                  <button
                    key={img.label}
                    type="button"
                    onClick={() => setImageUrl(img.url)}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      imageUrl === img.url
                        ? "border-[#00A86B] bg-[#00A86B]/10"
                        : "border-stone-800 bg-stone-950 hover:border-stone-700"
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.label}
                      className="h-16 w-full object-cover rounded-lg mb-1.5"
                    />
                    <p className="text-[10px] font-bold text-stone-300 truncate">{img.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1">Custom Image URL</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:outline-none focus:border-[#00A86B]"
              />
            </div>
          </div>

          {/* Options & Flags */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 space-y-4">
            <h2 className="text-xs font-black uppercase text-stone-400 tracking-wider">
              Item Settings & Attributes
            </h2>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-950 border border-stone-800">
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

            {/* Sweetness */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-950 border border-stone-800">
              <div>
                <p className="text-xs font-bold text-stone-200">Sweetness Adjustable</p>
                <p className="text-[10px] text-stone-500">Allow customer to pick sugar level</p>
              </div>
              <input
                type="checkbox"
                checked={sweetnessAdjustable}
                onChange={(e) => setSweetnessAdjustable(e.target.checked)}
                className="h-5 w-5 rounded accent-[#00A86B] cursor-pointer"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
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
              <Plus className="h-4 w-4" />
              <span>Create Product</span>
            </button>
          </div>
        </form>
      </main>

      {/* 3. CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Add New Menu Item?"
        message={`Confirm adding "${name}" priced at ${formatPrice(Number(price) || 0)} to the live catalog?`}
        confirmLabel={isSubmitting ? "Creating..." : "Yes, Add Item"}
        variant="primary"
        isLoading={isSubmitting}
        onConfirm={handleExecuteSave}
        onCancel={() => setIsConfirmOpen(false)}
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
