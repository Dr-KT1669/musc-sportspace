import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient()
  }
  return globalForPrisma.prisma
}

export async function initDb() {
  const prisma = getPrisma()
  await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout=8000;')
  await prisma.$queryRawUnsafe('PRAGMA foreign_keys=ON;')
}
