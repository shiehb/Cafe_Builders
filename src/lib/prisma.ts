import { PrismaClient } from "@prisma/client";

let prisma: any;

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
  } else {
    throw new Error("DATABASE_URL is not set or not a PostgreSQL URL");
  }
} catch {
  console.warn("[AI Studio] Database not connected — using mock");
  const noOp: any = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
    count: async () => 0,
    deleteMany: async () => ({ count: 0 }),
    updateMany: async () => ({ count: 0 }),
    upsert: async (d: any) => d?.create ?? {},
  };
  const modelProxy = new Proxy(noOp, {
    get: (target, prop) => target[prop] || (async () => null),
  });
  prisma = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "$connect" || prop === "$disconnect") {
          return async () => {};
        }
        if (prop === "$transaction") {
          return async (fnOrArr: any) => {
            if (typeof fnOrArr === "function") return fnOrArr(prisma);
            if (Array.isArray(fnOrArr)) return Promise.all(fnOrArr);
            return [];
          };
        }
        return modelProxy;
      },
    }
  );
}

export { prisma };

/**
 * Returns the Prisma client instance if DATABASE_URL is configured and valid
 */
export function getPrismaClient(): PrismaClient {
  return prisma;
}

/**
 * Returns the active PrismaClient or mock proxy.
 */
export function getDb(): PrismaClient {
  return prisma;
}
