import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { clearHold, formatCountdown, readHold, type ActiveHold } from '../lib/hold'
import { formatThaiDate } from '../lib/format'
import { OtpHoldPanel } from './OtpHoldPanel'

export function HoldBanner() {
  const [hold, setHold] = useState<ActiveHold | null>(() => readHold())
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [left, setLeft] = useState('')

  useEffect(() => {
    let stop = false
    async function load() {
      const cached = readHold()
      try {
        const data = await api<{ hold: ActiveHold | null }>('/api/bookings/hold')
        if (stop) return
        if (data.hold) {
          setHold(data.hold)
          setNote('')
          localStorage.setItem('sportspace-hold', JSON.stringify(data.hold))
        } else if (cached && new Date(cached.expiresAt).getTime() <= Date.now()) {
          clearHold()
          setHold(null)
          setOpen(false)
          setNote('รหัส OTP หมดเวลาแล้ว ระบบได้ปล่อยช่วงเวลานี้ให้ผู้อื่นจอง')
        } else if (!data.hold) {
          clearHold()
          setHold(null)
        }
      } catch {
        if (!stop && cached) setHold(cached)
      }
    }
    load()
    const timer = window.setInterval(load, 5000)
    const onChange = () => load()
    window.addEventListener('sportspace-hold', onChange)
    return () => {
      stop = true
      clearInterval(timer)
      window.removeEventListener('sportspace-hold', onChange)
    }
  }, [])

  useEffect(() => {
    if (!hold) return
    const tick = () => setLeft(formatCountdown(hold.expiresAt))
    tick()
    const timer = window.setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [hold])

  if (!hold && !note) return null

  return (
    <div className="mb-4 rounded-[28px] border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-50">
      {note && <p role="status">{note}</p>}
      {hold && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">รายการจองที่รอยืนยัน OTP</p>
              <p className="font-semibold">{hold.facilityName}</p>
              <p className="text-sm">{formatThaiDate(hold.date)} · {hold.startTime}–{hold.endTime} · เหลือ {left}</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-2xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => setOpen((value) => !value)}>{open ? 'ซ่อนแบบฟอร์ม' : 'กรอกรหัส OTP'}</button>
              <Link to={`/book/${hold.facilitySlug}`} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-amber-200 dark:bg-transparent dark:text-amber-50">ไปหน้าจอง</Link>
            </div>
          </div>
          {open && (
            <div className="mt-4 rounded-3xl bg-white p-4 text-slate-900 dark:bg-navy-950 dark:text-white">
              <OtpHoldPanel
                hold={hold}
                compact
                onConfirmed={() => { setHold(null); setOpen(false); setNote('ยืนยันการจองเรียบร้อยแล้ว สามารถดูรายการได้ในประวัติการจอง') }}
                onReleased={(message) => { setHold(null); setOpen(false); setNote(message) }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
