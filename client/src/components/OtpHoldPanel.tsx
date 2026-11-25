import { useEffect, useState } from 'react'
import { Button } from './ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ApiError, api } from '../lib/api'
import { clearHold, formatCountdown, type ActiveHold } from '../lib/hold'
import { formatThaiDate } from '../lib/format'
import type { Booking } from '../lib/types'

type Mail = { id: string; to: string; subject: string; text: string; createdAt: string; meta?: { bookingId?: string; otp?: string } }

export function OtpHoldPanel({
  hold,
  compact = false,
  onConfirmed,
  onReleased,
}: {
  hold: ActiveHold
  compact?: boolean
  onConfirmed?: (booking: Booking) => void
  onReleased?: (message: string) => void
}) {
  const { user, setCoins } = useAuth()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [left, setLeft] = useState(() => formatCountdown(hold.expiresAt))
  const [busy, setBusy] = useState(false)
  const [mail, setMail] = useState<Mail | null>(null)
  const [released, setReleased] = useState('')

  useEffect(() => {
    let stopped = false
    const tick = () => {
      if (stopped) return
      const ms = new Date(hold.expiresAt).getTime() - Date.now()
      if (ms <= 0) {
        stopped = true
        setLeft('00:00')
        void release('รหัส OTP หมดเวลาแล้ว ระบบได้ปล่อยช่วงเวลานี้ให้ผู้อื่นจอง')
        return
      }
      setLeft(formatCountdown(hold.expiresAt))
    }
    tick()
    const timer = window.setInterval(tick, 250)
    return () => { stopped = true; clearInterval(timer) }
  }, [hold.expiresAt, hold.bookingId])

  useEffect(() => {
    let stop = false
    async function load() {
      try {
        const data = await api<{ emails: Mail[] }>('/api/dev/mailbox')
        if (stop) return
        const match = data.emails.find((item) => item.meta?.bookingId === hold.bookingId)
        setMail(match || null)
      } catch {
        if (!stop) setMail(null)
      }
    }
    load()
    const timer = window.setInterval(load, 3000)
    return () => { stop = true; clearInterval(timer) }
  }, [hold.bookingId])

  async function release(message: string) {
    clearHold()
    try {
      await api('/api/bookings/hold')
    } catch {
      /* sweep runs on the server when the hold is read */
    }
    setReleased(message)
    onReleased?.(message)
  }

  async function confirmOtp() {
    setBusy(true)
    try {
      const data = await api<{ booking: Booking; coinBalance: number }>(`/api/bookings/${hold.bookingId}/otp`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      clearHold()
      setCoins(data.coinBalance)
      toast.push('ยืนยันการจองเรียบร้อยแล้ว', 'ok')
      onConfirmed?.(data.booking)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'ยืนยันไม่สำเร็จ'
      if (error instanceof ApiError && (error.code === 'OTP_EXPIRED' || error.code === 'OTP_LOCKED')) {
        await release(message)
      }
      toast.push(message, 'err')
    } finally {
      setBusy(false)
    }
  }

  async function cancelHold() {
    if (!confirm('ยกเลิกรายการที่รอการยืนยันรหัส OTP นี้หรือไม่')) return
    setBusy(true)
    try {
      const data = await api<{ coinBalance: number }>(`/api/bookings/${hold.bookingId}/cancel`, { method: 'POST' })
      clearHold()
      setCoins(data.coinBalance)
      const message = 'ยกเลิกรายการที่รอการยืนยันแล้ว ช่วงเวลาดังกล่าวเปิดให้ผู้อื่นจองได้'
      toast.push(message, 'ok')
      onReleased?.(message)
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'ยกเลิกไม่สำเร็จ', 'err')
    } finally {
      setBusy(false)
    }
  }

  if (released) {
    return <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-100" role="alert">{released}</p>
  }

  return (
    <div className={compact ? 'space-y-3' : 'mx-auto grid max-w-3xl gap-4 text-left lg:grid-cols-[1fr_0.9fr]'}>
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">รอยืนยัน OTP</p>
        <h2 className="font-display text-2xl font-semibold">{hold.facilityName}</h2>
        <p className="text-sm text-slate-500">{formatThaiDate(hold.date)} · {hold.startTime}–{hold.endTime}</p>
        <p className="mt-2 text-sm">เหลือเวลายืนยัน <span className="font-semibold tabular-nums">{left}</span></p>
        <p className="mt-1 text-sm text-slate-500">รหัส 6 หลักถูกส่งไปยัง {user?.email || 'อีเมลสถาบัน'}</p>
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" aria-label="รหัส OTP" className="mt-3 w-full rounded-3xl border px-4 py-4 text-center font-display text-3xl tracking-[0.4em] dark:border-white/10 dark:bg-transparent" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="gold" disabled={busy || code.length !== 6} onClick={confirmOtp}>ยืนยันการจอง</Button>
          <Button variant="ghost" disabled={busy} onClick={cancelHold}>ยกเลิกรายการนี้</Button>
        </div>
        <p className="mt-3 text-sm text-slate-500">หากไม่ยืนยันภายในเวลาที่กำหนด ระบบจะยกเลิกรายการชั่วคราวและเปิดช่วงเวลานี้ให้ผู้อื่นจอง</p>
      </div>
      <aside className="rounded-3xl bg-white/80 p-4 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10">
        <p className="text-sm font-medium">จดหมายยืนยัน</p>
        {mail?.meta?.otp ? (
          <>
            <p className="mt-2 font-display text-4xl tracking-[0.3em] text-navy-800 dark:text-gold-300">{mail.meta.otp}</p>
            <p className="mt-2 text-xs text-slate-500">{mail.subject}</p>
            <Button className="mt-3" variant="ghost" onClick={() => setCode(mail.meta?.otp || '')}>ใช้รหัสจากจดหมาย</Button>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">รหัสถูกส่งไปยังอีเมลสถาบัน หากเป็นการใช้งานทดสอบ ระบบจะแสดงรหัสในกล่องจดหมายนี้</p>
        )}
        <a href="/dev-mail" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm underline">เปิดกล่องจดหมายทดสอบในแท็บใหม่</a>
      </aside>
    </div>
  )
}
