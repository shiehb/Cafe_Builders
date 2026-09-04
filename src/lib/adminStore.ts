import { CATEGORIES, PRODUCTS } from "../data/menuData";
import { Category, CustomizationGroupConfig, CustomizationOptionConfig, Ingredient, Product } from "../types";

export const ingredientsStore = new Map<string, Ingredient>([
  ["ingredient_matcha", { id: "ingredient_matcha", name: "Matcha", isAvailable: true }],
  ["ingredient_milk", { id: "ingredient_milk", name: "Whole Milk", isAvailable: true }],
  ["ingredient_oat_milk", { id: "ingredient_oat_milk", name: "Oat Milk", isAvailable: true }],
  ["ingredient_almond_milk", { id: "ingredient_almond_milk", name: "Almond Milk", isAvailable: true }],
  ["ingredient_soy_milk", { id: "ingredient_soy_milk", name: "Soy Milk", isAvailable: true }],
  ["ingredient_coffee_beans", { id: "ingredient_coffee_beans", name: "Coffee Beans", isAvailable: true }],
]);

export const productsStore = new Map<string, Product>(PRODUCTS.map((product) => [product.id, {
  ...product,
  productType: product.categoryId === "cat_pastries" || product.categoryId === "cat_brunch" ? "FOOD" : "BEVERAGE",
  categoryIds: [product.categoryId],
  ingredientIds: product.ingredientIds || [
    ...(product.categoryId === "cat_matcha" ? ["ingredient_matcha"] : []),
    ...(product.categoryId === "cat_coffee" ? ["ingredient_coffee_beans"] : []),
    ...(product.milkOptionsAvailable ? ["ingredient_milk", "ingredient_oat_milk"] : []),
  ],
  manualAvailability: product.isAvailable,
}]));

export const categoriesStore = new Map<string, Category>(CATEGORIES.filter((category) => category.id !== "all").map((category) => [category.id, { ...category, productType: category.id === "cat_pastries" || category.id === "cat_brunch" ? "FOOD" : "BEVERAGE", isActive: true }]));

export const groupsStore = new Map<string, CustomizationGroupConfig>([
  ["group_ice", { id: "group_ice", name: "Ice Level", selectionMode: "SINGLE", isActive: true, isRequired: true, sortOrder: 1 }],
  ["group_sugar", { id: "group_sugar", name: "Sugar Level", selectionMode: "SINGLE", isActive: true, isRequired: true, sortOrder: 2 }],
  ["group_milk", { id: "group_milk", name: "Milk Choices", selectionMode: "SINGLE", isActive: true, isRequired: false, sortOrder: 3 }],
  ["group_addons", { id: "group_addons", name: "Add-ons", selectionMode: "MULTIPLE", isActive: true, isRequired: false, sortOrder: 4 }],
]);

export const optionsStore = new Map<string, CustomizationOptionConfig>([
  ["option_ice_less", { id: "option_ice_less", groupId: "group_ice", name: "Less", priceModifier: 0, isActive: true }],
  ["option_ice_regular", { id: "option_ice_regular", groupId: "group_ice", name: "Regular", priceModifier: 0, isActive: true }],
  ["option_ice_extra", { id: "option_ice_extra", groupId: "group_ice", name: "Extra", priceModifier: 0, isActive: true }],
  ["option_sugar_less", { id: "option_sugar_less", groupId: "group_sugar", name: "Less Sweet", priceModifier: 0, isActive: true }],
  ["option_sugar_regular", { id: "option_sugar_regular", groupId: "group_sugar", name: "Regular", priceModifier: 0, isActive: true }],
  ["option_sugar_more", { id: "option_sugar_more", groupId: "group_sugar", name: "More Sweet", priceModifier: 0, isActive: true }],
  ["option_milk_whole", { id: "option_milk_whole", groupId: "group_milk", name: "Whole Milk", priceModifier: 0, isActive: true }],
  ["option_milk_oat", { id: "option_milk_oat", groupId: "group_milk", name: "Oat Milk", priceModifier: 25, isActive: true }],
  ["option_milk_almond", { id: "option_milk_almond", groupId: "group_milk", name: "Almond Milk", priceModifier: 25, isActive: true }],
  ["option_milk_soy", { id: "option_milk_soy", groupId: "group_milk", name: "Soy Milk", priceModifier: 20, isActive: true }],
  ["option_addon_shot", { id: "option_addon_shot", groupId: "group_addons", name: "Extra Shot", priceModifier: 30, isActive: true }],
  ["option_addon_jelly", { id: "option_addon_jelly", groupId: "group_addons", name: "Coffee Jelly", priceModifier: 25, isActive: true }],
  ["option_addon_vanilla", { id: "option_addon_vanilla", groupId: "group_addons", name: "Vanilla Syrup", priceModifier: 20, isActive: true }],
]);

export function recomputeProductAvailability(product: Product) {
  const unavailable = (product.ingredientIds || []).map((id) => ingredientsStore.get(id)).find((ingredient) => ingredient && !ingredient.isAvailable);
  product.isAvailable = product.manualAvailability !== false && !unavailable;
  return product;
}

export function recomputeAllProductAvailability() {
  for (const product of productsStore.values()) recomputeProductAvailability(product);
}

export function ingredientProducts(ingredientId: string) {
  return Array.from(productsStore.values()).filter((product) => product.ingredientIds?.includes(ingredientId));
}

export function publicCatalog() {
  recomputeAllProductAvailability();
  return Array.from(productsStore.values()).filter((product) => !product.isArchived).map((product) => ({
    ...product,
    categories: (product.categoryIds || [product.categoryId]).map((id) => categoriesStore.get(id)).filter(Boolean),
    customizationGroups: (product.enabledCustomizationGroups || []).map((id) => groupsStore.get(`group_${id}`) || groupsStore.get(id)).filter(Boolean).map((group) => ({
      ...group,
      options: Array.from(optionsStore.values()).filter((option) => option.groupId === group!.id && option.isActive && !option.isArchived),
    })),
    availabilityReason: product.isAvailable ? null : "INGREDIENT_UNAVAILABLE",
  }));
}

export function validateName(name: unknown) {
  const value = String(name || "").trim();
  if (!value || /hot|iced|temperature|emoji/i.test(value)) return null;
  return value;
}
