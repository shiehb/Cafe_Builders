import { PrismaClient } from "@prisma/client";
import { CATEGORIES, PRODUCTS } from "../data/menuData";

let prismaInstance: PrismaClient | null = null;
let isSeeded = false;

/**
 * Returns the Prisma client instance if DATABASE_URL is configured and valid
 */
export function getPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const url = process.env.DATABASE_URL.trim();
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    return null;
  }

  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: ["warn", "error"],
    });
  }

  return prismaInstance;
}

/**
 * Seeds default categories and products if PostgreSQL tables are empty
 */
export async function seedDatabaseIfEmpty(): Promise<boolean> {
  const prisma = getPrismaClient();
  if (!prisma || isSeeded) {
    return false;
  }

  try {
    const categoryCount = await prisma.category.count();
    if (categoryCount === 0) {
      console.log("🌱 Database is empty. Seeding default categories and products...");

      // 1. Seed categories (skipping 'all')
      const categoriesToSeed = CATEGORIES.filter((c) => c.id !== "all");
      for (const cat of categoriesToSeed) {
        await prisma.category.upsert({
          where: { id: cat.id },
          update: {},
          create: {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            description: `${cat.name} handcrafted artisan menu`,
            icon: cat.iconEmoji || "☕",
            sortOrder: cat.sortOrder,
          },
        });
      }

      // 2. Seed products
      for (const prod of PRODUCTS) {
        const categoryExists = categoriesToSeed.find((c) => c.id === prod.categoryId);
        if (categoryExists) {
          await prisma.product.upsert({
            where: { id: prod.id },
            update: {},
            create: {
              id: prod.id,
              name: prod.name,
              description: prod.description,
              price: prod.price,
              imageUrl: prod.imageUrl,
              categoryId: prod.categoryId,
              isAvailable: prod.isAvailable,
              popular: !!prod.popular,
              temperature: prod.temperatureOptions?.join("/") || "BOTH",
            },
          });
        }
      }

      console.log(`✅ Seeded ${categoriesToSeed.length} categories and ${PRODUCTS.length} products to database.`);
    }

    isSeeded = true;
    return true;
  } catch (err) {
    console.warn("⚠️ Prisma seed skipped or connection unavailable:", (err as Error)?.message || err);
    return false;
  }
}
