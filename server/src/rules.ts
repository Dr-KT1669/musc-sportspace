export const DEPARTMENTS = [
  'ภาควิชาคณิตศาสตร์',
  'ภาควิชาเคมี',
  'ภาควิชาชีววิทยา',
  'ภาควิชาฟิสิกส์',
  'ภาควิชาวิทยาการคอมพิวเตอร์',
  'ภาควิชาเทคโนโลยีชีวภาพ',
  'ภาควิชาพฤกษศาสตร์',
  'ภาควิชาชีวเคมี',
  'งานกิจการนักศึกษา',
  'หน่วยสนามกีฬา คณะวิทยาศาสตร์',
  'สำนักงานคณบดี',
]

export function bookingWindowDays() {
  return Number(process.env.BOOKING_WINDOW_DAYS || 14)
}
export function minLeadMinutes() {
  return Number(process.env.MIN_LEAD_MINUTES || 30)
}
export function cancelLeadMinutes() {
  return Number(process.env.CANCEL_LEAD_MINUTES || 120)
}
/** How long a won slot stays locked while the winner types the OTP. */
export function holdMs() {
  if (process.env.HOLD_SECONDS) return Number(process.env.HOLD_SECONDS) * 1000
  if (process.env.OTP_TTL_MINUTES) return Number(process.env.OTP_TTL_MINUTES) * 60 * 1000
  return 90_000
}

export function holdSeconds() {
  return Math.round(holdMs() / 1000)
}

export function otpTtlMinutes() {
  return holdMs() / 60_000
}
export function otpMaxAttempts() {
  return Number(process.env.OTP_MAX_ATTEMPTS || 5)
}
export function otpMaxSends() {
  return 3
}
export function checkInEarlyMinutes() {
  return 60
}
export function checkInLateMinutes() {
  return 30
}

export const MAX_ACTIVE: Record<string, number> = { STUDENT: 3, STAFF: 6, ADMIN: 8 }
export const STARTING_COINS: Record<string, number> = { STUDENT: 120, STAFF: 300, ADMIN: 500 }

export const PURPOSES = ['PRACTICE', 'CLUB', 'COMPETITION'] as const

export function isMahidolEmail(email: string) {
  const domain = email.toLowerCase().split('@')[1] || ''
  return (
    domain === 'mahidol.edu' ||
    domain === 'mahidol.ac.th' ||
    domain.endsWith('.mahidol.edu') ||
    domain.endsWith('.mahidol.ac.th')
  )
}

export function rulesPayload(devMail: boolean) {
  return {
    bookingWindowDays: bookingWindowDays(),
    minLeadMinutes: minLeadMinutes(),
    cancelLeadMinutes: cancelLeadMinutes(),
    otpTtlMinutes: otpTtlMinutes(),
    holdSeconds: holdSeconds(),
    otpMaxAttempts: otpMaxAttempts(),
    otpMaxSends: otpMaxSends(),
    checkInEarlyMinutes: checkInEarlyMinutes(),
    checkInLateMinutes: checkInLateMinutes(),
    maxActive: MAX_ACTIVE,
    startingCoins: STARTING_COINS,
    departments: DEPARTMENTS,
    purposes: [
      { id: 'PRACTICE', label: 'ซ้อม / ใช้งานทั่วไป', roles: ['STUDENT', 'STAFF', 'ADMIN'] },
      { id: 'CLUB', label: 'กิจกรรมชมรม', roles: ['STAFF', 'ADMIN'] },
      { id: 'COMPETITION', label: 'แข่งขันภายใน', roles: ['STAFF', 'ADMIN'] },
    ],
    devMail,
  }
}
