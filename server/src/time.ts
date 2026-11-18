const TZ = 'Asia/Bangkok'

export type BangkokParts = { date: string; time: string; minutes: number }

export function bangkokNowParts(date = new Date()): BangkokParts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  const hour = parts.hour === '24' ? '00' : parts.hour
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
    minutes: Number(hour) * 60 + Number(parts.minute),
  }
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function diffDays(fromIso: string, toIso: string) {
  const [ay, am, ad] = fromIso.split('-').map(Number)
  const [by, bm, bd] = toIso.split('-').map(Number)
  const da = Date.UTC(ay, am - 1, ad)
  const db = Date.UTC(by, bm - 1, bd)
  return Math.round((db - da) / 86400000)
}

export function parseMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatMinutes(mins: number) {
  const normalized = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isValidDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function minutesUntil(date: string, startTime: string, now = new Date()) {
  const nowP = bangkokNowParts(now)
  const dayDiff = diffDays(nowP.date, date)
  return dayDiff * 1440 + (parseMinutes(startTime) - nowP.minutes)
}

export function generateSlots(open: string, close: string, slotMinutes: number) {
  const slots: { startTime: string; endTime: string }[] = []
  const end = parseMinutes(close)
  for (let t = parseMinutes(open); t + slotMinutes <= end; t += slotMinutes) {
    slots.push({ startTime: formatMinutes(t), endTime: formatMinutes(t + slotMinutes) })
  }
  return slots
}

export function expandRange(startTime: string, endTime: string, slotMinutes: number) {
  const start = parseMinutes(startTime)
  const end = parseMinutes(endTime)
  if (end <= start || (end - start) % slotMinutes !== 0) return null
  const slots: string[] = []
  for (let t = start; t < end; t += slotMinutes) slots.push(formatMinutes(t))
  return slots
}
