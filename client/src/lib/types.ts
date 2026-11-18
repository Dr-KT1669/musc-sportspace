export type User = {
  id: string
  studentId: string
  name: string
  email: string
  phone: string
  department: string
  role: string
  coinBalance: number
}

export type Facility = {
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
  closures: { id: string; startDate: string; endDate: string; reason: string }[]
  totalSlots?: number
  freeSlots?: number
  closedToday?: boolean
}

export type Slot = {
  startTime: string
  endTime: string
  state: 'available' | 'booked' | 'holding' | 'mine' | 'past' | 'closed'
  bookingId?: string
}

export type Booking = {
  id: string
  date: string
  startTime: string
  endTime: string
  purpose: string
  activityName: string
  lightsOn: boolean
  lightCost: number
  notes: string
  status: string
  checkInCode: string | null
  qrDataUrl?: string | null
  checkedInAt: string | null
  cancelledAt: string | null
  confirmedAt: string | null
  createdAt: string
  facility: { id: string; slug: string; type: string; nameTh: string; nameEn: string; location: string }
  teammates: { name: string; email: string; phone: string; department: string }[]
  equipment: { id: string; nameTh: string; nameEn: string; qty: number }[]
  otp: { expiresAt: string; attempts: number; sends: number; consumed: boolean } | null
}

export type ScheduleItem = {
  id: string
  facilityId: string
  facilitySlug: string
  facilityNameTh: string
  facilityType: string
  date: string
  startTime: string
  endTime: string
  lightsOn: boolean
  status: string
  purpose: string
  activityName: string
  isMine: boolean
  bookerName: string | null
}
