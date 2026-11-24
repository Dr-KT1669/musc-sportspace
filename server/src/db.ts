import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function withPool(raw: string) {
  if (!raw.startsWith('postgres')) return raw
  const url = new URL(raw)
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', process.env.DATABASE_POOL_SIZE || '20')
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', process.env.DATABASE_POOL_TIMEOUT || '15')
  }
  return url.toString()
}

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    const url = process.env.DATABASE_URL
    globalForPrisma.prisma = new PrismaClient({
      datasources: url ? { db: { url: withPool(url) } } : undefined,
    })
  }
  return globalForPrisma.prisma
}

export async function initDb() {
  await getPrisma().$queryRaw`SELECT 1`
}
