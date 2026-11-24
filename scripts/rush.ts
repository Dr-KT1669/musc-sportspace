import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config()
process.env.DATABASE_URL ||= 'postgresql://sportspace:sportspace@127.0.0.1:5432/sportspace'
process.env.JWT_SECRET ||= 'dev-only-change-me-sportspace'
process.env.DATABASE_POOL_SIZE ||= '30'
process.env.BOOKING_IP_LIMIT ||= '5000'
process.env.HOLD_SECONDS ||= '90'
process.env.NODE_ENV ||= 'test'

const { createApp } = await import('../server/src/app.js')
const { getPrisma, initDb } = await import('../server/src/db.js')
const { signToken } = await import('../server/src/auth.js')
const { addDays, bangkokNowParts } = await import('../server/src/time.js')
const { runSeed } = await import('../prisma/seed.js')

const PORT = Number(process.env.RUSH_PORT || 43224)
const RACE_USERS = 200
const SPREAD_PER_SLOT = 40

function percentile(samples: number[], p: number) {
  const sorted = [...samples].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return Math.round(sorted[index] ?? 0)
}

async function race(base: string, tokens: string[], body: Record<string, unknown>, keyPrefix: string) {
  const started = performance.now()
  const latencies: number[] = []
  const statuses: number[] = []
  await Promise.all(
    tokens.map(async (token, index) => {
      const t0 = performance.now()
      const response = await fetch(`${base}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': `${keyPrefix}-${index}`,
        },
        body: JSON.stringify(body),
      })
      latencies.push(performance.now() - t0)
      statuses.push(response.status)
    }),
  )
  const wallMs = performance.now() - started
  const counts: Record<string, number> = {}
  for (const status of statuses) counts[status] = (counts[status] || 0) + 1
  return {
    requests: tokens.length,
    wallMs: Math.round(wallMs),
    throughput: Number((tokens.length / (wallMs / 1000)).toFixed(1)),
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: Math.round(Math.max(...latencies)),
    statuses: counts,
    serverErrors: statuses.filter((status) => status >= 500).length,
  }
}

async function main() {
  await initDb()
  await runSeed()
  const prisma = getPrisma()
  const hash = await bcrypt.hash('Rush@123', 4)
  const total = RACE_USERS + SPREAD_PER_SLOT * 4 + 1
  for (let i = 0; i < total; i++) {
    const studentId = `RUSH${String(i).padStart(4, '0')}`
    await prisma.user.upsert({
      where: { studentId },
      update: {},
      create: {
        studentId,
        name: `ผู้ทดสอบคิว ${i}`,
        email: `rush${i}@student.mahidol.ac.th`,
        passwordHash: hash,
        phone: '0800000000',
        department: 'ภาควิชาวิทยาการคอมพิวเตอร์',
        role: 'STUDENT',
        coinBalance: 120,
      },
    })
  }
  await prisma.booking.deleteMany({ where: { user: { studentId: { startsWith: 'RUSH' } } } })
  const users = await prisma.user.findMany({
    where: { studentId: { startsWith: 'RUSH' } },
    orderBy: { studentId: 'asc' },
    select: { id: true, studentId: true },
  })
  const tokens = users.map((user) => signToken(user.id))
  const date = addDays(bangkokNowParts().date, 12)
  const facility = await prisma.facility.findUnique({ where: { slug: 'tt-3' } })
  if (!facility) throw new Error('missing tt-3 facility')

  const app = createApp()
  const server = app.listen(PORT, '127.0.0.1')
  const base = `http://127.0.0.1:${PORT}`
  await new Promise((resolve) => server.once('listening', resolve))

  const single = await race(
    base,
    tokens.slice(0, RACE_USERS),
    { facilitySlug: 'tt-3', date, startTime: '10:00', endTime: '11:00', purpose: 'PRACTICE', lightsOn: false },
    'single',
  )

  const spreadStarts = ['11:00', '12:00', '13:00', '14:00']
  const spreadStarted = performance.now()
  const spreadParts = await Promise.all(
    spreadStarts.map((start, slotIndex) => {
      const [hour] = start.split(':').map(Number)
      const end = `${String(hour + 1).padStart(2, '0')}:00`
      const slice = tokens.slice(RACE_USERS + slotIndex * SPREAD_PER_SLOT, RACE_USERS + (slotIndex + 1) * SPREAD_PER_SLOT)
      return race(base, slice, { facilitySlug: 'tt-3', date, startTime: start, endTime: end, purpose: 'PRACTICE', lightsOn: false }, `spread-${start}`)
    }),
  )
  const spreadWall = Math.round(performance.now() - spreadStarted)

  const idemToken = tokens[RACE_USERS + SPREAD_PER_SLOT * 4]
  const idemBody = JSON.stringify({
    facilitySlug: 'tt-3',
    date,
    startTime: '15:00',
    endTime: '16:00',
    purpose: 'PRACTICE',
    lightsOn: false,
  })
  const idemStatuses = await Promise.all(
    Array.from({ length: 20 }, () =>
      fetch(`${base}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idemToken}`,
          'Idempotency-Key': 'same-click',
        },
        body: idemBody,
      }).then((response) => response.status),
    ),
  )

  const locks = await prisma.slotLock.findMany({
    where: { facilityId: facility.id, date, startTime: { in: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'] } },
    select: { startTime: true, bookingId: true },
  })
  const winners = new Map<string, Set<string>>()
  for (const lock of locks) {
    const set = winners.get(lock.startTime) || new Set()
    set.add(lock.bookingId)
    winners.set(lock.startTime, set)
  }
  const proof = [...winners.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([startTime, ids]) => ({ startTime, bookings: ids.size }))

  const health = await fetch(`${base}/api/health`).then((response) => response.json())
  server.close()
  await prisma.$disconnect()

  const report = {
    database: 'postgresql',
    singleSlot: single,
    spread: {
      slots: spreadStarts.length,
      usersPerSlot: SPREAD_PER_SLOT,
      wallMs: spreadWall,
      parts: spreadParts,
    },
    idempotentRetries: {
      requests: idemStatuses.length,
      statuses: idemStatuses.reduce<Record<string, number>>((acc, status) => {
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {}),
    },
    winners: proof,
    health,
  }
  console.log(JSON.stringify(report, null, 2))
  const failed = proof.some((row) => row.bookings !== 1) || single.serverErrors > 0 || single.statuses['201'] !== 1
  if (failed) process.exitCode = 1
}

await main()
