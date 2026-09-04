import { getDb } from "../lib/prisma";
import {
  CreateIngredientInput,
  IngredientDto,
  UpdateIngredientInput,
} from "./types";

/**
 * Maps a Prisma Ingredient entity to a clean IngredientDto.
 */
export function mapIngredientToDto(ingredient: {
  id: string;
  name: string;
  isAvailable: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}): IngredientDto {
  return {
    id: ingredient.id,
    name: ingredient.name,
    isAvailable: ingredient.isAvailable,
    isArchived: ingredient.isArchived,
    createdAt: ingredient.createdAt,
    updatedAt: ingredient.updatedAt,
  };
}

/**
 * Lists ingredients, optionally filtering archived ones.
 */
export async function listIngredients(options?: {
  includeArchived?: boolean;
}): Promise<IngredientDto[]> {
  const db = getDb();
  const where = options?.includeArchived ? {} : { isArchived: false };

  const ingredients = await db.ingredient.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return ingredients.map(mapIngredientToDto);
}

/**
 * Gets a single ingredient by ID.
 */
export async function getIngredientById(id: string): Promise<IngredientDto | null> {
  const db = getDb();
  const ingredient = await db.ingredient.findUnique({
    where: { id },
  });

  return ingredient ? mapIngredientToDto(ingredient) : null;
}

/**
 * Creates a new ingredient.
 */
export async function createIngredient(
  input: CreateIngredientInput
): Promise<IngredientDto> {
  const db = getDb();
  const id = input.id?.trim() || `ingredient_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const ingredient = await db.ingredient.create({
    data: {
      id,
      name: input.name.trim(),
      isAvailable: input.isAvailable !== false,
      isArchived: false,
    },
  });

  return mapIngredientToDto(ingredient);
}

/**
 * Updates an ingredient's properties. If availability or archived status changes,
 * recalculates all affected products.
 */
export async function updateIngredient(
  id: string,
  input: UpdateIngredientInput
): Promise<IngredientDto> {
  const db = getDb();

  const existing = await db.ingredient.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`Ingredient with ID '${id}' not found`);
  }

  const updated = await db.ingredient.update({
    where: { id },
    data: {
      name: input.name !== undefined ? input.name.trim() : undefined,
      isAvailable: input.isAvailable !== undefined ? input.isAvailable : undefined,
      isArchived: input.isArchived !== undefined ? input.isArchived : undefined,
    },
  });

  if (
    input.isAvailable !== undefined ||
    input.isArchived !== undefined
  ) {
    await recalculateAffectedProducts(id);
  }

  return mapIngredientToDto(updated);
}

/**
 * Archives an ingredient (soft delete). Marks it unavailable and recalculates affected products.
 */
export async function archiveIngredient(id: string): Promise<IngredientDto> {
  const db = getDb();

  const updated = await db.ingredient.update({
    where: { id },
    data: {
      isArchived: true,
      isAvailable: false,
    },
  });

  await recalculateAffectedProducts(id);

  return mapIngredientToDto(updated);
}

/**
 * Toggles an ingredient's availability and recalculates all affected products in real time.
 */
export async function setIngredientAvailability(
  id: string,
  isAvailable: boolean
): Promise<IngredientDto> {
  const db = getDb();

  const updated = await db.ingredient.update({
    where: { id },
    data: { isAvailable },
  });

  await recalculateAffectedProducts(id);

  return mapIngredientToDto(updated);
}

/**
 * Recalculates and persists availability for a single product according to the canonical rule:
 *
 *   isAvailable = product.manualAvailability === true
 *                 && product.isArchived === false
 *                 && every required ProductIngredient has ingredient.isAvailable === true
 *                    && !ingredient.isArchived
 *
 * Returns the computed boolean availability.
 */
export async function recalculateProductAvailability(productId: string): Promise<boolean> {
  const db = getDb();

  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      ingredients: {
        include: {
          ingredient: true,
        },
      },
    },
  });

  if (!product) return false;

  const isAvailable =
    product.manualAvailability === true &&
    product.isArchived === false &&
    product.ingredients.every((pi) =>
      pi.isRequired ? pi.ingredient.isAvailable && !pi.ingredient.isArchived : true
    );

  if (product.isAvailable !== isAvailable) {
    await db.product.update({
      where: { id: productId },
      data: { isAvailable },
    });
  }

  return isAvailable;
}

/**
 * Finds all products that depend on a given ingredient (via `product_ingredients`),
 * recomputes their availability, and returns the affected product IDs.
 */
export async function recalculateAffectedProducts(ingredientId: string): Promise<string[]> {
  const db = getDb();

  const relations = await db.productIngredient.findMany({
    where: { ingredientId },
    select: { productId: true },
  });

  const uniqueProductIds = Array.from(new Set(relations.map((r) => r.productId)));

  await Promise.all(
    uniqueProductIds.map((productId) => recalculateProductAvailability(productId))
  );

  return uniqueProductIds;
}
