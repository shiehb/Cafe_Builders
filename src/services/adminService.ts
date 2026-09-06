import { getDb } from "../lib/prisma";
import * as catalogService from "./catalogService";
import * as inventoryService from "./inventoryService";
import { decimalToNumber, toDecimal } from "./serialization";
import {
  CategoryDto,
  CreateCategoryInput,
  CreateCustomizationGroupInput,
  CreateCustomizationOptionInput,
  CustomizationGroupDto,
  CustomizationOptionDto,
  UpdateCategoryInput,
  UpdateCustomizationGroupInput,
  UpdateCustomizationOptionInput,
} from "./types";

// ============================================================================
// 1. CATEGORIES CRUD
// ============================================================================

export function mapCategoryToDto(category: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    icon: category.icon,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export async function listCategories(): Promise<CategoryDto[]> {
  const db = getDb();
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return categories.map(mapCategoryToDto);
}

export async function getCategoryById(id: string): Promise<CategoryDto | null> {
  const db = getDb();
  const category = await db.category.findUnique({
    where: { id },
  });
  return category ? mapCategoryToDto(category) : null;
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryDto> {
  const db = getDb();
  const name = input.name.trim();
  const slug =
    input.slug?.trim() ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const id = input.id?.trim() || `cat_${slug}_${Date.now().toString(36).slice(2, 6)}`;

  const category = await db.category.create({
    data: {
      id,
      name,
      slug,
      description: input.description?.trim() || null,
      icon: input.icon?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
    },
  });

  return mapCategoryToDto(category);
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput
): Promise<CategoryDto> {
  const db = getDb();

  const category = await db.category.update({
    where: { id },
    data: {
      name: input.name !== undefined ? input.name.trim() : undefined,
      slug: input.slug !== undefined ? input.slug.trim() : undefined,
      description: input.description !== undefined ? input.description?.trim() || null : undefined,
      icon: input.icon !== undefined ? input.icon?.trim() || null : undefined,
      sortOrder: input.sortOrder !== undefined ? input.sortOrder : undefined,
    },
  });

  return mapCategoryToDto(category);
}

export async function deleteCategory(id: string): Promise<CategoryDto> {
  const db = getDb();
  const deleted = await db.category.delete({
    where: { id },
  });
  return mapCategoryToDto(deleted);
}

// ============================================================================
// 2. CUSTOMIZATION GROUPS CRUD
// ============================================================================

export function mapCustomizationGroupToDto(group: {
  id: string;
  name: string;
  selectionMode: any;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  isArchived: boolean;
  options?: any[];
  createdAt: Date;
  updatedAt: Date;
}): CustomizationGroupDto {
  return {
    id: group.id,
    name: group.name,
    selectionMode: group.selectionMode,
    isRequired: group.isRequired,
    sortOrder: group.sortOrder,
    isActive: group.isActive,
    isArchived: group.isArchived,
    options: group.options?.map((opt) => mapCustomizationOptionToDto(opt)),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export async function listCustomizationGroups(options?: {
  includeArchived?: boolean;
}): Promise<CustomizationGroupDto[]> {
  const db = getDb();
  const where = options?.includeArchived ? {} : { isArchived: false };

  const groups = await db.customizationGroup.findMany({
    where,
    include: {
      options: {
        where: options?.includeArchived ? {} : { isArchived: false },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return groups.map(mapCustomizationGroupToDto);
}

export async function getCustomizationGroupById(
  id: string
): Promise<CustomizationGroupDto | null> {
  const db = getDb();
  const group = await db.customizationGroup.findUnique({
    where: { id },
    include: {
      options: {
        where: { isArchived: false },
      },
    },
  });

  return group ? mapCustomizationGroupToDto(group) : null;
}

export async function createCustomizationGroup(
  input: CreateCustomizationGroupInput
): Promise<CustomizationGroupDto> {
  const db = getDb();
  const id = input.id?.trim() || `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const group = await db.customizationGroup.create({
    data: {
      id,
      name: input.name.trim(),
      selectionMode: input.selectionMode || "SINGLE",
      isRequired: Boolean(input.isRequired),
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive !== false,
      isArchived: false,
    },
    include: {
      options: true,
    },
  });

  return mapCustomizationGroupToDto(group);
}

export async function updateCustomizationGroup(
  id: string,
  input: UpdateCustomizationGroupInput
): Promise<CustomizationGroupDto> {
  const db = getDb();

  const group = await db.customizationGroup.update({
    where: { id },
    data: {
      name: input.name !== undefined ? input.name.trim() : undefined,
      selectionMode: input.selectionMode || undefined,
      isRequired: input.isRequired !== undefined ? input.isRequired : undefined,
      sortOrder: input.sortOrder !== undefined ? input.sortOrder : undefined,
      isActive: input.isActive !== undefined ? input.isActive : undefined,
      isArchived: input.isArchived !== undefined ? input.isArchived : undefined,
    },
    include: {
      options: true,
    },
  });

  return mapCustomizationGroupToDto(group);
}

export async function archiveCustomizationGroup(
  id: string
): Promise<CustomizationGroupDto> {
  const db = getDb();

  const group = await db.customizationGroup.update({
    where: { id },
    data: {
      isArchived: true,
      isActive: false,
    },
    include: {
      options: true,
    },
  });

  return mapCustomizationGroupToDto(group);
}

// ============================================================================
// 3. CUSTOMIZATION OPTIONS CRUD
// ============================================================================

export function mapCustomizationOptionToDto(option: {
  id: string;
  groupId: string;
  name: string;
  priceModifier: any;
  ingredientId?: string | null;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CustomizationOptionDto {
  return {
    id: option.id,
    groupId: option.groupId,
    name: option.name,
    priceModifier: decimalToNumber(option.priceModifier),
    ingredientId: option.ingredientId ?? null,
    ingredient: null,
    isActive: option.isActive,
    isArchived: option.isArchived,
    createdAt: option.createdAt,
    updatedAt: option.updatedAt,
  };
}

export async function listCustomizationOptions(options?: {
  groupId?: string;
  includeArchived?: boolean;
}): Promise<CustomizationOptionDto[]> {
  const db = getDb();
  const where: any = {};

  if (!options?.includeArchived) {
    where.isArchived = false;
  }
  if (options?.groupId) {
    where.groupId = options.groupId;
  }

  const list = await db.customizationOption.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return list.map(mapCustomizationOptionToDto);
}

export async function getCustomizationOptionById(
  id: string
): Promise<CustomizationOptionDto | null> {
  const db = getDb();
  const option = await db.customizationOption.findUnique({
    where: { id },
  });

  return option ? mapCustomizationOptionToDto(option) : null;
}

export async function createCustomizationOption(
  input: CreateCustomizationOptionInput
): Promise<CustomizationOptionDto> {
  const db = getDb();

  const groupExists = await db.customizationGroup.findUnique({
    where: { id: input.groupId },
  });
  if (!groupExists) {
    throw new Error(`CustomizationGroup with ID '${input.groupId}' not found`);
  }

  const id = input.id?.trim() || `option_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const option = await db.customizationOption.create({
    data: {
      id,
      groupId: input.groupId,
      name: input.name.trim(),
      priceModifier: toDecimal(input.priceModifier ?? 0),
      ingredientId: input.ingredientId ?? null,
      isActive: input.isActive !== false,
      isArchived: false,
    },
  });

  return mapCustomizationOptionToDto(option);
}

export async function updateCustomizationOption(
  id: string,
  input: UpdateCustomizationOptionInput
): Promise<CustomizationOptionDto> {
  const db = getDb();

  const option = await db.customizationOption.update({
    where: { id },
    data: {
      name: input.name !== undefined ? input.name.trim() : undefined,
      groupId: input.groupId !== undefined ? input.groupId : undefined,
      priceModifier: input.priceModifier !== undefined ? toDecimal(input.priceModifier) : undefined,
      ingredientId: input.ingredientId !== undefined ? input.ingredientId : undefined,
      isActive: input.isActive !== undefined ? input.isActive : undefined,
      isArchived: input.isArchived !== undefined ? input.isArchived : undefined,
    },
  });

  return mapCustomizationOptionToDto(option);
}

export async function archiveCustomizationOption(
  id: string
): Promise<CustomizationOptionDto> {
  const db = getDb();

  const option = await db.customizationOption.update({
    where: { id },
    data: {
      isArchived: true,
      isActive: false,
    },
  });

  return mapCustomizationOptionToDto(option);
}

// ============================================================================
// 4. INGREDIENTS & PRODUCTS RE-EXPORTS (FOR UNIFIED ADMIN ACCESS)
// ============================================================================

export const ingredients = inventoryService;
export const products = catalogService;
