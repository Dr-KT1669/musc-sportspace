export function formatThaiDate(iso: string, withWeekday = true) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return new Intl.DateTimeFormat('th-TH', {
    weekday: withWeekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(dt)
}

export function formatRange(start: string, end: string) {
  return `${start}–${end}`
}

export const STATUS_LABEL: Record<string, string> = {
  PENDING_OTP: 'รอยืนยัน OTP',
  CONFIRMED: 'ยืนยันแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
  CHECKED_IN: 'เช็คอินแล้ว',
  COMPLETED: 'เสร็จสิ้น',
  EXPIRED: 'หมดอายุ',
}

export const PURPOSE_LABEL: Record<string, string> = {
  PRACTICE: 'ซ้อม / ใช้งานทั่วไป',
  CLUB: 'กิจกรรมชมรม',
  COMPETITION: 'แข่งขันภายใน',
}

export function roleLabel(role: string) {
  if (role === 'ADMIN') return 'ผู้ดูแลสนาม'
  if (role === 'STAFF') return 'บุคลากร'
  return 'นักศึกษา'
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function startOfWeek(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const mondayOffset = (wd + 6) % 7
  return addDays(iso, -mondayOffset)
}

export function monthMatrix(year: number, month: number) {
  const firstWd = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const lead = (firstWd + 6) % 7
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: Array<string | null> = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= days; day++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}
