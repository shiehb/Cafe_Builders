import { PrismaClient } from "@prisma/client";

let dbUrl = process.env.DATABASE_URL;
if (
  !dbUrl ||
  (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://"))
) {
  throw new Error(
    "Prisma database configuration is unavailable: DATABASE_URL must be a PostgreSQL connection URL."
  );
}

if (dbUrl.includes(":6543") && !dbUrl.includes("pgbouncer=true")) {
  dbUrl += (dbUrl.includes("?") ? "&" : "?") + "pgbouncer=true";
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
  log: ["warn", "error"],
});

export { prisma };

/**
 * Returns the Prisma client instance if DATABASE_URL is configured and valid
 */
export function getPrismaClient(): PrismaClient {
  return prisma;
}

/**
 * Returns the active PrismaClient or throws a descriptive error.
 */
export function getDb(): PrismaClient {
  return prisma;
}
