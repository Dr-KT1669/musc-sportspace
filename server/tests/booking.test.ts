import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { getPrisma } from '../src/db.js'
import { addDays, bangkokNowParts, formatMinutes } from '../src/time.js'
import { runSeed } from '../../prisma/seed.js'

const app = createApp()

async function login(studentId: string, password = 'Sport@123') {
  const res = await request(app).post('/api/auth/login').send({ studentId, password })
  expect(res.status).toBe(200)
  return res.body.token as string
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

let seq = 1
async function registerStudent() {
  const n = seq++
  const studentId = `T${Date.now().toString().slice(-6)}${n}`
  const email = `tester${n}${Date.now().toString().slice(-4)}@student.mahidol.ac.th`
  const res = await request(app).post('/api/auth/register').send({
    studentId,
    name: `นักทดสอบ ${n}`,
    email,
    password: 'Sport@123',
    phone: '0812340000',
    department: 'ภาควิชาวิทยาการคอมพิวเตอร์',
    role: 'STUDENT',
  })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return { token: res.body.token as string, email, studentId, id: res.body.user.id as string }
}

async function otpFor(email: string) {
  const mailbox = await request(app).get('/api/dev/mailbox')
  expect(mailbox.status).toBe(200)
  const mail = (mailbox.body.emails as { to: string; text: string }[]).find((item) => item.to === email)
  const code = mail?.text.match(/\d{6}/)?.[0]
  expect(code).toBeTruthy()
  return code as string
}

function futureDate(days: number) {
  return addDays(bangkokNowParts().date, days)
}

beforeAll(async () => {
  await runSeed()
})

afterAll(async () => {
  await getPrisma().$disconnect()
})

describe('demo student', () => {
  it('renames the legacy 66381234 demo student to 6705023 and keeps the same password', async () => {
    const prisma = getPrisma()
    const seeded = await prisma.user.findUnique({ where: { studentId: '6705023' } })
    expect(seeded?.name).toBe('ทัญชานนท์ ขาวเอียด')
    expect(seeded?.email).toBe('thanchanon.kha@student.mahidol.ac.th')

    await prisma.user.update({
      where: { id: seeded!.id },
      data: {
        studentId: '66381234',
        name: 'กัญญานนท์ ขาวเอียด',
        email: 'kannanon.kha@student.mahidol.ac.th',
      },
    })

    await runSeed()

    const renamed = await prisma.user.findUnique({ where: { studentId: '6705023' } })
    expect(renamed?.id).toBe(seeded!.id)
    expect(renamed?.name).toBe('ทัญชานนท์ ขาวเอียด')
    expect(renamed?.email).toBe('thanchanon.kha@student.mahidol.ac.th')
    expect(await prisma.user.findUnique({ where: { studentId: '66381234' } })).toBeNull()

    const loginRes = await request(app).post('/api/auth/login').send({ studentId: '6705023', password: 'Sport@123' })
    expect(loginRes.status).toBe(200)
    expect(loginRes.body.user.name).toBe('ทัญชานนท์ ขาวเอียด')
    const oldLogin = await request(app).post('/api/auth/login').send({ studentId: '66381234', password: 'Sport@123' })
    expect(oldLogin.status).toBe(401)
  })
})

describe('booking conflicts', () => {
  it('rejects a second booking for the same slot and keeps the first hold', async () => {
    const a = await registerStudent()
    const b = await registerStudent()
    const payload = {
      facilitySlug: 'tt-3',
      date: futureDate(8),
      startTime: '10:00',
      endTime: '11:00',
      purpose: 'PRACTICE',
      lightsOn: false,
      teammates: [],
      equipment: [],
    }
    const [first, second] = await Promise.all([
      request(app).post('/api/bookings').set(auth(a.token)).send(payload),
      request(app).post('/api/bookings').set(auth(b.token)).send(payload),
    ])
    const statuses = [first.status, second.status].sort()
    expect(statuses).toEqual([201, 409])
    const failed = first.status === 409 ? first : second
    expect(failed.body.error.code).toBe('SLOT_TAKEN')

    const availability = await request(app).get('/api/availability').query({ facility: 'tt-3', date: payload.date })
    const slot = availability.body.slots.find((item: { startTime: string }) => item.startTime === '10:00')
    expect(slot.state).toBe('holding')
  })
})

describe('OTP flow', () => {
  it('confirms a booking only with the emailed code', async () => {
    const user = await registerStudent()
    const created = await request(app).post('/api/bookings').set(auth(user.token)).send({
      facilitySlug: 'tt-3',
      date: futureDate(9),
      startTime: '14:00',
      endTime: '15:00',
      purpose: 'PRACTICE',
      lightsOn: false,
    })
    expect(created.status).toBe(201)
    expect(created.body.booking.status).toBe('PENDING_OTP')
    expect(created.body.booking.checkInCode).toBeNull()

    const wrong = await request(app)
      .post(`/api/bookings/${created.body.booking.id}/otp`)
      .set(auth(user.token))
      .send({ code: '000000' })
    expect(wrong.status).toBe(400)
    expect(wrong.body.error.code).toBe('OTP_INVALID')

    const code = await otpFor(user.email)
    const ok = await request(app)
      .post(`/api/bookings/${created.body.booking.id}/otp`)
      .set(auth(user.token))
      .send({ code })
    expect(ok.status).toBe(200)
    expect(ok.body.booking.status).toBe('CONFIRMED')
    expect(ok.body.booking.checkInCode).toMatch(/^[A-Z0-9]{6}$/)
    expect(ok.body.booking.qrDataUrl).toContain('data:image/png')
  })

  it('locks the slot release after too many wrong attempts and after expiry', async () => {
    const user = await registerStudent()
    const date = futureDate(10)
    const created = await request(app).post('/api/bookings').set(auth(user.token)).send({
      facilitySlug: 'tt-2',
      date,
      startTime: '09:00',
      endTime: '10:00',
      purpose: 'PRACTICE',
    })
    expect(created.status).toBe(201)
    const id = created.body.booking.id as string
    for (let i = 0; i < 4; i++) {
      const res = await request(app).post(`/api/bookings/${id}/otp`).set(auth(user.token)).send({ code: '111111' })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('OTP_INVALID')
    }
    const locked = await request(app).post(`/api/bookings/${id}/otp`).set(auth(user.token)).send({ code: '111111' })
    expect(locked.status).toBe(400)
    expect(locked.body.error.code).toBe('OTP_LOCKED')
    const open = await request(app).get('/api/availability').query({ facility: 'tt-2', date })
    expect(open.body.slots.find((slot: { startTime: string }) => slot.startTime === '09:00').state).toBe('available')

    const second = await request(app).post('/api/bookings').set(auth(user.token)).send({
      facilitySlug: 'tt-2',
      date,
      startTime: '11:00',
      endTime: '12:00',
      purpose: 'PRACTICE',
    })
    expect(second.status).toBe(201)
    await getPrisma().otpCode.update({
      where: { bookingId: second.body.booking.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const expired = await request(app)
      .post(`/api/bookings/${second.body.booking.id}/otp`)
      .set(auth(user.token))
      .send({ code: '123456' })
    expect(expired.status).toBe(400)
    expect(expired.body.error.code).toBe('OTP_EXPIRED')
    const again = await request(app).get('/api/availability').query({ facility: 'tt-2', date })
    expect(again.body.slots.find((slot: { startTime: string }) => slot.startTime === '11:00').state).toBe('available')
  })
})

describe('cancellation', () => {
  it('frees the slot so someone else can book it', async () => {
    const a = await registerStudent()
    const b = await registerStudent()
    const payload = {
      facilitySlug: 'tt-1',
      date: futureDate(7),
      startTime: '15:00',
      endTime: '16:00',
      purpose: 'PRACTICE',
    }
    const created = await request(app).post('/api/bookings').set(auth(a.token)).send(payload)
    expect(created.status).toBe(201)
    const code = await otpFor(a.email)
    const confirmed = await request(app)
      .post(`/api/bookings/${created.body.booking.id}/otp`)
      .set(auth(a.token))
      .send({ code })
    expect(confirmed.status).toBe(200)

    const blocked = await request(app).post('/api/bookings').set(auth(b.token)).send(payload)
    expect(blocked.status).toBe(409)

    const cancelled = await request(app).post(`/api/bookings/${created.body.booking.id}/cancel`).set(auth(a.token))
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.booking.status).toBe('CANCELLED')

    const retry = await request(app).post('/api/bookings').set(auth(b.token)).send(payload)
    expect(retry.status).toBe(201)
  })

  it('refuses cancellation inside the two-hour deadline', async () => {
    const user = await registerStudent()
    const created = await request(app).post('/api/bookings').set(auth(user.token)).send({
      facilitySlug: 'badminton-4',
      date: futureDate(6),
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'PRACTICE',
    })
    const code = await otpFor(user.email)
    await request(app).post(`/api/bookings/${created.body.booking.id}/otp`).set(auth(user.token)).send({ code })

    const parts = bangkokNowParts()
    let start = parts.minutes + 60
    let date = parts.date
    if (start >= 1440) {
      start -= 1440
      date = addDays(date, 1)
    }
    const startTime = formatMinutes(start)
    const endTime = formatMinutes(start + 60)
    await getPrisma().booking.update({
      where: { id: created.body.booking.id },
      data: { date, startTime, endTime },
    })
    const res = await request(app).post(`/api/bookings/${created.body.booking.id}/cancel`).set(auth(user.token))
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('CANCEL_TOO_LATE')
  })
})

describe('role permissions', () => {
  it('blocks students from admin tools and equipment loans, and allows staff and admin', async () => {
    const student = await registerStudent()
    const staffToken = await login('STF10234')
    const adminToken = await login('ADM10001')

    const stats = await request(app).get('/api/admin/stats').set(auth(student.token))
    expect(stats.status).toBe(403)
    expect(stats.body.error.code).toBe('FORBIDDEN')

    const closureDenied = await request(app).post('/api/admin/closures').set(auth(student.token)).send({
      facilitySlug: 'tt-3',
      startDate: futureDate(12),
      endDate: futureDate(12),
      reason: 'ทดสอบสิทธิ์',
    })
    expect(closureDenied.status).toBe(403)

    const equipment = await request(app).get('/api/equipment').set(auth(staffToken))
    const shuttle = (equipment.body.equipment as { id: string; slug: string; availableQty: number }[]).find(
      (item) => item.slug === 'shuttle',
    )
    expect(shuttle).toBeTruthy()
    const before = shuttle!.availableQty

    const studentLoan = await request(app).post('/api/bookings').set(auth(student.token)).send({
      facilitySlug: 'badminton-3',
      date: futureDate(11),
      startTime: '10:00',
      endTime: '11:00',
      purpose: 'PRACTICE',
      equipment: [{ equipmentId: shuttle!.id, qty: 2 }],
    })
    expect(studentLoan.status).toBe(403)
    expect(studentLoan.body.error.code).toBe('EQUIPMENT_FORBIDDEN')

    const staffBooking = await request(app).post('/api/bookings').set(auth(staffToken)).send({
      facilitySlug: 'badminton-3',
      date: futureDate(11),
      startTime: '10:00',
      endTime: '11:00',
      purpose: 'CLUB',
      activityName: 'ซ้อมแบดมินตันชมรม',
      equipment: [{ equipmentId: shuttle!.id, qty: 2 }],
    })
    expect(staffBooking.status, JSON.stringify(staffBooking.body)).toBe(201)
    const afterHold = await request(app).get('/api/equipment').set(auth(staffToken))
    const held = (afterHold.body.equipment as { slug: string; availableQty: number }[]).find((item) => item.slug === 'shuttle')
    expect(held!.availableQty).toBe(before - 2)

    const adminStats = await request(app).get('/api/admin/stats').set(auth(adminToken))
    expect(adminStats.status).toBe(200)
    expect(adminStats.body.summary.todayBookings).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(adminStats.body.byDay)).toBe(true)

    const closedDate = futureDate(4)
    const closure = await request(app).post('/api/admin/closures').set(auth(adminToken)).send({
      facilitySlug: 'basketball-1',
      startDate: closedDate,
      endDate: closedDate,
      reason: 'ปิดเพื่อทดสอบสิทธิ์ผู้ดูแล',
    })
    expect(closure.status).toBe(201)

    const blocked = await request(app).post('/api/bookings').set(auth(student.token)).send({
      facilitySlug: 'basketball-1',
      date: closedDate,
      startTime: '09:00',
      endTime: '10:00',
      purpose: 'PRACTICE',
    })
    expect(blocked.status).toBe(409)
    expect(blocked.body.error.code).toBe('FACILITY_CLOSED')
  })
})
