import { PrismaClient } from "@prisma/client";
import { CATEGORIES, PRODUCTS } from "../data/menuData";

const noOp = {
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  create: async (d: any) => d?.data ?? {},
  update: async (d: any) => d?.data ?? {},
  delete: async () => ({}),
  count: async () => 0,
  upsert: async (d: any) => d?.create ?? {},
};

let prisma: any;
let isRealPrisma = false;
try {
  if (
    process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.startsWith("postgresql://") ||
      process.env.DATABASE_URL.startsWith("postgres://"))
  ) {
    prisma = new PrismaClient({
      log: ["warn", "error"],
    });
    isRealPrisma = true;
  } else {
    console.warn("[AI Studio] Database not connected — using mock");
    prisma = new Proxy({}, { get: () => noOp });
  }
} catch {
  console.warn("[AI Studio] Database not connected — using mock");
  prisma = new Proxy({}, { get: () => noOp });
}

export { prisma };

let isSeeded = false;

/**
 * Returns the Prisma client instance if DATABASE_URL is configured and valid
 */
export function getPrismaClient(): PrismaClient | null {
  if (!isRealPrisma || !process.env.DATABASE_URL) {
    return null;
  }
  return prisma;
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
            icon: cat.iconName || "coffee",
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
