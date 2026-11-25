import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import {
  authResponse,
  clearAuthCookie,
  currentUser,
  hashPassword,
  optionalAuth,
  requireAuth,
  requireRole,
  setAuthCookie,
  signToken,
  verifyPassword,
} from './auth.js'
import {
  cancelBooking,
  checkIn,
  createBooking,
  getActiveHold,
  getAvailability,
  loadBooking,
  publicFacility,
  resendOtp,
  serializeBooking,
  sweep,
  verifyOtp,
  withQr,
} from './booking.js'
import { getPrisma } from './db.js'
import { addClient, clientCount } from './events.js'
import { ApiError, asyncRoute, parseBody, toPublic } from './http.js'
import { isDevMailer, listMailbox } from './mailer.js'
import {
  DEPARTMENTS,
  STARTING_COINS,
  isMahidolEmail,
  rulesPayload,
} from './rules.js'
import { addDays, bangkokNowParts, generateSlots, isValidDate } from './time.js'

function limiter(max: number, windowMs: number) {
  return rateLimit({
    windowMs,
    max: process.env.RATE_LIMIT_DISABLED === '1' ? 100_000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'ทำรายการถี่เกินไป กรุณารอสักครู่' } },
  })
}

const loginLimiter = limiter(10, 15 * 60 * 1000)
const otpLimiter = limiter(30, 15 * 60 * 1000)
const registerLimiter = limiter(8, 60 * 60 * 1000)
const bookingIpLimiter = limiter(Number(process.env.BOOKING_IP_LIMIT || 2000), 60 * 1000)

const userBookingHits = new Map<string, { at: number; key: string }[]>()
function assertUserBookingRate(userId: string, idempotencyKey?: string) {
  if (process.env.RATE_LIMIT_DISABLED === '1') return
  const now = Date.now()
  const max = Number(process.env.BOOKING_USER_LIMIT || 6)
  const key = idempotencyKey || `anon-${now}-${Math.random()}`
  const recent = (userBookingHits.get(userId) || []).filter((hit) => now - hit.at < 60_000)
  if (!recent.some((hit) => hit.key === key) && recent.length >= max) {
    throw new ApiError(429, 'RATE_LIMIT', 'ส่งคำขอจองถี่เกินไปจากบัญชีนี้ รอสักครู่แล้วลองใหม่')
  }
  if (!recent.some((hit) => hit.key === key)) recent.push({ at: now, key })
  userBookingHits.set(userId, recent)
}

const passwordSchema = z
  .string()
  .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
  .regex(/[A-Za-z]/, 'รหัสผ่านต้องมีตัวอักษร')
  .regex(/[0-9]/, 'รหัสผ่านต้องมีตัวเลข')

const registerSchema = z.object({
  studentId: z.string().trim().regex(/^[A-Za-z0-9]{4,16}$/, 'รหัสนักศึกษา/บุคลากรต้องเป็นตัวอักษรหรือตัวเลข 4–16 ตัว'),
  name: z.string().trim().min(2, 'กรุณากรอกชื่อ-นามสกุล').max(80),
  email: z.string().trim().email('อีเมลไม่ถูกต้อง').max(120),
  password: passwordSchema,
  phone: z.string().trim().regex(/^0\d{8,9}$/, 'เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก'),
  department: z.string().trim().min(2, 'กรุณาระบุสังกัด').max(80),
  role: z.enum(['STUDENT', 'STAFF']),
})

const loginSchema = z.object({
  studentId: z.string().trim().min(1, 'กรุณากรอกรหัสนักศึกษาหรือบุคลากร'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
})

const teammateSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อผู้ร่วมทีม').max(80),
  email: z.string().trim().max(120).optional().default(''),
  phone: z.string().trim().max(20).optional().default(''),
  department: z.string().trim().max(80).optional().default(''),
})

const bookingSchema = z.object({
  facilitySlug: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ไม่ถูกต้อง'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'รูปแบบเวลาไม่ถูกต้อง'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'รูปแบบเวลาไม่ถูกต้อง'),
  purpose: z.enum(['PRACTICE', 'CLUB', 'COMPETITION']),
  activityName: z.string().trim().max(120).optional().default(''),
  lightsOn: z.boolean().optional().default(false),
  notes: z.string().trim().max(300).optional().default(''),
  teammates: z.array(teammateSchema).max(12).optional().default([]),
  equipment: z
    .array(
      z.object({
        equipmentId: z.string().min(1),
        qty: z.number().int().positive().max(20),
      }),
    )
    .max(10)
    .optional()
    .default([]),
})

export const api = Router()

api.get(
  '/health',
  asyncRoute(async (_req, res) => {
    const started = Date.now()
    try {
      await getPrisma().$queryRaw`SELECT 1`
      res.json({
        ok: true,
        service: 'musc-sportspace',
        db: 'up',
        dbLatencyMs: Date.now() - started,
        uptimeSec: Math.round(process.uptime()),
        viewers: clientCount(),
      })
    } catch {
      res.status(503).json({ ok: false, service: 'musc-sportspace', db: 'down', viewers: clientCount() })
    }
  }),
)

api.get('/ready', (_req, res) => {
  res.redirect(307, '/api/health')
})

api.get('/meta', (_req, res) => {
  res.json(rulesPayload(isDevMailer()))
})

api.post(
  '/auth/register',
  registerLimiter,
  asyncRoute(async (req, res) => {
    const input = parseBody(registerSchema, req.body)
    const email = input.email.toLowerCase()
    if (!isMahidolEmail(email)) {
      throw new ApiError(400, 'EMAIL_DOMAIN', 'ใช้อีเมลสถาบัน @mahidol.edu หรือ @mahidol.ac.th เท่านั้น')
    }
    if (!DEPARTMENTS.includes(input.department)) {
      throw new ApiError(400, 'VALIDATION', 'กรุณาเลือกสังกัดจากรายการ')
    }
    const prisma = getPrisma()
    const exists = await prisma.user.findFirst({
      where: { OR: [{ email }, { studentId: input.studentId }] },
    })
    if (exists) throw new ApiError(409, 'DUPLICATE', 'รหัสหรืออีเมลนี้มีบัญชีอยู่แล้ว')
    const coins = STARTING_COINS[input.role] ?? 120
    const user = await prisma.user.create({
      data: {
        studentId: input.studentId,
        name: input.name,
        email,
        passwordHash: await hashPassword(input.password),
        phone: input.phone,
        department: input.department,
        role: input.role,
        coinBalance: coins,
        walletTx: { create: { amount: coins, reason: 'เหรียญต้อนรับสมาชิก SportSpace' } },
      },
    })
    const token = signToken(user.id)
    setAuthCookie(res, token)
    res.status(201).json(authResponse(toPublic(user), token))
  }),
)

api.post(
  '/auth/login',
  loginLimiter,
  asyncRoute(async (req, res) => {
    const input = parseBody(loginSchema, req.body)
    const user = await getPrisma().user.findUnique({ where: { studentId: input.studentId.trim() } })
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash || '$2a$10$5f5skk/iqUCOSVMNI56iUuQvvnwtGy5qnAsl1UY0APNWILBWr3Gh6',
    )
    if (!user || !valid) {
      throw new ApiError(401, 'INVALID_LOGIN', 'รหัสนักศึกษา/บุคลากรหรือรหัสผ่านไม่ถูกต้อง')
    }
    const token = signToken(user.id)
    setAuthCookie(res, token)
    res.json(authResponse(toPublic(user), token))
  }),
)

api.post('/auth/logout', (_req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

api.get(
  '/auth/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const me = currentUser(req)
    const user = await getPrisma().user.findUnique({ where: { id: me.id } })
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบ')
    res.json({ user: toPublic(user) })
  }),
)

api.get(
  '/facilities',
  optionalAuth,
  asyncRoute(async (req, res) => {
    const prisma = getPrisma()
    const date = typeof req.query.date === 'string' && isValidDate(req.query.date) ? req.query.date : bangkokNowParts().date
    const facilities = await prisma.facility.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { closures: true },
    })
    const lockRows = await prisma.slotLock.findMany({ where: { date }, select: { facilityId: true } })
    const lockCount = new Map<string, number>()
    for (const row of lockRows) lockCount.set(row.facilityId, (lockCount.get(row.facilityId) || 0) + 1)
    res.json({
      date,
      facilities: facilities.map((facility) => {
        const pub = publicFacility(facility)
        const total = generateSlots(facility.openTime, facility.closeTime, facility.slotMinutes).length
        const taken = lockCount.get(facility.id) || 0
        const closed = pub.closures.some((c) => c.startDate <= date && c.endDate >= date)
        return { ...pub, totalSlots: total, freeSlots: closed ? 0 : Math.max(0, total - taken), closedToday: closed }
      }),
    })
  }),
)

api.get(
  '/facilities/:slug',
  asyncRoute(async (req, res) => {
    const facility = await getPrisma().facility.findUnique({
      where: { slug: req.params.slug },
      include: { closures: true },
    })
    if (!facility) throw new ApiError(404, 'NOT_FOUND', 'ไม่พบสนาม')
    res.json({ facility: publicFacility(facility) })
  }),
)

api.get(
  '/availability',
  optionalAuth,
  asyncRoute(async (req, res) => {
    const slug = String(req.query.facility || req.query.facilitySlug || '')
    const date = String(req.query.date || '')
    if (!slug || !isValidDate(date)) throw new ApiError(400, 'VALIDATION', 'ต้องระบุสนามและวันที่')
    const facility = await getPrisma().facility.findUnique({ where: { slug } })
    if (!facility) throw new ApiError(404, 'NOT_FOUND', 'ไม่พบสนาม')
    const user = (req as { user?: { id: string } }).user
    res.json(await getAvailability(facility.id, date, user?.id))
  }),
)

api.get(
  '/schedule',
  optionalAuth,
  asyncRoute(async (req, res) => {
    const from = String(req.query.from || '')
    const to = String(req.query.to || '')
    if (!isValidDate(from) || !isValidDate(to) || to < from) {
      throw new ApiError(400, 'VALIDATION', 'ช่วงวันที่ไม่ถูกต้อง')
    }
    if (addDays(from, 45) < to) throw new ApiError(400, 'VALIDATION', 'ดูตารางได้ครั้งละไม่เกิน 45 วัน')
    const user = (req as { user?: { id: string; role: string } }).user
    const bookings = await getPrisma().booking.findMany({
      where: {
        date: { gte: from, lte: to },
        OR: [
          { status: { in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] } },
          { status: 'PENDING_OTP', otp: { consumed: false, expiresAt: { gt: new Date() } } },
        ],
      },
      include: { facility: true, user: { select: { name: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })
    const closures = await getPrisma().closure.findMany({
      where: { startDate: { lte: to }, endDate: { gte: from } },
      include: { facility: true },
    })
    res.json({
      bookings: bookings.map((booking) => ({
        id: booking.id,
        facilityId: booking.facilityId,
        facilitySlug: booking.facility.slug,
        facilityNameTh: booking.facility.nameTh,
        facilityType: booking.facility.type,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        lightsOn: booking.lightsOn,
        status: booking.status,
        purpose: booking.purpose,
        activityName: booking.activityName,
        isMine: user?.id === booking.userId,
        bookerName: user?.role === 'ADMIN' ? booking.user.name : null,
      })),
      closures: closures.map((c) => ({
        id: c.id,
        facilityId: c.facilityId,
        facilitySlug: c.facility.slug,
        facilityNameTh: c.facility.nameTh,
        facilityType: c.facility.type,
        startDate: c.startDate,
        endDate: c.endDate,
        reason: c.reason,
      })),
    })
  }),
)

api.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(':\n\n')
  addClient(res)
  req.on('close', () => res.end())
})

api.get(
  '/members/lookup',
  requireAuth,
  asyncRoute(async (req, res) => {
    const raw = String(req.query.emails || req.query.email || '')
    const emails = raw
      .split(/[,\s;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10)
    if (!emails.length) throw new ApiError(400, 'VALIDATION', 'กรุณาระบุอีเมล')
    for (const email of emails) {
      if (!isMahidolEmail(email)) throw new ApiError(400, 'EMAIL_DOMAIN', `อีเมล ${email} ไม่ใช่โดเมนมหิดล`)
    }
    const users = await getPrisma().user.findMany({
      where: { email: { in: emails } },
      select: { name: true, email: true, phone: true, department: true },
    })
    const found = new Set(users.map((u) => u.email.toLowerCase()))
    res.json({ members: users, missing: emails.filter((email) => !found.has(email)) })
  }),
)

api.get(
  '/equipment',
  requireAuth,
  asyncRoute(async (_req, res) => {
    const equipment = await getPrisma().equipment.findMany({ orderBy: { nameTh: 'asc' } })
    res.json({ equipment })
  }),
)

api.post(
  '/bookings',
  requireAuth,
  bookingIpLimiter,
  asyncRoute(async (req, res) => {
    const input = parseBody(bookingSchema, req.body)
    const user = currentUser(req)
    const headerKey = req.get('Idempotency-Key')?.trim().slice(0, 80)
    assertUserBookingRate(user.id, headerKey)
    const result = await createBooking(user, { ...input, idempotencyKey: headerKey || undefined })
    res.status(result.replayed ? 200 : 201).json(result)
  }),
)

api.get(
  '/bookings',
  requireAuth,
  asyncRoute(async (req, res) => {
    await sweep()
    const user = currentUser(req)
    const from = typeof req.query.from === 'string' ? req.query.from : undefined
    const to = typeof req.query.to === 'string' ? req.query.to : undefined
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const bookings = await getPrisma().booking.findMany({
      where: {
        userId: user.id,
        ...(from || to
          ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
        ...(q
          ? {
              OR: [
                { facility: { nameTh: { contains: q } } },
                { facility: { nameEn: { contains: q } } },
                { activityName: { contains: q } },
                { checkInCode: { contains: q.toUpperCase() } },
                { teammates: { some: { name: { contains: q } } } },
              ],
            }
          : {}),
      },
      include: {
        facility: true,
        teammates: true,
        loans: { include: { equipment: true } },
        user: { select: { id: true, name: true, studentId: true, email: true, department: true, role: true } },
        otp: { select: { expiresAt: true, attempts: true, sends: true, consumed: true } },
      },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    })
    res.json({
      bookings: bookings.map((booking) =>
        serializeBooking(booking, { revealSecrets: booking.userId === user.id }),
      ),
    })
  }),
)

api.get(
  '/bookings/hold',
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json(await getActiveHold(currentUser(req).id))
  }),
)

api.get(
  '/bookings/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = currentUser(req)
    const booking = await loadBooking(req.params.id)
    if (!booking || (booking.userId !== user.id && user.role !== 'ADMIN')) {
      throw new ApiError(404, 'NOT_FOUND', 'ไม่พบการจอง')
    }
    const serialized = serializeBooking(booking, { revealSecrets: true })
    res.json({ booking: await withQr(serialized) })
  }),
)

api.post(
  '/bookings/:id/otp',
  requireAuth,
  otpLimiter,
  asyncRoute(async (req, res) => {
    const code = String(req.body?.code || '').replace(/\s/g, '')
    if (!/^\d{6}$/.test(code)) throw new ApiError(400, 'VALIDATION', 'รหัส OTP ต้องเป็นตัวเลข 6 หลัก')
    res.json(await verifyOtp(currentUser(req), req.params.id, code))
  }),
)

api.post(
  '/bookings/:id/otp/resend',
  requireAuth,
  otpLimiter,
  asyncRoute(async (req, res) => {
    res.json(await resendOtp(currentUser(req), req.params.id))
  }),
)

api.post(
  '/bookings/:id/cancel',
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json(await cancelBooking(currentUser(req), req.params.id))
  }),
)

api.get(
  '/wallet',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = await getPrisma().user.findUnique({ where: { id: currentUser(req).id } })
    const transactions = await getPrisma().walletTransaction.findMany({
      where: { userId: currentUser(req).id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json({ balance: user?.coinBalance ?? 0, transactions })
  }),
)

api.get('/dev/mailbox', (_req, res) => {
  if (!isDevMailer()) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'กล่องจดหมายทดลองปิดอยู่ เพราะตั้งค่า SMTP แล้ว' } })
    return
  }
  res.json({ emails: listMailbox() })
})

api.get(
  '/admin/stats',
  requireAuth,
  requireRole('ADMIN'),
  asyncRoute(async (_req, res) => {
    await sweep()
    const prisma = getPrisma()
    const today = bangkokNowParts().date
    const start = addDays(today, -13)
    const bookings = await prisma.booking.findMany({
      where: { date: { gte: start } },
      include: { facility: true },
    })
    const active = bookings.filter((b) => ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(b.status))
    const byFacilityMap = new Map<string, { name: string; type: string; count: number }>()
    for (const booking of active) {
      const row = byFacilityMap.get(booking.facilityId) || {
        name: booking.facility.nameTh,
        type: booking.facility.type,
        count: 0,
      }
      row.count += 1
      byFacilityMap.set(booking.facilityId, row)
    }
    const byDay = []
    for (let i = 0; i < 14; i++) {
      const date = addDays(start, i)
      byDay.push({ date, count: active.filter((b) => b.date === date).length })
    }
    const statuses = ['PENDING_OTP', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED']
    const recent = await prisma.booking.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        facility: true,
        user: { select: { name: true, studentId: true } },
      },
    })
    const facilities = await prisma.facility.count()
    const closed = await prisma.closure.count({ where: { startDate: { lte: today }, endDate: { gte: today } } })
    res.json({
      summary: {
        todayBookings: active.filter((b) => b.date === today).length,
        upcoming: bookings.filter((b) => ['CONFIRMED', 'CHECKED_IN'].includes(b.status) && b.date >= today).length,
        checkinsToday: bookings.filter((b) => b.status === 'CHECKED_IN' && b.date === today).length,
        lightCoins: active.reduce((sum, b) => sum + b.lightCost, 0),
        activeFacilities: facilities,
        closedToday: closed,
      },
      byFacility: [...byFacilityMap.values()].sort((a, b) => b.count - a.count),
      byDay,
      byStatus: statuses.map((status) => ({
        status,
        count: bookings.filter((b) => b.status === status).length,
      })),
      recent: recent.map((b) => ({
        id: b.id,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        facilityNameTh: b.facility.nameTh,
        bookerName: b.user.name,
        studentId: b.user.studentId,
        lightsOn: b.lightsOn,
      })),
    })
  }),
)

api.get(
  '/admin/bookings',
  requireAuth,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    await sweep()
    const date = typeof req.query.date === 'string' ? req.query.date : bangkokNowParts().date
    const bookings = await getPrisma().booking.findMany({
      where: { date, status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING_OTP', 'COMPLETED'] } },
      include: {
        facility: true,
        user: { select: { name: true, studentId: true, phone: true } },
      },
      orderBy: [{ startTime: 'asc' }],
    })
    res.json({
      date,
      bookings: bookings.map((b) => ({
        id: b.id,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        lightsOn: b.lightsOn,
        purpose: b.purpose,
        activityName: b.activityName,
        checkInCode: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(b.status) ? b.checkInCode : null,
        facilityNameTh: b.facility.nameTh,
        facilityType: b.facility.type,
        bookerName: b.user.name,
        studentId: b.user.studentId,
        phone: b.user.phone,
        checkedInAt: b.checkedInAt,
      })),
    })
  }),
)

api.post(
  '/admin/checkin',
  requireAuth,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    const code = String(req.body?.code || '')
    if (code.trim().length < 4) throw new ApiError(400, 'VALIDATION', 'กรุณากรอกรหัสเช็คอิน')
    res.json(await checkIn(code))
  }),
)

const closureSchema = z.object({
  facilitySlug: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(3, 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร').max(160),
})

api.post(
  '/admin/closures',
  requireAuth,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    const input = parseBody(closureSchema, req.body)
    if (!isValidDate(input.startDate) || !isValidDate(input.endDate) || input.endDate < input.startDate) {
      throw new ApiError(400, 'VALIDATION', 'ช่วงวันที่ปิดสนามไม่ถูกต้อง')
    }
    if (addDays(input.startDate, 60) < input.endDate) {
      throw new ApiError(400, 'VALIDATION', 'ปิดสนามได้ครั้งละไม่เกิน 60 วัน')
    }
    const facility = await getPrisma().facility.findUnique({ where: { slug: input.facilitySlug } })
    if (!facility) throw new ApiError(404, 'NOT_FOUND', 'ไม่พบสนาม')
    const closure = await getPrisma().closure.create({
      data: {
        facilityId: facility.id,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
      },
    })
    res.status(201).json({ closure })
  }),
)

api.delete(
  '/admin/closures/:id',
  requireAuth,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    await getPrisma().closure.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  }),
)

api.post(
  '/admin/equipment',
  requireAuth,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    const input = parseBody(
      z.object({
        nameTh: z.string().trim().min(2).max(80),
        nameEn: z.string().trim().min(2).max(80),
        totalQty: z.number().int().positive().max(500),
      }),
      req.body,
    )
    const equipment = await getPrisma().equipment.create({
      data: {
        slug: `eq-${Date.now().toString(36)}`,
        nameTh: input.nameTh,
        nameEn: input.nameEn,
        totalQty: input.totalQty,
        availableQty: input.totalQty,
      },
    })
    res.status(201).json({ equipment })
  }),
)

api.patch(
  '/admin/equipment/:id',
  requireAuth,
  requireRole('ADMIN'),
  asyncRoute(async (req, res) => {
    const input = parseBody(
      z.object({
        totalQty: z.number().int().min(0).max(500),
        availableQty: z.number().int().min(0).max(500),
      }),
      req.body,
    )
    if (input.availableQty > input.totalQty) {
      throw new ApiError(400, 'VALIDATION', 'จำนวนคงเหลือต้องไม่เกินจำนวนทั้งหมด')
    }
    const equipment = await getPrisma().equipment.update({
      where: { id: req.params.id },
      data: input,
    })
    res.json({ equipment })
  }),
)

api.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ไม่พบ endpoint' } })
})
