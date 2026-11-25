import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { OtpHoldPanel } from '../components/OtpHoldPanel'
import { StatusPill, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ApiError, api } from '../lib/api'
import { PURPOSE_LABEL, formatThaiDate } from '../lib/format'
import { holdFromBooking } from '../lib/hold'
import type { Booking } from '../lib/types'

export default function BookingDetailPage() {
  const { id = '' } = useParams()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [booking, setBooking] = useState<Booking | null>(null)

  useEffect(() => {
    if (!loading && !user) navigate('/login')
    if (!user) return
    api<{ booking: Booking }>(`/api/bookings/${id}`)
      .then((data) => setBooking(data.booking))
      .catch((error) => toast.push(error instanceof ApiError ? error.message : 'ไม่พบการจอง', 'err'))
  }, [id, user, loading])

  if (!booking) return <Skeleton className="mx-auto h-96 max-w-lg" />
  return (
    <div className="mx-auto max-w-lg text-center">
      <StatusPill status={booking.status} />
      <h1 className="mt-3 font-display text-3xl font-semibold">{booking.facility.nameTh}</h1>
      <p className="text-slate-500">{formatThaiDate(booking.date)} · {booking.startTime}–{booking.endTime}</p>
      <p className="mt-1 text-sm">{PURPOSE_LABEL[booking.purpose]} {booking.activityName && `· ${booking.activityName}`}</p>
      <p className="text-sm">{booking.lightsOn ? `เปิดไฟ · ${booking.lightCost} เหรียญ` : 'ปิดไฟ'}</p>
      {holdFromBooking(booking) && (
        <div className="mt-5 text-left">
          <OtpHoldPanel hold={holdFromBooking(booking)!} onConfirmed={(next) => setBooking(next)} onReleased={() => navigate('/bookings')} />
        </div>
      )}
      {booking.qrDataUrl ? (
        <>
          <img src={booking.qrDataUrl} alt={`QR รหัส ${booking.checkInCode}`} className="mx-auto mt-5 h-64 w-64 rounded-[28px] bg-white p-4 shadow-lift" />
          <p className="mt-3 font-display text-3xl tracking-[0.28em]">{booking.checkInCode}</p>
          <p className="text-sm text-slate-500">ให้เจ้าหน้าที่สแกนหรือกรอกรหัสนี้</p>
        </>
      ) : (
        <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">รายการนี้ยังไม่มีรหัส QR เนื่องจากยังไม่ได้ยืนยัน หรือได้ยกเลิกแล้ว</p>
      )}
      {!!booking.teammates.length && (
        <ul className="mt-5 space-y-2 text-left text-sm">
          {booking.teammates.map((mate, index) => <li key={index} className="rounded-2xl bg-white px-3 py-2 dark:bg-white/5">{mate.name} {mate.department && `· ${mate.department}`} {mate.phone && `· ${mate.phone}`}</li>)}
        </ul>
      )}
      {!!booking.equipment.length && <p className="mt-3 text-sm">อุปกรณ์: {booking.equipment.map((item) => `${item.nameTh} ×${item.qty}`).join(', ')}</p>}
      <Link to="/bookings" className="mt-6 inline-block text-sm underline">กลับรายการจอง</Link>
    </div>
  )
}
