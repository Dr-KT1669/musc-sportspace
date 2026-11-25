export type ActiveHold = {
  bookingId: string
  facilitySlug: string
  facilityName: string
  date: string
  startTime: string
  endTime: string
  expiresAt: string
  secondsLeft: number
}

const KEY = 'sportspace-hold'

export function saveHold(hold: ActiveHold) {
  localStorage.setItem(KEY, JSON.stringify(hold))
  window.dispatchEvent(new Event('sportspace-hold'))
}

export function readHold(): ActiveHold | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveHold
    if (!parsed?.bookingId || !parsed.expiresAt) return null
    return parsed
  } catch {
    return null
  }
}

export function clearHold() {
  if (!localStorage.getItem(KEY)) return
  localStorage.removeItem(KEY)
  window.dispatchEvent(new Event('sportspace-hold'))
}

export function holdFromBooking(booking: {
  id: string
  status: string
  date: string
  startTime: string
  endTime: string
  facility: { slug: string; nameTh: string }
  otp: { expiresAt: string } | null
}): ActiveHold | null {
  if (booking.status !== 'PENDING_OTP' || !booking.otp?.expiresAt) return null
  const expiresAt = booking.otp.expiresAt
  return {
    bookingId: booking.id,
    facilitySlug: booking.facility.slug,
    facilityName: booking.facility.nameTh,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    expiresAt,
    secondsLeft: Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  }
}

export function formatCountdown(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return '00:00'
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
