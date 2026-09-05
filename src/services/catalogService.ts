import { Prisma } from "@prisma/client";
import { getDb } from "../lib/prisma";
import { AppError } from "./errors";
import { recalculateProductAvailability } from "./inventoryService";
import { decimalToNumber, toDecimal } from "./serialization";
import {
  CategoryDto,
  CreateProductInput,
  CustomizationGroupDto,
  CustomizationOptionDto,
  ListProductsOptions,
  ProductCustomizationGroupDto,
  ProductCustomizationOptionDto,
  ProductDto,
  ProductIngredientDto,
  UpdateProductInput,
} from "./types";

// Standard include object for pulling full product relational graph
export const productFullInclude = {
  category: true,
  ingredients: {
    include: {
      ingredient: true,
    },
  },
  customizationGroups: {
    include: {
      group: {
        include: {
          options: {
            where: { isArchived: false },
            orderBy: { name: "asc" },
          },
        },
      },
    },
    orderBy: {
      sortOrder: "asc",
    },
  },
  allowedOptions: {
    include: {
      option: {
        include: {
          group: true,
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export type DbProductFull = Prisma.ProductGetPayload<{
  include: typeof productFullInclude;
}>;

async function fetchDbProductFull(id: string): Promise<DbProductFull | null> {
  const db = getDb();
  return db.product.findUnique({
    where: { id },
    include: productFullInclude,
  });
}

/**
 * Maps a full Prisma Product entity with relations into a typed ProductDto.
 */
export function mapProductToDto(product: DbProductFull): ProductDto {
  const categoryDto: CategoryDto | undefined = product.category
    ? {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
        description: product.category.description,
        icon: product.category.icon,
        sortOrder: product.category.sortOrder,
        createdAt: product.category.createdAt,
        updatedAt: product.category.updatedAt,
      }
    : undefined;

  const ingredientsDto: ProductIngredientDto[] = (product.ingredients || []).map(
    (pi) => ({
      productId: pi.productId,
      ingredientId: pi.ingredientId,
      isRequired: pi.isRequired,
      ingredient: {
        id: pi.ingredient.id,
        name: pi.ingredient.name,
        isAvailable: pi.ingredient.isAvailable,
        isArchived: pi.ingredient.isArchived,
        createdAt: pi.ingredient.createdAt,
        updatedAt: pi.ingredient.updatedAt,
      },
    })
  );

  const customizationGroupsDto: ProductCustomizationGroupDto[] = (
    product.customizationGroups || []
  ).map((pcg) => ({
    productId: pcg.productId,
    groupId: pcg.groupId,
    sortOrder: pcg.sortOrder,
    group: {
      id: pcg.group.id,
      name: pcg.group.name,
      selectionMode: pcg.group.selectionMode,
      isRequired: pcg.group.isRequired,
      sortOrder: pcg.group.sortOrder,
      isActive: pcg.group.isActive,
      isArchived: pcg.group.isArchived,
      options: (pcg.group.options || []).map((opt) => ({
        id: opt.id,
        groupId: opt.groupId,
        name: opt.name,
        priceModifier: decimalToNumber(opt.priceModifier),
        isActive: opt.isActive,
        isArchived: opt.isArchived,
        createdAt: opt.createdAt,
        updatedAt: opt.updatedAt,
      })),
      createdAt: pcg.group.createdAt,
      updatedAt: pcg.group.updatedAt,
    },
  }));

  const allowedOptionsDto: ProductCustomizationOptionDto[] = (
    product.allowedOptions || []
  ).map((pco) => ({
    productId: pco.productId,
    optionId: pco.optionId,
    option: {
      id: pco.option.id,
      groupId: pco.option.groupId,
      name: pco.option.name,
      priceModifier: decimalToNumber(pco.option.priceModifier),
      isActive: pco.option.isActive,
      isArchived: pco.option.isArchived,
      createdAt: pco.option.createdAt,
      updatedAt: pco.option.updatedAt,
    },
  }));

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: decimalToNumber(product.price),
    imageUrl: product.imageUrl,
    categoryId: product.categoryId,
    category: categoryDto,
    isAvailable: product.isAvailable,
    manualAvailability: product.manualAvailability,
    popular: product.popular,
    isArchived: product.isArchived,
    ingredients: ingredientsDto,
    customizationGroups: customizationGroupsDto,
    allowedOptions: allowedOptionsDto,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

/**
 * Lists products from the database with their full relational associations.
 * Excludes archived products by default unless options.includeArchived is true.
 */
export async function listProducts(
  options?: ListProductsOptions
): Promise<ProductDto[]> {
  const db = getDb();

  const where: any = {};

  if (!options?.includeArchived) {
    where.isArchived = false;
  }

  if (options?.categoryId && options.categoryId !== "all") {
    where.categoryId = options.categoryId;
  }

  if (options?.isAvailable !== undefined) {
    where.isAvailable = options.isAvailable;
  }

  const products = await db.product.findMany({
    where,
    include: productFullInclude,
    orderBy: [
      { popular: "desc" },
      { name: "asc" },
    ],
  });

  return products.map(mapProductToDto);
}

/**
 * Retrieves a single product by ID with full relations.
 */
export async function getProductById(
  id: string,
  options?: { includeArchived?: boolean }
): Promise<ProductDto | null> {
  const product = await fetchDbProductFull(id);
  if (!product) return null;
  if (!options?.includeArchived && product.isArchived) return null;

  return mapProductToDto(product);
}

/**
 * Creates a new product and associates its relations (ingredients, groups, allowed options).
 * Computes availability immediately based on manualAvailability and ingredients.
 */
export async function createProduct(
  input: CreateProductInput
): Promise<ProductDto> {
  const db = getDb();
  const id = input.id?.trim() || undefined;

  // 1. Verify category exists
  const categoryExists = await db.category.findUnique({
    where: { id: input.categoryId },
  });
  if (!categoryExists) {
    throw new Error(`Category with ID '${input.categoryId}' does not exist`);
  }

  // 2. Prepare nested relational creations
  const ingredientCreates = (input.ingredients || []).map((ing) => ({
    ingredientId: ing.ingredientId,
    isRequired: ing.isRequired !== false,
  }));

  const groupCreates = (input.customizationGroupIds || []).map((item, idx) => {
    if (typeof item === "string") {
      return { groupId: item, sortOrder: idx };
    }
    return { groupId: item.groupId, sortOrder: item.sortOrder ?? idx };
  });

  const optionCreates = (input.allowedOptionIds || []).map((optionId) => ({
    optionId,
  }));

  // Validate that every allowlisted option exists and belongs to a group linked
  // to the product. Prevents orphaned allowed options that would be rejected at
  // checkout (OPTION_NOT_FOUND / OPTION_NOT_ALLOWED).
  if (optionCreates.length > 0) {
    const linkedGroupIds = groupCreates.map((g) => g.groupId);
    const allowedOptionsInDb = await db.customizationOption.findMany({
      where: { id: { in: optionCreates.map((o) => o.optionId) } },
      include: { group: true },
    });
    const allowedOptionMap = new Map(allowedOptionsInDb.map((o) => [o.id, o]));

    for (const oc of optionCreates) {
      const opt = allowedOptionMap.get(oc.optionId);
      if (!opt) {
        throw new AppError(404, "OPTION_NOT_FOUND", `Customization option '${oc.optionId}' does not exist`);
      }
      if (!linkedGroupIds.includes(opt.groupId)) {
        throw new AppError(400, "INVALID_OPTION_GROUP", `Customization option "${opt.name}" belongs to a group not linked to this product`);
      }
    }
  }

  // 3. Create product record
  const created = await db.product.create({
    data: {
      id,
      name: input.name.trim(),
      description: input.description.trim(),
      price: toDecimal(input.price),
      imageUrl: input.imageUrl.trim(),
      categoryId: input.categoryId,
      manualAvailability: input.manualAvailability !== false,
      popular: Boolean(input.popular),
      isArchived: false,
      isAvailable: input.manualAvailability !== false, // Initial, will recompute below
      ingredients: ingredientCreates.length
        ? { create: ingredientCreates }
        : undefined,
      customizationGroups: groupCreates.length
        ? { create: groupCreates }
        : undefined,
      allowedOptions: optionCreates.length
        ? { create: optionCreates }
        : undefined,
    },
  });

  // 4. Recompute availability using canonical engine
  await recalculateProductAvailability(created.id);

  // 5. Fetch full loaded product
  const full = await fetchDbProductFull(created.id);
  if (!full) {
    throw new Error(`Failed to load created product '${created.id}'`);
  }

  return mapProductToDto(full);
}

/**
 * Updates an existing product and its relational mappings.
 * Recomputes availability based on current DB state.
 */
export async function updateProduct(
  id: string,
  input: UpdateProductInput
): Promise<ProductDto> {
  const db = getDb();

  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`Product with ID '${id}' not found`);
  }

  if (input.categoryId) {
    const categoryExists = await db.category.findUnique({
      where: { id: input.categoryId },
    });
    if (!categoryExists) {
      throw new Error(`Category with ID '${input.categoryId}' does not exist`);
    }
  }

  // Handle nested updates in a transaction if relations are provided
  await db.$transaction(async (tx) => {
    // 1. Update basic product fields
    await tx.product.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        description: input.description !== undefined ? input.description.trim() : undefined,
        price: input.price !== undefined ? toDecimal(input.price) : undefined,
        imageUrl: input.imageUrl !== undefined ? input.imageUrl.trim() : undefined,
        categoryId: input.categoryId || undefined,
        manualAvailability: input.manualAvailability !== undefined ? input.manualAvailability : undefined,
        popular: input.popular !== undefined ? input.popular : undefined,
        isArchived: input.isArchived !== undefined ? input.isArchived : undefined,
      },
    });

    // 2. Update ingredients if specified
    if (input.ingredients !== undefined) {
      await tx.productIngredient.deleteMany({ where: { productId: id } });
      if (input.ingredients.length > 0) {
        await tx.productIngredient.createMany({
          data: input.ingredients.map((ing) => ({
            productId: id,
            ingredientId: ing.ingredientId,
            isRequired: ing.isRequired !== false,
          })),
        });
      }
    }

    // 3. Update customization groups if specified
    if (input.customizationGroupIds !== undefined) {
      await tx.productCustomizationGroup.deleteMany({ where: { productId: id } });
      if (input.customizationGroupIds.length > 0) {
        await tx.productCustomizationGroup.createMany({
          data: input.customizationGroupIds.map((item, idx) => ({
            productId: id,
            groupId: typeof item === "string" ? item : item.groupId,
            sortOrder: typeof item === "string" ? idx : item.sortOrder ?? idx,
          })),
        });
      }
    }

    // 4. Update allowed options if specified
    if (input.allowedOptionIds !== undefined) {
      // Validate against the incoming group list when provided, otherwise the
      // product's existing group links, so the allowlist never references an
      // option from an unlinked group.
      if (input.allowedOptionIds.length > 0) {
        let linkedGroupIds: string[];
        if (input.customizationGroupIds !== undefined) {
          linkedGroupIds = input.customizationGroupIds.map((g) =>
            typeof g === "string" ? g : g.groupId
          );
        } else {
          const links = await tx.productCustomizationGroup.findMany({
            where: { productId: id },
            select: { groupId: true },
          });
          linkedGroupIds = links.map((l) => l.groupId);
        }

        const allowedOptionsInDb = await tx.customizationOption.findMany({
          where: { id: { in: input.allowedOptionIds } },
          include: { group: true },
        });
        const allowedOptionMap = new Map(allowedOptionsInDb.map((o) => [o.id, o]));

        for (const optionId of input.allowedOptionIds) {
          const opt = allowedOptionMap.get(optionId);
          if (!opt) {
            throw new AppError(404, "OPTION_NOT_FOUND", `Customization option '${optionId}' does not exist`);
          }
          if (!linkedGroupIds.includes(opt.groupId)) {
            throw new AppError(400, "INVALID_OPTION_GROUP", `Customization option "${opt.name}" belongs to a group not linked to this product`);
          }
        }
      }

      await tx.productCustomizationOption.deleteMany({ where: { productId: id } });
      if (input.allowedOptionIds.length > 0) {
        await tx.productCustomizationOption.createMany({
          data: input.allowedOptionIds.map((optionId) => ({
            productId: id,
            optionId,
          })),
        });
      }
    }
  });

  // Recompute availability
  await recalculateProductAvailability(id);

  const full = await fetchDbProductFull(id);
  if (!full) {
    throw new Error(`Product with ID '${id}' not found after update`);
  }

  return mapProductToDto(full);
}

/**
 * Soft-deletes a product by marking it archived and unavailable.
 */
export async function archiveProduct(id: string): Promise<ProductDto> {
  const db = getDb();

  await db.product.update({
    where: { id },
    data: {
      isArchived: true,
      isAvailable: false,
    },
  });

  const full = await fetchDbProductFull(id);
  if (!full) {
    throw new Error(`Product with ID '${id}' not found`);
  }

  return mapProductToDto(full);
}
