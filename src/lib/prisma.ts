import { PrismaClient } from "@prisma/client";
import { CATEGORIES, PRODUCTS } from "../data/menuData";

const noOp = {
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  findFirstOrThrow: async () => null,
  findUniqueOrThrow: async () => null,
  create: async (d: any) => d?.data ?? {},
  update: async (d: any) => d?.data ?? {},
  delete: async () => ({}),
  deleteMany: async () => ({ count: 0 }),
  updateMany: async () => ({ count: 0 }),
  count: async () => 0,
  upsert: async (d: any) => d?.create ?? {},
  groupBy: async () => [],
  aggregate: async () => ({}),
};

function createMockPrisma(): any {
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "$transaction") {
          return async (arg: any) => {
            if (Array.isArray(arg)) return Promise.all(arg);
            if (typeof arg === "function") return arg(createMockPrisma());
            return [];
          };
        }
        if (prop === "$connect" || prop === "$disconnect") {
          return async () => {};
        }
        if (prop === "$queryRaw" || prop === "$executeRaw") {
          return async () => [];
        }
        return noOp;
      },
    }
  );
}

let prisma: any;
let isRealPrisma = false;
try {
  let dbUrl = process.env.DATABASE_URL;
  if (
    dbUrl &&
    (dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://"))
  ) {
    if (dbUrl.includes(":6543") && !dbUrl.includes("pgbouncer=true")) {
      dbUrl += (dbUrl.includes("?") ? "&" : "?") + "pgbouncer=true";
    }
    prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
      log: ["warn", "error"],
    });
    isRealPrisma = true;
  } else {
    console.warn("[AI Studio] Database not connected — using mock");
    prisma = createMockPrisma();
  }
} catch {
  console.warn("[AI Studio] Database not connected — using mock");
  prisma = createMockPrisma();
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
  return prisma as PrismaClient;
}

/**
 * Returns the active PrismaClient or throws a descriptive error.
 */
export function getDb(): PrismaClient {
  const client = getPrismaClient();
  if (!client) {
    throw new Error("Prisma client is not initialized or DATABASE_URL is not configured.");
  }
  return client;
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
