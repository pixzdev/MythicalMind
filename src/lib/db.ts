import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const globalForPrismaFlags = globalThis as unknown as {
  __mythicalmind_prisma_quiet?: boolean
}

// Keep query logging off: noisy in dev and never worth risking secret leakage.
export const db =
  globalForPrisma.prisma ??
  new PrismaClient(
    globalForPrismaFlags.__mythicalmind_prisma_quiet
      ? undefined
      : { log: ['error', 'warn'] }
  )

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
