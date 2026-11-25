import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { getPrisma, initDb } from '../server/src/db.js'
import { addDays, bangkokNowParts, formatMinutes, parseMinutes } from '../server/src/time.js'

dotenv.config()

const FACILITIES = [
  { slug: 'badminton-1', type: 'BADMINTON', nameTh: 'สนามแบดมินตัน คอร์ท 1', nameEn: 'Badminton Court 1', description: 'คอร์ทในร่ม พื้นยางกันลื่น เหมาะสำหรับการซ้อมเดี่ยวและคู่', location: 'อาคารสตางค์มงคลสุข', openTime: '08:00', closeTime: '21:00', slotMinutes: 60, maxHours: 2, capacity: 4, lightsAvailable: true, lightCoinCost: 15, sortOrder: 1 },
  { slug: 'badminton-2', type: 'BADMINTON', nameTh: 'สนามแบดมินตัน คอร์ท 2', nameEn: 'Badminton Court 2', description: 'คอร์ทในร่ม พื้นยางกันลื่น มีไฟสปอตไลต์แยกสวิตช์', location: 'อาคารสตางค์มงคลสุข', openTime: '08:00', closeTime: '21:00', slotMinutes: 60, maxHours: 2, capacity: 4, lightsAvailable: true, lightCoinCost: 15, sortOrder: 2 },
  { slug: 'badminton-3', type: 'BADMINTON', nameTh: 'สนามแบดมินตัน คอร์ท 3', nameEn: 'Badminton Court 3', description: 'คอร์ทในร่ม พื้นยางกันลื่น เหมาะสำหรับการซ้อมตีลูก', location: 'อาคารสตางค์มงคลสุข', openTime: '08:00', closeTime: '21:00', slotMinutes: 60, maxHours: 2, capacity: 4, lightsAvailable: true, lightCoinCost: 15, sortOrder: 3 },
  { slug: 'basketball-1', type: 'BASKETBALL', nameTh: 'สนามบาสเกตบอล', nameEn: 'Basketball Court', description: 'สนามในร่มเต็มคอร์ท ห่วงมาตรฐานและเส้นสามคะแนน', location: 'โรงยิมคณะวิทยาศาสตร์', openTime: '08:00', closeTime: '21:00', slotMinutes: 60, maxHours: 2, capacity: 10, lightsAvailable: true, lightCoinCost: 25, sortOrder: 5 },
  { slug: 'volleyball-1', type: 'VOLLEYBALL', nameTh: 'สนามวอลเลย์บอล', nameEn: 'Volleyball Court', description: 'พื้นไม้และตาข่ายปรับความสูงได้ ทั้งในร่ม', location: 'โรงยิมคณะวิทยาศาสตร์', openTime: '08:00', closeTime: '20:00', slotMinutes: 60, maxHours: 2, capacity: 12, lightsAvailable: true, lightCoinCost: 25, sortOrder: 6 },
  { slug: 'tt-1', type: 'TABLE_TENNIS', nameTh: 'โต๊ะปิงปอง 1', nameEn: 'Table Tennis 1', description: 'โต๊ะแข่งขัน พื้นที่ด้านข้างกว้างพอสำหรับคู่', location: 'โถงกีฬา ชั้น 1', openTime: '08:00', closeTime: '21:00', slotMinutes: 60, maxHours: 2, capacity: 4, lightsAvailable: true, lightCoinCost: 10, sortOrder: 7 },
  { slug: 'tt-2', type: 'TABLE_TENNIS', nameTh: 'โต๊ะปิงปอง 2', nameEn: 'Table Tennis 2', description: 'โต๊ะซ้อมข้างโต๊ะ 1', location: 'โถงกีฬา ชั้น 1', openTime: '08:00', closeTime: '21:00', slotMinutes: 60, maxHours: 2, capacity: 4, lightsAvailable: true, lightCoinCost: 10, sortOrder: 8 },
  { slug: 'tt-3', type: 'TABLE_TENNIS', nameTh: 'โต๊ะปิงปอง 3', nameEn: 'Table Tennis 3', description: 'โต๊ะมุมเงียบ เหมาะซ้อมคนเดียวหรือคู่', location: 'โถงกีฬา ชั้น 1', openTime: '08:00', closeTime: '21:00', slotMinutes: 60, maxHours: 2, capacity: 4, lightsAvailable: true, lightCoinCost: 10, sortOrder: 9 },
  { slug: 'fitness-1', type: 'FITNESS', nameTh: 'ห้องออกกำลังกาย', nameEn: 'Fitness Room', description: 'ลู่วิ่ง เครื่องแรงต้าน และพื้นที่วอร์มอัพ มีเครื่องปรับอากาศ', location: 'อาคารกิจกรรมนักศึกษา ชั้น 1', openTime: '06:00', closeTime: '21:00', slotMinutes: 60, maxHours: 2, capacity: 15, lightsAvailable: false, lightCoinCost: 0, sortOrder: 10 },
  { slug: 'football-1', type: 'FOOTBALL', nameTh: 'สนามฟุตบอล', nameEn: 'Football Field', description: 'สนามหญ้าเทียมกลางแจ้งด้านหลังคณะ ไฟส่องสว่างรอบสนาม', location: 'สนามกลางแจ้งด้านหลังคณะวิทยาศาสตร์', openTime: '07:00', closeTime: '19:00', slotMinutes: 60, maxHours: 3, capacity: 14, lightsAvailable: true, lightCoinCost: 40, sortOrder: 11 },
  { slug: 'pool-1', type: 'SWIMMING', nameTh: 'สระว่ายน้ำ', nameEn: 'Swimming Pool', description: 'สระ 25 เมตร ต้องสวมหมวกว่ายน้ำและอาบน้ำก่อนลงสระ', location: 'ศูนย์กีฬาในร่ม', openTime: '07:00', closeTime: '18:00', slotMinutes: 60, maxHours: 2, capacity: 20, lightsAvailable: false, lightCoinCost: 0, sortOrder: 12 },
]

const EQUIPMENT = [
  { slug: 'shuttle', nameTh: 'ลูกแบดมินตัน', nameEn: 'Shuttlecocks', totalQty: 40 },
  { slug: 'racket', nameTh: 'ไม้แบดมินตัน', nameEn: 'Badminton rackets', totalQty: 12 },
  { slug: 'basketball', nameTh: 'ลูกบาสเกตบอล', nameEn: 'Basketballs', totalQty: 8 },
  { slug: 'volleyball', nameTh: 'ลูกวอลเลย์บอล', nameEn: 'Volleyballs', totalQty: 6 },
  { slug: 'tt-ball', nameTh: 'ลูกปิงปอง', nameEn: 'Table tennis balls', totalQty: 30 },
  { slug: 'tt-bat', nameTh: 'ไม้ปิงปอง', nameEn: 'Table tennis bats', totalQty: 12 },
  { slug: 'cone', nameTh: 'กรวยซ้อม', nameEn: 'Training cones', totalQty: 20 },
  { slug: 'bib', nameTh: 'เสื้อเอี๊ยมฝึกซ้อม', nameEn: 'Training bibs', totalQty: 16 },
]

type SeedUser = {
  studentId: string
  name: string
  email: string
  phone: string
  department: string
  role: 'STUDENT' | 'STAFF' | 'ADMIN'
  coins: number
}

const LEGACY_DEMO_STUDENT_ID = '66381234'

const USERS: SeedUser[] = [
  { studentId: '6705023', name: 'ทัญชานนท์ ขาวเอียด', email: 'thanchanon.kha@student.mahidol.ac.th', phone: '0812345678', department: 'ภาควิชาวิทยาการคอมพิวเตอร์', role: 'STUDENT', coins: 120 },
  { studentId: '66385678', name: 'สิริกร พงษ์ทอง', email: 'sirikorn.pon@student.mahidol.ac.th', phone: '0891112233', department: 'ภาควิชาชีววิทยา', role: 'STUDENT', coins: 120 },
  { studentId: '66380011', name: 'อนันต์ เขียวขจี', email: 'anan.k@student.mahidol.ac.th', phone: '0865550101', department: 'ภาควิชาเคมี', role: 'STUDENT', coins: 200 },
  { studentId: '66380022', name: 'มินตรา ศรีจันทร์', email: 'mintra.s@student.mahidol.edu', phone: '0823334455', department: 'ภาควิชาฟิสิกส์', role: 'STUDENT', coins: 200 },
  { studentId: 'STF10234', name: 'ดร.ปิยะ วัฒนกุล', email: 'piya.wat@mahidol.edu', phone: '0819001122', department: 'งานกิจการนักศึกษา', role: 'STAFF', coins: 300 },
  { studentId: 'ADM10001', name: 'วราภรณ์ ตั้งตรง', email: 'waraporn.tan@mahidol.ac.th', phone: '0801239876', department: 'หน่วยสนามกีฬา คณะวิทยาศาสตร์', role: 'ADMIN', coins: 500 },
]

/** Production already has the old demo student. Rename that row so bookings stay attached. */
async function migrateLegacyDemoStudent(prisma: ReturnType<typeof getPrisma>, passwordHash: string) {
  const next = USERS.find((user) => user.studentId === '6705023')
  if (!next) return
  const legacy = await prisma.user.findUnique({ where: { studentId: LEGACY_DEMO_STUDENT_ID } })
  if (!legacy) return
  const taken = await prisma.user.findUnique({ where: { studentId: next.studentId } })
  if (taken && taken.id !== legacy.id) {
    console.warn(`Demo student ${next.studentId} already exists; left ${LEGACY_DEMO_STUDENT_ID} in place.`)
    return
  }
  const emailOwner = await prisma.user.findUnique({ where: { email: next.email } })
  await prisma.user.update({
    where: { id: legacy.id },
    data: {
      studentId: next.studentId,
      name: next.name,
      email: emailOwner && emailOwner.id !== legacy.id ? legacy.email : next.email,
      passwordHash,
    },
  })
}

function code() {
  return randomBytes(4).toString('hex').toUpperCase().slice(0, 6)
}

export async function runSeed() {
  await initDb()
  const prisma = getPrisma()
  const passwordHash = await bcrypt.hash('Sport@123', 10)
  const users = new Map<string, { id: string }>()
  await migrateLegacyDemoStudent(prisma, passwordHash)

  for (const user of USERS) {
    const { coins, ...profile } = user
    const saved = await prisma.user.upsert({
      where: { studentId: user.studentId },
      update: user.studentId === '6705023'
        ? { name: user.name, email: user.email, passwordHash }
        : {},
      create: {
        ...profile,
        passwordHash,
        coinBalance: coins,
        walletTx: { create: { amount: coins, reason: 'เหรียญต้อนรับสมาชิก SportSpace' } },
      },
    })
    users.set(user.studentId, saved)
  }

  for (const facility of FACILITIES) {
    await prisma.facility.upsert({
      where: { slug: facility.slug },
      update: {
        nameTh: facility.nameTh,
        nameEn: facility.nameEn,
        description: facility.description,
        location: facility.location,
        openTime: facility.openTime,
        closeTime: facility.closeTime,
        lightCoinCost: facility.lightCoinCost,
        lightsAvailable: facility.lightsAvailable,
        maxHours: facility.maxHours,
        capacity: facility.capacity,
        isActive: true,
      },
      create: { ...facility, isActive: true },
    })
  }

  const activeBadminton = FACILITIES.filter((facility) => facility.type === 'BADMINTON').map((facility) => facility.slug)
  const retiredBadminton = await prisma.facility.findMany({
    where: { type: 'BADMINTON', slug: { notIn: activeBadminton } },
    include: { _count: { select: { bookings: true } } },
  })
  for (const extra of retiredBadminton) {
    if (extra._count.bookings > 0) {
      await prisma.facility.update({ where: { id: extra.id }, data: { isActive: false } })
    } else {
      await prisma.facility.delete({ where: { id: extra.id } })
    }
  }

  for (const item of EQUIPMENT) {
    await prisma.equipment.upsert({
      where: { slug: item.slug },
      update: { nameTh: item.nameTh, nameEn: item.nameEn },
      create: { ...item, availableQty: item.totalQty },
    })
  }

  const existing = await prisma.booking.count()
  if (existing > 0) {
    console.log(`Seed skipped sample bookings (${existing} already exist).`)
    return
  }

  const facilities = await prisma.facility.findMany()
  const bySlug = new Map(facilities.map((f) => [f.slug, f]))
  const today = bangkokNowParts().date
  const nowMin = bangkokNowParts().minutes
  const hourStart = Math.floor(nowMin / 60) * 60

  const occupied = new Set<string>()

  async function book(opts: {
    studentId: string
    slug: string
    day: number
    start: string
    hours: number
    purpose?: string
    activityName?: string
    lightsOn?: boolean
    status?: string
    charge?: boolean
  }) {
    const facility = bySlug.get(opts.slug)
    const user = users.get(opts.studentId)
    if (!facility || !user) return
    const date = addDays(today, opts.day)
    const startMin = parseMinutes(opts.start)
    const end = formatMinutes(startMin + opts.hours * 60)
    const keys: string[] = []
    for (let t = startMin; t < startMin + opts.hours * 60; t += 60) {
      const key = `${opts.slug}|${date}|${formatMinutes(t)}`
      if (occupied.has(key)) return
      keys.push(key)
    }
    keys.forEach((key) => occupied.add(key))
    const lightsOn = Boolean(opts.lightsOn && facility.lightsAvailable)
    const lightCost = lightsOn && opts.charge !== false ? facility.lightCoinCost * opts.hours : 0
    const status = opts.status || (date < today ? 'COMPLETED' : 'CONFIRMED')
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        facilityId: facility.id,
        date,
        startTime: opts.start,
        endTime: end,
        purpose: opts.purpose || 'PRACTICE',
        activityName: opts.activityName || '',
        lightsOn,
        lightCost,
        status,
        checkInCode: code(),
        qrToken: randomBytes(16).toString('hex'),
        confirmedAt: new Date(),
      },
    })
    for (let t = startMin; t < startMin + opts.hours * 60; t += 60) {
      await prisma.slotLock.create({
        data: { facilityId: facility.id, date, startTime: formatMinutes(t), bookingId: booking.id },
      })
    }
    if (lightCost > 0) {
      await prisma.user.update({ where: { id: user.id }, data: { coinBalance: { decrement: lightCost } } })
      await prisma.walletTransaction.create({
        data: { userId: user.id, amount: -lightCost, reason: `เปิดไฟ ${facility.nameTh}`, bookingId: booking.id },
      })
    }
    return booking
  }

  const liveStart = formatMinutes(Math.min(Math.max(hourStart, parseMinutes('08:00')), parseMinutes('19:00')))
  await book({ studentId: '66385678', slug: 'badminton-1', day: 0, start: liveStart, hours: 1, purpose: 'PRACTICE' })

  await book({ studentId: 'STF10234', slug: 'football-1', day: 0, start: '16:00', hours: 3, purpose: 'CLUB', activityName: 'ซ้อมฟุตบอลชมรมวิทยาศาสตร์', lightsOn: true })
  await book({ studentId: '66380011', slug: 'football-1', day: 0, start: '07:00', hours: 3, purpose: 'PRACTICE' })
  await book({ studentId: '66380022', slug: 'pool-1', day: 0, start: '07:00', hours: 1 })
  await book({ studentId: '66385678', slug: 'pool-1', day: 0, start: '08:00', hours: 1 })
  await book({ studentId: '66380011', slug: 'fitness-1', day: 0, start: '07:00', hours: 1 })
  await book({ studentId: '66380022', slug: 'fitness-1', day: 0, start: '11:00', hours: 1 })
  await book({ studentId: '66380011', slug: 'fitness-1', day: 0, start: '12:00', hours: 1 })
  await book({ studentId: '66385678', slug: 'fitness-1', day: 0, start: '17:00', hours: 1 })
  await book({ studentId: 'STF10234', slug: 'basketball-1', day: 0, start: '15:00', hours: 2, purpose: 'COMPETITION', activityName: 'บาสเกตบอลภายในภาควิชา', lightsOn: true })
  await book({ studentId: '66380022', slug: 'badminton-2', day: 0, start: '14:00', hours: 2, lightsOn: true })
  await book({ studentId: '66380011', slug: 'badminton-3', day: 0, start: '16:00', hours: 2, lightsOn: true })
  await book({ studentId: '66380022', slug: 'badminton-1', day: 2, start: '10:00', hours: 1 })
  await book({ studentId: '66380011', slug: 'tt-1', day: 0, start: '13:00', hours: 1 })
  await book({ studentId: '66385678', slug: 'tt-2', day: 0, start: '18:00', hours: 1 })

  await book({ studentId: '6705023', slug: 'badminton-2', day: 1, start: '18:00', hours: 1, lightsOn: false })
  await book({ studentId: '6705023', slug: 'fitness-1', day: -1, start: '17:00', hours: 1, status: 'COMPLETED' })
  await book({ studentId: '6705023', slug: 'badminton-1', day: -3, start: '16:00', hours: 1, lightsOn: true, status: 'COMPLETED' })
  await book({ studentId: 'STF10234', slug: 'volleyball-1', day: 1, start: '09:00', hours: 2, purpose: 'CLUB', activityName: 'วอลเลย์บอลบุคลากร' })
  await book({ studentId: '66380022', slug: 'pool-1', day: 1, start: '07:00', hours: 1 })
  await book({ studentId: '66380011', slug: 'football-1', day: 2, start: '08:00', hours: 2 })

  const volleyball = bySlug.get('volleyball-1')
  if (volleyball) {
    await prisma.closure.create({
      data: {
        facilityId: volleyball.id,
        startDate: addDays(today, 3),
        endDate: addDays(today, 3),
        reason: 'ซ่อมพื้นสนามและตาข่าย',
      },
    })
  }

  const balances = await prisma.user.findMany({ select: { studentId: true, coinBalance: true, role: true } })
  console.log('Seeded MUSC SportSpace.')
  for (const row of balances) console.log(`  ${row.role} ${row.studentId}  coins=${row.coinBalance}`)
}

const entry = process.argv[1]?.replace(/\\/g, '/') || ''
if (entry.includes('prisma/seed')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
