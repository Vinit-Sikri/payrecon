import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __payreconPrisma: PrismaClient | undefined;
}

/**
 * Singleton PrismaClient. Reused across the `global` object in dev so that
 * hot-reloading (tsx watch) doesn't exhaust the Postgres connection limit on
 * free-tier Neon/Supabase, which caps concurrent connections aggressively.
 */
export const prisma = globalThis.__payreconPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__payreconPrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
