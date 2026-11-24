import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { getPrisma } from './db.js'
import { broadcast } from './events.js'
import { ApiError, TxAbort, type PublicUser } from './http.js'
import { otpEmail, sendMail } from './mailer.js'
import {
  MAX_ACTIVE,
  cancelLeadMinutes,
  checkInEarlyMinutes,
  checkInLateMinutes,
  isMahidolEmail,
  minLeadMinutes,
  holdMs,
  holdSeconds,
  otpMaxAttempts,
  otpMaxSends,
  bookingWindowDays,
} from './rules.js'
import { addDays, bangkokNowParts, expandRange, formatMinutes, generateSlots, isValidDate, minutesUntil, parseMinutes } from './time.js'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function makeCheckInCode() {
  const bytes = randomBytes(6)
  let code = ''
  for (let i = 0; i < 6; i++) code += ALPHABET[bytes[i] % ALPHABET.length]
  return code
}

function makeOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function isRetryable(error: unknown) {
  const message = String(error)
  if (/deadlock detected|40P01|could not serialize|40001/.test(message)) return true
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
}

function hashOtp(code: string, salt: string) {
  const secret = process.env.JWT_SECRET || 'dev-only-change-me-sportspace'
  return createHmac('sha256', secret).update(`${salt}:${code}`).digest('hex')
}

function otpMatches(code: string, salt: string, hash: string) {
  const next = hashOtp(code, salt)
  const left = Buffer.from(hash)
  const right = Buffer.from(next)
  return left.length === right.length && timingSafeEqual(left, right)
}

type Tx = Prisma.TransactionClient

async function releaseInTx(tx: Tx, id: string, status: 'EXPIRED' | 'CANCELLED', refundReason: string) {
  const current = await tx.booking.findUnique({ where: { id }, include: { loans: true } })
  if (!current || !['PENDING_OTP', 'CONFIRMED'].includes(current.status)) return null
  await tx.booking.update({
    where: { id },
    data: { status, cancelledAt: status === 'CANCELLED' ? new Date() : current.cancelledAt },
  })
  await tx.slotLock.deleteMany({ where: { bookingId: id } })
  await tx.otpCode.updateMany({ where: { bookingId: id }, data: { consumed: true } })
  for (const loan of current.loans) {
    await tx.equipment.update({
      where: { id: loan.equipmentId },
      data: { availableQty: { increment: loan.qty } },
    })
  }
  if (current.lightCost > 0) {
    await tx.user.update({
      where: { id: current.userId },
      data: { coinBalance: { increment: current.lightCost } },
    })
    await tx.walletTransaction.create({
      data: { userId: current.userId, amount: current.lightCost, reason: refundReason, bookingId: id },
    })
  }
  return current
}

async function withBusyRetry<T>(fn: () => Promise<T>) {
  let last: unknown
  for (let i = 0; i < 4; i++) {
    try {
      return await fn()
    } catch (error) {
      last = error
      if (!isRetryable(error) || i === 3) throw error
      await new Promise((resolve) => setTimeout(resolve, 15 * (i + 1)))
    }
  }
  throw last
}

export async function sweep() {
  const prisma = getPrisma()
  const now = new Date()
  const pending = await prisma.otpCode.findMany({
    where: { consumed: false, expiresAt: { lt: now }, booking: { status: 'PENDING_OTP' } },
    include: { booking: { include: { loans: true } } },
  })
  for (const otp of pending) {
    await releaseBooking(otp.booking.id, 'EXPIRED', 'คืนเหรียญเปิดไฟ (OTP หมดอายุ)')
  }

  const today = bangkokNowParts().date
  const time = bangkokNowParts().time
  await prisma.booking.updateMany({
    where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] }, date: { lt: today } },
    data: { status: 'COMPLETED' },
  })
  await prisma.booking.updateMany({
    where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] }, date: today, endTime: { lte: time } },
    data: { status: 'COMPLETED' },
  })
}

async function releaseBooking(id: string, status: 'EXPIRED' | 'CANCELLED', refundReason: string) {
  const updated = await getPrisma().$transaction((tx) => releaseInTx(tx, id, status, refundReason))
  if (updated) broadcast({ type: 'availability', facilityId: updated.facilityId, date: updated.date })
  return updated
}

function closureCovers(closures: { startDate: string; endDate: string; reason: string }[], date: string) {
  return closures.find((c) => c.startDate <= date && c.endDate >= date) || null
}

export async function getAvailability(facilityId: string, date: string, userId?: string) {
  const prisma = getPrisma()
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: { closures: true },
  })
  if (!facility) throw new ApiError(404, 'NOT_FOUND', 'ไม่พบสนาม')
  const closure = closureCovers(facility.closures, date)
  const locks = await prisma.slotLock.findMany({
    where: { facilityId, date },
    include: { booking: { select: { id: true, userId: true, status: true, otp: { select: { expiresAt: true } } } } },
  })
  const lockByStart = new Map(locks.map((lock) => [lock.startTime, lock]))
  const nowParts = bangkokNowParts()
  const slots = generateSlots(facility.openTime, facility.closeTime, facility.slotMinutes).map((slot) => {
    const lock = lockByStart.get(slot.startTime)
    const until = minutesUntil(date, slot.startTime)
    const holdExpired =
      lock?.booking.status === 'PENDING_OTP' &&
      !!lock.booking.otp &&
      lock.booking.otp.expiresAt.getTime() <= Date.now()
    let state: 'available' | 'booked' | 'holding' | 'mine' | 'past' | 'closed' = 'available'
    if (closure) state = 'closed'
    else if (date < nowParts.date || (date === nowParts.date && until < minLeadMinutes())) state = 'past'
    else if (lock && !holdExpired) {
      if (lock.booking.userId === userId && lock.booking.status !== 'PENDING_OTP') state = 'mine'
      else if (lock.booking.status === 'PENDING_OTP') state = 'holding'
      else state = 'booked'
    }
    return {
      ...slot,
      state,
      bookingId: lock && lock.booking.userId === userId ? lock.booking.id : undefined,
    }
  })
  return {
    facility: publicFacility(facility),
    date,
    closedReason: closure?.reason || null,
    slots,
  }
}

export function publicFacility(facility: {
  id: string
  slug: string
  type: string
  nameTh: string
  nameEn: string
  description: string
  location: string
  openTime: string
  closeTime: string
  slotMinutes: number
  maxHours: number
  capacity: number
  lightsAvailable: boolean
  lightCoinCost: number
  isActive: boolean
  sortOrder: number
  closures?: { id: string; startDate: string; endDate: string; reason: string }[]
}) {
  const today = bangkokNowParts().date
  return {
    id: facility.id,
    slug: facility.slug,
    type: facility.type,
    nameTh: facility.nameTh,
    nameEn: facility.nameEn,
    description: facility.description,
    location: facility.location,
    openTime: facility.openTime,
    closeTime: facility.closeTime,
    slotMinutes: facility.slotMinutes,
    maxHours: facility.maxHours,
    capacity: facility.capacity,
    lightsAvailable: facility.lightsAvailable,
    lightCoinCost: facility.lightCoinCost,
    isActive: facility.isActive,
    sortOrder: facility.sortOrder,
    closures: (facility.closures || []).filter((c) => c.endDate >= today),
  }
}

type TeammateInput = { name: string; email?: string; phone?: string; department?: string }
type EquipmentInput = { equipmentId: string; qty: number }

export async function createBooking(
  user: PublicUser,
  input: {
    facilitySlug: string
    date: string
    startTime: string
    endTime: string
    purpose: string
    activityName?: string
    lightsOn?: boolean
    notes?: string
    teammates?: TeammateInput[]
    equipment?: EquipmentInput[]
    idempotencyKey?: string
  },
) {
  const prisma = getPrisma()
  const idempotencyKey = input.idempotencyKey?.trim() || undefined
  if (!isValidDate(input.date)) throw new ApiError(400, 'VALIDATION', 'วันที่ไม่ถูกต้อง')
  const today = bangkokNowParts().date
  const last = addDays(today, bookingWindowDays())
  if (input.date < today || input.date > last) {
    throw new ApiError(400, 'OUT_OF_WINDOW', `จองล่วงหน้าได้ภายใน ${bookingWindowDays()} วัน`)
  }

  const facility = await prisma.facility.findUnique({
    where: { slug: input.facilitySlug },
    include: { closures: true },
  })
  if (!facility || !facility.isActive) throw new ApiError(404, 'NOT_FOUND', 'ไม่พบสนาม')
  const closure = closureCovers(facility.closures, input.date)
  if (closure) throw new ApiError(409, 'FACILITY_CLOSED', `สนามปิดปรับปรุง: ${closure.reason}`)

  const slotStarts = expandRange(input.startTime, input.endTime, facility.slotMinutes)
  if (!slotStarts) throw new ApiError(400, 'VALIDATION', 'ช่วงเวลาไม่ตรงกับรอบของสนาม')
  const hours = (slotStarts.length * facility.slotMinutes) / 60
  if (hours > facility.maxHours) {
    throw new ApiError(400, 'TOO_LONG', `จองสนามนี้ได้ครั้งละไม่เกิน ${facility.maxHours} ชั่วโมง`)
  }
  const open = parseMinutes(facility.openTime)
  const close = parseMinutes(facility.closeTime)
  if (parseMinutes(input.startTime) < open || parseMinutes(input.endTime) > close) {
    throw new ApiError(400, 'OUTSIDE_HOURS', `สนามเปิด ${facility.openTime}–${facility.closeTime} น.`)
  }
  const lead = minutesUntil(input.date, input.startTime)
  if (lead < minLeadMinutes()) {
    throw new ApiError(400, 'TOO_SOON', `ต้องจองล่วงหน้าอย่างน้อย ${minLeadMinutes()} นาที`)
  }

  if (user.role === 'STUDENT' && input.purpose !== 'PRACTICE') {
    throw new ApiError(403, 'PURPOSE_FORBIDDEN', 'นักศึกษาจองได้เฉพาะการซ้อม / ใช้งานทั่วไป')
  }
  if ((input.purpose === 'CLUB' || input.purpose === 'COMPETITION') && !input.activityName?.trim()) {
    throw new ApiError(400, 'VALIDATION', 'กรุณาระบุชื่อกิจกรรมชมรมหรือรายการแข่งขัน')
  }
  const equipment = input.equipment || []
  if (equipment.length && user.role === 'STUDENT') {
    throw new ApiError(403, 'EQUIPMENT_FORBIDDEN', 'การยืมอุปกรณ์สำหรับบุคลากรและผู้ดูแลสนาม')
  }
  const lightsOn = Boolean(input.lightsOn)
  if (lightsOn && !facility.lightsAvailable) {
    throw new ApiError(400, 'NO_LIGHTS', 'สนามนี้ไม่มีตัวเลือกเปิดไฟ')
  }
  const lightCost = lightsOn ? facility.lightCoinCost * hours : 0
  const limit = MAX_ACTIVE[user.role] ?? 3

  if (idempotencyKey) {
    const replay = await prisma.booking.findFirst({ where: { userId: user.id, idempotencyKey } })
    if (replay) return finishBooking(user, replay.id, true)
  }
  const sameSlot = await prisma.booking.findFirst({
    where: {
      userId: user.id,
      facilityId: facility.id,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      status: { in: ['PENDING_OTP', 'CONFIRMED', 'CHECKED_IN'] },
    },
  })
  if (sameSlot) return finishBooking(user, sameSlot.id, true)

  const active = await prisma.booking.count({
    where: {
      userId: user.id,
      status: { in: ['PENDING_OTP', 'CONFIRMED', 'CHECKED_IN'] },
      date: { gte: today },
    },
  })
  if (active >= limit) {
    throw new ApiError(409, 'MAX_ACTIVE', `จองพร้อมกันได้ไม่เกิน ${limit} รายการ กรุณายกเลิกหรือใช้งานรายการเดิมก่อน`)
  }

  const teammates = await resolveTeammates(user, input.teammates || [])
  const code = makeOtp()
  const salt = randomBytes(16).toString('hex')
  const codeHash = hashOtp(code, salt)
  const expiresAt = new Date(Date.now() + holdMs())

  let createdId = ''
  try {
    createdId = await withBusyRetry(() =>
      prisma.$transaction(async (tx) => {
        const stale = await tx.otpCode.findMany({
          where: {
            consumed: false,
            expiresAt: { lt: new Date() },
            booking: { status: 'PENDING_OTP', facilityId: facility.id, date: input.date },
          },
          select: { bookingId: true },
        })
        for (const row of stale) {
          await releaseInTx(tx, row.bookingId, 'EXPIRED', 'คืนเหรียญเปิดไฟ (OTP หมดอายุ)')
        }

        const holds = await tx.booking.count({ where: { userId: user.id, status: 'PENDING_OTP' } })
        if (holds > 0) {
          throw new TxAbort(
            new ApiError(409, 'HOLD_EXISTS', `คุณมีช่วงเวลาที่กำลังยืนยันอยู่ ยืนยันภายใน ${holdSeconds()} วินาที หรือรอให้หมดเวลาก่อนจองช่วงใหม่`),
          )
        }
        const activeNow = await tx.booking.count({
          where: {
            userId: user.id,
            status: { in: ['PENDING_OTP', 'CONFIRMED', 'CHECKED_IN'] },
            date: { gte: today },
          },
        })
        if (activeNow >= limit) {
          throw new TxAbort(new ApiError(409, 'MAX_ACTIVE', `จองพร้อมกันได้ไม่เกิน ${limit} รายการ`))
        }

        const booking = await tx.booking.create({
          data: {
            userId: user.id,
            facilityId: facility.id,
            date: input.date,
            startTime: input.startTime,
            endTime: input.endTime,
            purpose: input.purpose,
            activityName: input.activityName?.trim() || '',
            lightsOn,
            lightCost,
            notes: input.notes?.trim() || '',
            status: 'PENDING_OTP',
            idempotencyKey,
            checkInCode: makeCheckInCode(),
            qrToken: randomBytes(16).toString('hex'),
          },
        })

        // The unique slot row is the finish line: the first insert wins, everyone else rolls back.
        for (const startTime of slotStarts) {
          await tx.slotLock.create({
            data: { facilityId: facility.id, date: input.date, startTime, bookingId: booking.id },
          })
        }

        if (lightCost > 0) {
          const charged = await tx.user.updateMany({
            where: { id: user.id, coinBalance: { gte: lightCost } },
            data: { coinBalance: { decrement: lightCost } },
          })
          if (charged.count !== 1) {
            throw new TxAbort(new ApiError(400, 'INSUFFICIENT_COINS', `เหรียญไม่พอสำหรับเปิดไฟ (ต้องใช้ ${lightCost} เหรียญ)`))
          }
          await tx.walletTransaction.create({
            data: {
              userId: user.id,
              amount: -lightCost,
              reason: `เปิดไฟ ${facility.nameTh}`,
              bookingId: booking.id,
            },
          })
        }

        for (const item of equipment) {
          const reserved = await tx.equipment.updateMany({
            where: { id: item.equipmentId, availableQty: { gte: item.qty } },
            data: { availableQty: { decrement: item.qty } },
          })
          if (reserved.count !== 1) {
            throw new TxAbort(new ApiError(409, 'EQUIPMENT_SHORT', 'อุปกรณ์ไม่พอสำหรับการยืม'))
          }
          await tx.equipmentLoan.create({
            data: { bookingId: booking.id, equipmentId: item.equipmentId, qty: item.qty },
          })
        }

        if (teammates.length) {
          await tx.teammate.createMany({
            data: teammates.map((mate) => ({ ...mate, bookingId: booking.id })),
          })
        }
        await tx.otpCode.create({
          data: { bookingId: booking.id, codeHash, salt, expiresAt, attempts: 0, sends: 1 },
        })
        return booking.id
      }, { timeout: 8000, maxWait: 10000 }),
    )
  } catch (error) {
    if (error instanceof TxAbort) throw error.api
    if (isUniqueError(error)) {
      const target = String((error as Prisma.PrismaClientKnownRequestError).meta?.target || '')
      if (idempotencyKey && target.toLowerCase().includes('idempotency')) {
        const existing = await prisma.booking.findFirst({ where: { userId: user.id, idempotencyKey } })
        if (existing) return finishBooking(user, existing.id, true)
      }
      const own = await prisma.booking.findFirst({
        where: {
          userId: user.id,
          facilityId: facility.id,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          status: { in: ['PENDING_OTP', 'CONFIRMED'] },
        },
      })
      if (own) return finishBooking(user, own.id, true)
      throw new ApiError(409, 'SLOT_TAKEN', 'มีคนจองช่วงนี้ไปก่อนคุณแล้ว กรุณาเลือกช่วงอื่น')
    }
    throw error
  }

  const when = `${input.date} ${input.startTime}–${input.endTime}`
  const mail = otpEmail({
    name: user.name,
    code,
    facility: facility.nameTh,
    when,
    bookingId: createdId,
    holdSeconds: holdSeconds(),
  })
  try {
    await sendMail({ to: user.email, ...mail })
  } catch (error) {
    console.error('OTP mail failed', error)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SportSpace] OTP fallback for ${user.email}: ${code}`)
    }
  }

  return finishBooking(user, createdId, false)
}

async function finishBooking(user: PublicUser, bookingId: string, replayed: boolean) {
  const prisma = getPrisma()
  const booking = await loadBooking(bookingId)
  if (!booking) throw new ApiError(404, 'NOT_FOUND', 'ไม่พบการจอง')
  if (!replayed) broadcast({ type: 'availability', facilityId: booking.facilityId, date: booking.date })
  const freshUser = await prisma.user.findUnique({ where: { id: user.id } })
  return {
    replayed,
    booking: serializeBooking(booking, { revealSecrets: booking.status !== 'PENDING_OTP' }),
    otpExpiresAt: booking.otp?.expiresAt?.toISOString?.() ?? booking.otp?.expiresAt ?? null,
    coinBalance: freshUser?.coinBalance ?? user.coinBalance,
  }
}

async function resolveTeammates(user: PublicUser, mates: TeammateInput[]) {
  const prisma = getPrisma()
  const resolved: { name: string; email: string; phone: string; department: string }[] = []
  for (const mate of mates) {
    const email = (mate.email || '').trim().toLowerCase()
    if (!email) {
      resolved.push({
        name: mate.name.trim(),
        email: '',
        phone: (mate.phone || '').trim(),
        department: (mate.department || '').trim(),
      })
      continue
    }
    if (!isMahidolEmail(email)) {
      throw new ApiError(400, 'VALIDATION', 'อีเมลผู้ร่วมทีมต้องเป็นอีเมลมหาวิทยาลัยมหิดล')
    }
    if (email === user.email.toLowerCase()) {
      throw new ApiError(400, 'VALIDATION', 'ไม่ต้องเพิ่มอีเมลของตนเองในรายชื่อผู้ร่วมทีม')
    }
    const member = await prisma.user.findUnique({ where: { email } })
    if (!member) throw new ApiError(404, 'TEAMMATE_NOT_FOUND', `ไม่พบสมาชิก ${email}`)
    resolved.push({
      name: member.name,
      email: member.email,
      phone: member.phone,
      department: member.department,
    })
  }
  return resolved
}

export async function verifyOtp(user: PublicUser, bookingId: string, code: string) {
  await sweep()
  const prisma = getPrisma()
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { otp: true, facility: true },
  })
  if (!booking || booking.userId !== user.id) throw new ApiError(404, 'NOT_FOUND', 'ไม่พบการจอง')
  if (booking.status === 'EXPIRED') {
    throw new ApiError(400, 'OTP_EXPIRED', 'รหัส OTP หมดอายุแล้ว ช่วงเวลาถูกปล่อยให้ผู้อื่นจอง')
  }
  if (booking.status !== 'PENDING_OTP' || !booking.otp || booking.otp.consumed) {
    throw new ApiError(400, 'OTP_CLOSED', 'การจองนี้ไม่ได้อยู่ระหว่างยืนยันรหัส')
  }
  if (booking.otp.expiresAt.getTime() < Date.now()) {
    await releaseBooking(booking.id, 'EXPIRED', 'คืนเหรียญเปิดไฟ (OTP หมดอายุ)')
    throw new ApiError(400, 'OTP_EXPIRED', 'รหัส OTP หมดอายุแล้ว ช่วงเวลาถูกปล่อยให้ผู้อื่นจอง')
  }
  const ok = otpMatches(code, booking.otp.salt, booking.otp.codeHash)
  if (!ok) {
    const attempts = booking.otp.attempts + 1
    if (attempts >= otpMaxAttempts()) {
      await releaseBooking(booking.id, 'EXPIRED', 'คืนเหรียญเปิดไฟ (กรอก OTP ผิดเกินกำหนด)')
      throw new ApiError(400, 'OTP_LOCKED', 'กรอกรหัสผิดเกินจำนวนครั้ง ช่วงเวลาถูกปล่อย')
    }
    await prisma.otpCode.update({ where: { id: booking.otp.id }, data: { attempts } })
    const left = otpMaxAttempts() - attempts
    throw new ApiError(400, 'OTP_INVALID', `รหัส OTP ไม่ถูกต้อง เหลืออีก ${left} ครั้ง`)
  }
  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    }),
    prisma.otpCode.update({ where: { id: booking.otp.id }, data: { consumed: true } }),
  ])
  broadcast({ type: 'availability', facilityId: booking.facilityId, date: booking.date })
  const fresh = await loadBooking(booking.id)
  const freshUser = await prisma.user.findUnique({ where: { id: user.id } })
  return {
    booking: await withQr(serializeBooking(fresh!, { revealSecrets: true })),
    coinBalance: freshUser?.coinBalance ?? user.coinBalance,
  }
}

export async function resendOtp(user: PublicUser, bookingId: string) {
  const prisma = getPrisma()
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { otp: true, facility: true },
  })
  if (!booking || booking.userId !== user.id) throw new ApiError(404, 'NOT_FOUND', 'ไม่พบการจอง')
  if (booking.status !== 'PENDING_OTP' || !booking.otp) {
    throw new ApiError(400, 'OTP_CLOSED', 'การจองนี้ยืนยันแล้วหรือหมดอายุ')
  }
  if (booking.otp.sends >= otpMaxSends()) {
    throw new ApiError(429, 'OTP_RESEND_LIMIT', 'ส่งรหัสซ้ำได้ไม่เกิน 3 ครั้งต่อการจอง')
  }
  if (booking.otp.expiresAt.getTime() < Date.now()) {
    await releaseBooking(booking.id, 'EXPIRED', 'คืนเหรียญเปิดไฟ (OTP หมดอายุ)')
    throw new ApiError(400, 'OTP_EXPIRED', 'รหัส OTP หมดอายุแล้ว ช่วงเวลาถูกปล่อยให้ผู้อื่นจอง')
  }
  const code = makeOtp()
  const salt = randomBytes(16).toString('hex')
  const codeHash = hashOtp(code, salt)
  await prisma.otpCode.update({
    where: { id: booking.otp.id },
    data: { codeHash, salt, attempts: 0, consumed: false, sends: { increment: 1 } },
  })
  const mail = otpEmail({
    name: user.name,
    code,
    facility: booking.facility.nameTh,
    when: `${booking.date} ${booking.startTime}–${booking.endTime}`,
    bookingId: booking.id,
    holdSeconds: Math.max(1, Math.round((booking.otp.expiresAt.getTime() - Date.now()) / 1000)),
  })
  await sendMail({ to: user.email, ...mail })
  return { otpExpiresAt: booking.otp.expiresAt.toISOString() }
}

export async function cancelBooking(user: PublicUser, bookingId: string) {
  await sweep()
  const prisma = getPrisma()
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!booking || (booking.userId !== user.id && user.role !== 'ADMIN')) {
    throw new ApiError(404, 'NOT_FOUND', 'ไม่พบการจอง')
  }
  if (booking.status === 'PENDING_OTP') {
    await releaseBooking(booking.id, 'CANCELLED', 'คืนเหรียญเปิดไฟ (ยกเลิกก่อนยืนยัน)')
  } else if (booking.status === 'CONFIRMED') {
    const until = minutesUntil(booking.date, booking.startTime)
    if (until < cancelLeadMinutes()) {
      throw new ApiError(
        400,
        'CANCEL_TOO_LATE',
        `ยกเลิกได้ก่อนเวลาเริ่มอย่างน้อย ${cancelLeadMinutes() / 60} ชั่วโมง`,
      )
    }
    await releaseBooking(booking.id, 'CANCELLED', 'คืนเหรียญเปิดไฟ (ยกเลิกการจอง)')
  } else {
    throw new ApiError(400, 'INVALID_STATE', 'ไม่สามารถยกเลิกการจองนี้ได้')
  }
  const freshUser = await prisma.user.findUnique({ where: { id: booking.userId } })
  const fresh = await loadBooking(booking.id)
  return {
    booking: serializeBooking(fresh!, { revealSecrets: false }),
    coinBalance: freshUser?.coinBalance ?? user.coinBalance,
  }
}

export async function checkIn(codeRaw: string) {
  await sweep()
  const prisma = getPrisma()
  const code = codeRaw.trim().toUpperCase().replace(/^MUSC:/, '')
  const booking = await prisma.booking.findFirst({
    where: { OR: [{ checkInCode: code }, { qrToken: codeRaw.trim() }] },
  })
  if (!booking) throw new ApiError(404, 'NOT_FOUND', 'ไม่พบรหัสการจองนี้')
  if (booking.status === 'CHECKED_IN') {
    const full = await loadBooking(booking.id)
    return { booking: await withQr(serializeBooking(full!, { revealSecrets: true })), alreadyCheckedIn: true }
  }
  if (booking.status !== 'CONFIRMED') {
    throw new ApiError(400, 'INVALID_STATE', 'การจองนี้ยังไม่ยืนยัน หรือถูกยกเลิกแล้ว')
  }
  const untilStart = minutesUntil(booking.date, booking.startTime)
  const untilEnd = minutesUntil(booking.date, booking.endTime)
  if (untilStart > checkInEarlyMinutes() || untilEnd < -checkInLateMinutes()) {
    throw new ApiError(
      400,
      'OUTSIDE_WINDOW',
      `เช็คอินได้ตั้งแต่ ${checkInEarlyMinutes()} นาทีก่อนเริ่ม จนถึง ${checkInLateMinutes()} นาทีหลังเลิก`,
    )
  }
  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'CHECKED_IN', checkedInAt: new Date() },
  })
  broadcast({ type: 'availability', facilityId: booking.facilityId, date: booking.date })
  const full = await loadBooking(booking.id)
  return { booking: await withQr(serializeBooking(full!, { revealSecrets: true })), alreadyCheckedIn: false }
}

const bookingInclude = {
  facility: true,
  teammates: true,
  loans: { include: { equipment: true } },
  user: { select: { id: true, name: true, studentId: true, email: true, department: true, role: true } },
  otp: { select: { expiresAt: true, attempts: true, sends: true, consumed: true } },
} satisfies Prisma.BookingInclude

export async function loadBooking(id: string) {
  return getPrisma().booking.findUnique({ where: { id }, include: bookingInclude })
}

type LoadedBooking = NonNullable<Awaited<ReturnType<typeof loadBooking>>>

export function serializeBooking(booking: LoadedBooking, opts: { revealSecrets: boolean }) {
  const reveal = opts.revealSecrets && ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(booking.status)
  return {
    id: booking.id,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    purpose: booking.purpose,
    activityName: booking.activityName,
    lightsOn: booking.lightsOn,
    lightCost: booking.lightCost,
    notes: booking.notes,
    status: booking.status,
    checkInCode: reveal ? booking.checkInCode : null,
    checkedInAt: booking.checkedInAt,
    cancelledAt: booking.cancelledAt,
    confirmedAt: booking.confirmedAt,
    createdAt: booking.createdAt,
    facility: {
      id: booking.facility.id,
      slug: booking.facility.slug,
      type: booking.facility.type,
      nameTh: booking.facility.nameTh,
      nameEn: booking.facility.nameEn,
      location: booking.facility.location,
    },
    teammates: booking.teammates.map((mate) => ({
      name: mate.name,
      email: mate.email,
      phone: mate.phone,
      department: mate.department,
    })),
    equipment: booking.loans.map((loan) => ({
      id: loan.equipmentId,
      nameTh: loan.equipment.nameTh,
      nameEn: loan.equipment.nameEn,
      qty: loan.qty,
    })),
    booker: booking.user,
    otp: booking.otp
      ? {
          expiresAt: booking.otp.expiresAt,
          attempts: booking.otp.attempts,
          sends: booking.otp.sends,
          consumed: booking.otp.consumed,
        }
      : null,
  }
}

export async function withQr<T extends { checkInCode: string | null }>(booking: T) {
  if (!booking.checkInCode) return { ...booking, qrDataUrl: null }
  const QRCode = await import('qrcode')
  const qrDataUrl = await QRCode.toDataURL(`MUSC:${booking.checkInCode}`, {
    margin: 1,
    width: 420,
    color: { dark: '#071833', light: '#ffffff' },
  })
  return { ...booking, qrDataUrl }
}

export function slotLabel(start: string, slotMinutes: number) {
  return `${start}–${formatMinutes(parseMinutes(start) + slotMinutes)}`
}
