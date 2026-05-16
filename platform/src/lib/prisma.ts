import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@supabase/prisma-adapter-pg' // Wait, I used @prisma/adapter-pg earlier
import { PrismaPg as PrismaPgAdapter } from '@prisma/adapter-pg'
import pg from 'pg'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// We need the adapter for Prisma 7 compatibility with pooled connections
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})
const adapter = new PrismaPgAdapter(pool)

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
