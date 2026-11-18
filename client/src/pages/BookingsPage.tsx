import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { sportOf } from '../components/Sports'
import { Button, Skeleton, StatusPill } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ApiError, api } from '../lib/api'
import { formatThaiDate } from '../lib/format'
import type { Booking } from '../lib/types'

export default function BookingsPage() {
  const { user, loading, setCoins } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<Booking[] | null>(null)

  function load() {
    api<{ bookings: Booking[] }>('/api/bookings').then((data) => setBookings(data.bookings)).catch((error) => toast.push(error instanceof ApiError ? error.message : 'โหลดไม่สำเร็จ', 'err'))
  }
  useEffect(() => { if (!loading && !user) navigate('/login'); if (user) load() }, [user, loading])

  async function cancel(id: string) {
    if (!confirm('ยกเลิกการจองนี้?')) return
    try {
      const data = await api<{ coinBalance: number }>(`/api/bookings/${id}/cancel`, { method: 'POST' })
      setCoins(data.coinBalance)
      toast.push('ยกเลิกแล้ว ช่วงเวลาว่างให้คนอื่น', 'ok')
      load()
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'ยกเลิกไม่สำเร็จ', 'err')
    }
  }

  if (!bookings) return <Skeleton className="h-80" />
  const upcoming = bookings.filter((b) => ['CONFIRMED', 'CHECKED_IN', 'PENDING_OTP'].includes(b.status))
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">การจองของฉัน</h1>
      <p className="mb-4 text-sm text-slate-500">ยกเลิกล่วงหน้าอย่างน้อย 2 ชั่วโมงเพื่อคืนเหรียญเปิดไฟ</p>
      {!upcoming.length && <div className="glass rounded-[28px] p-8 text-center">ยังไม่มีรายการที่กำลังจะมาถึง <Link className="ml-2 underline" to="/facilities">เลือกสนาม</Link></div>}
      <div className="grid gap-3">
        {upcoming.map((booking) => (
          <article key={booking.id} className="glass flex flex-col gap-3 rounded-[28px] p-4 sm:flex-row sm:items-center">
            <div className="h-14 w-2 rounded-full" style={{ background: sportOf(booking.facility.type).from }} />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{booking.facility.nameTh}</h2><StatusPill status={booking.status} /></div>
              <p className="text-sm text-slate-500">{formatThaiDate(booking.date)} · {booking.startTime}–{booking.endTime} {booking.lightsOn ? '· เปิดไฟ' : '· ปิดไฟ'}</p>
            </div>
            <div className="flex gap-2">
              <Link to={`/bookings/${booking.id}`} className="rounded-2xl bg-navy-900 px-4 py-2 text-sm text-white dark:bg-gold-400 dark:text-navy-950">QR</Link>
              {['CONFIRMED', 'PENDING_OTP'].includes(booking.status) && <Button variant="ghost" onClick={() => cancel(booking.id)}>ยกเลิก</Button>}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
