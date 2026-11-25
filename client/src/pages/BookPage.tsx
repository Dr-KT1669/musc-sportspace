import { motion } from 'framer-motion'
import { Check, Lightbulb, LightbulbOff, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { OtpHoldPanel } from '../components/OtpHoldPanel'
import { SportArt, sportOf } from '../components/Sports'
import { Button, Field, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ApiError, api } from '../lib/api'
import { addDays, cn, formatThaiDate, todayIso } from '../lib/format'
import { saveHold, type ActiveHold } from '../lib/hold'
import type { Booking, Facility, Slot } from '../lib/types'

type Mate = { name: string; email: string; phone: string; department: string }
type Eq = { id: string; nameTh: string; availableQty: number }

export default function BookPage() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const { user, setCoins } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [facility, setFacility] = useState<Facility | null>(null)
  const [date, setDate] = useState(params.get('date') || todayIso())
  const [slots, setSlots] = useState<Slot[]>([])
  const [closedReason, setClosedReason] = useState<string | null>(null)
  const [start, setStart] = useState(params.get('start') || '')
  const [hours, setHours] = useState(1)
  const [step, setStep] = useState<'time' | 'details' | 'otp' | 'done'>('time')
  const [purpose, setPurpose] = useState(user?.role === 'STUDENT' ? 'PRACTICE' : 'CLUB')
  const [activityName, setActivityName] = useState('')
  const [lightsOn, setLightsOn] = useState(false)
  const [notes, setNotes] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [guestName, setGuestName] = useState('')
  const [mates, setMates] = useState<Mate[]>([])
  const [equipment, setEquipment] = useState<Eq[]>([])
  const [qty, setQty] = useState<Record<string, number>>({})
  const [booking, setBooking] = useState<Booking | null>(null)
  const [hold, setHold] = useState<ActiveHold | null>(null)
  const [busy, setBusy] = useState(false)
  const [lost, setLost] = useState('')
  const idempotencyKey = useRef('')
  const submitting = useRef(false)
  const startRef = useRef('')
  const stepRef = useRef(step)

  useEffect(() => {
    if (!user) return
    let stop = false
    api<{ hold: ActiveHold | null }>('/api/bookings/hold')
      .then((data) => {
        if (stop || !data.hold || data.hold.facilitySlug !== slug) return
        saveHold(data.hold)
        setHold(data.hold)
        setStep('otp')
      })
      .catch(() => {})
    return () => { stop = true }
  }, [user, slug])

  useEffect(() => {
    api<{ facility: Facility }>(`/api/facilities/${slug}`)
      .then((data) => setFacility(data.facility))
      .catch(() => toast.push('ไม่พบสนาม', 'err'))
  }, [slug, toast])

  useEffect(() => {
    if (user && user.role !== 'STUDENT') {
      api<{ equipment: Eq[] }>('/api/equipment').then((data) => setEquipment(data.equipment)).catch(() => {})
    }
  }, [user])

  useEffect(() => {
    let stop = false
    async function load() {
      try {
        const data = await api<{ slots: Slot[]; closedReason: string | null }>(`/api/availability?facility=${slug}&date=${date}`)
        if (stop) return
        setSlots(data.slots)
        setClosedReason(data.closedReason)
      } catch (error) {
        if (!stop) toast.push(error instanceof ApiError ? error.message : 'โหลดช่วงเวลาไม่สำเร็จ', 'err')
      }
    }
    load()
    const timer = window.setInterval(load, 4000)
    const stream = new EventSource('/api/events')
    stream.onmessage = () => {
      load().then(() => {
        const chosen = startRef.current
        if (!chosen || stepRef.current !== 'time') return
      })
    }
    return () => { stop = true; clearInterval(timer); stream.close() }
  }, [slug, date, toast])

  useEffect(() => {
    startRef.current = start
    stepRef.current = step
    idempotencyKey.current = crypto.randomUUID()
    setLost('')
  }, [slug, date, start, hours, step])

  const warnedSlot = useRef('')
  useEffect(() => {
    if (!start || (step !== 'time' && step !== 'details')) return
    const slot = slots.find((item) => item.startTime === start)
    if (!slot) return
    const gone = slot.state === 'booked' || slot.state === 'closed' || (slot.state === 'holding' && !slot.bookingId)
    if (!gone) return
    const key = `${date}:${start}`
    if (warnedSlot.current === key) return
    warnedSlot.current = key
    setLost('ช่วงเวลานี้มีการจองแล้ว')
    setStart('')
    setStep('time')
    toast.push('ช่วงเวลานี้มีการจองแล้ว กรุณาเลือกช่วงเวลาอื่น', 'err')
  }, [slots, start, step, date, toast])

  const end = useMemo(() => {
    if (!start || !facility) return ''
    const [h, m] = start.split(':').map(Number)
    const total = h * 60 + m + hours * facility.slotMinutes
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }, [start, hours, facility])

  const rangeFree = useMemo(() => {
    if (!start || !facility) return false
    const need: string[] = []
    const [h, m] = start.split(':').map(Number)
    for (let i = 0; i < hours; i++) {
      const t = h * 60 + m + i * facility.slotMinutes
      need.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`)
    }
    return need.every((time) => slots.some((slot) => slot.startTime === time && (slot.state === 'available' || (slot.state === 'holding' && slot.bookingId))))
  }, [start, hours, facility, slots])

  const lightCost = facility && lightsOn ? facility.lightCoinCost * hours : 0
  const dates = Array.from({ length: 14 }, (_, i) => addDays(todayIso(), i))

  async function addEmails() {
    const emails = emailInput.split(/[,\s;]+/).map((item) => item.trim()).filter(Boolean)
    if (!emails.length) return
    try {
      const data = await api<{ members: Mate[]; missing: string[] }>(`/api/members/lookup?emails=${encodeURIComponent(emails.join(','))}`)
      setMates((current) => {
        const seen = new Set(current.map((mate) => mate.email))
        return [...current, ...data.members.filter((mate) => mate.email && !seen.has(mate.email))]
      })
      if (data.missing.length) toast.push(`ไม่พบสมาชิก: ${data.missing.join(', ')}`, 'err')
      setEmailInput('')
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'ค้นหาสมาชิกไม่สำเร็จ', 'err')
    }
  }

  async function submitBooking() {
    if (!user) { navigate('/login'); return }
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    try {
      const chosen = equipment.filter((item) => (qty[item.id] || 0) > 0).map((item) => ({ equipmentId: item.id, qty: qty[item.id] }))
      const data = await api<{ booking: Booking; otpExpiresAt: string; coinBalance: number; replayed?: boolean }>('/api/bookings', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey.current || crypto.randomUUID() },
        body: JSON.stringify({
          facilitySlug: slug,
          date,
          startTime: start,
          endTime: end,
          purpose: user.role === 'STUDENT' ? 'PRACTICE' : purpose,
          activityName,
          lightsOn,
          notes,
          teammates: mates,
          equipment: chosen,
        }),
      })
      const nextHold: ActiveHold = {
        bookingId: data.booking.id,
        facilitySlug: slug,
        facilityName: facility?.nameTh || data.booking.facility.nameTh,
        date: data.booking.date,
        startTime: data.booking.startTime,
        endTime: data.booking.endTime,
        expiresAt: data.otpExpiresAt,
        secondsLeft: Math.max(0, Math.ceil((new Date(data.otpExpiresAt).getTime() - Date.now()) / 1000)),
      }
      saveHold(nextHold)
      setHold(nextHold)
      setBooking(data.booking)
      setCoins(data.coinBalance)
      setStep('otp')
      setLost('')
      toast.push(data.replayed ? 'ระบบใช้คำขอเดิมที่ส่งไว้แล้ว' : 'ระบบได้ส่งรหัส OTP ไปยังอีเมลสถาบันแล้ว', 'ok')
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'จองไม่สำเร็จ'
      if (error instanceof ApiError && (error.code === 'SLOT_TAKEN' || error.code === 'HOLD_EXISTS')) {
        setLost(message)
        if (error.code === 'SLOT_TAKEN') {
          setStart('')
          setStep('time')
        }
      }
      toast.push(message, 'err')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  if (!facility) return <Skeleton className="h-96" />
  const sport = sportOf(facility.type)

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="overflow-hidden rounded-[28px] text-white" style={{ background: `linear-gradient(160deg, ${sport.from}, ${sport.to})` }}>
        <div className="flex justify-end pr-2 pt-2"><SportArt type={facility.type} /></div>
        <div className="p-5 pt-0">
          <p className="text-xs uppercase tracking-[0.16em] text-white/70">{sport.en}</p>
          <h1 className="font-display text-3xl font-semibold">{facility.nameTh}</h1>
          <p className="mt-2 text-sm text-white/80">{facility.location}</p>
          <p className="mt-4 text-sm">เปิด {facility.openTime}–{facility.closeTime} น. · จองได้ครั้งละ {facility.maxHours} ชม.</p>
          {facility.lightsAvailable && <p className="mt-1 text-sm">เปิดไฟ {facility.lightCoinCost} เหรียญ/ชม.</p>}
        </div>
      </aside>

      <section className="glass rounded-[28px] p-4 sm:p-6">
        {step === 'time' && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {dates.map((item) => (
                <button key={item} onClick={() => { setDate(item); setStart('') }} className={cn('min-w-20 rounded-2xl px-3 py-2 text-left text-sm', date === item ? 'bg-navy-900 text-white dark:bg-gold-400 dark:text-navy-950' : 'bg-white dark:bg-white/5')}>
                  <span className="block text-[11px] opacity-70">{formatThaiDate(item).split(' ')[0]}</span>
                  <span className="font-semibold">{Number(item.slice(-2))}</span>
                </button>
              ))}
            </div>
            {closedReason && <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">สนามปิด: {closedReason}</p>}
            {lost && <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{lost}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {slots.map((slot) => {
                const selected = start === slot.startTime
                const disabled = slot.state !== 'available' && !selected
                const label = { available: 'ว่าง', booked: 'จองแล้ว', holding: 'กำลังยืนยัน', mine: 'ของฉัน', past: 'ผ่านมาแล้ว', closed: 'ปิดปรับปรุง' }[slot.state]
                return (
                  <button key={slot.startTime} disabled={disabled} onClick={() => { setStart(slot.startTime); setHours(1) }} className={cn('rounded-2xl border px-3 py-3 text-left text-sm transition', selected ? 'border-navy-900 bg-navy-900 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-navy-950' : 'border-transparent bg-white dark:bg-white/5', disabled && 'opacity-50')}>
                    <span className="block font-semibold">{slot.startTime}–{slot.endTime}</span>
                    <span className="text-xs opacity-70">{selected ? 'ที่เลือก' : label}</span>
                  </button>
                )
              })}
            </div>
            {start && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="text-sm">ระยะเวลา
                  <select className="ml-2 rounded-xl border px-2 py-2 dark:border-white/10 dark:bg-navy-950" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                    {Array.from({ length: facility.maxHours }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} ชั่วโมง</option>)}
                  </select>
                </label>
                <Button variant="gold" disabled={!rangeFree} onClick={() => setStep('details')}>ต่อไป · {start}–{end}</Button>
                {!rangeFree && <span className="text-sm text-rose-600">บางช่วงในระยะนี้ไม่ว่าง</span>}
              </div>
            )}
          </>
        )}

        {step === 'details' && (
          <div className="space-y-4">
            <button className="text-sm text-slate-500" onClick={() => setStep('time')}>← เปลี่ยนเวลา</button>
            <h2 className="font-display text-2xl font-semibold">{formatThaiDate(date)} · {start}–{end}</h2>
            {user?.role !== 'STUDENT' && (
              <label className="block text-sm">วัตถุประสงค์
                <select className="mt-1 w-full rounded-2xl border px-3 py-3 dark:border-white/10 dark:bg-navy-950" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                  <option value="PRACTICE">ซ้อม / ใช้งานทั่วไป</option>
                  <option value="CLUB">กิจกรรมชมรม</option>
                  <option value="COMPETITION">แข่งขันภายใน</option>
                </select>
              </label>
            )}
            {purpose !== 'PRACTICE' && <Field label="ชื่อกิจกรรม" value={activityName} onChange={(e) => setActivityName(e.target.value)} />}
            {facility.lightsAvailable && (
              <button type="button" onClick={() => setLightsOn((v) => !v)} className={cn('flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left', lightsOn ? 'border-amber-300 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-white/10')}>
                <span className="flex items-center gap-2">{lightsOn ? <Lightbulb className="text-amber-500" /> : <LightbulbOff />} {lightsOn ? 'เปิดไฟ' : 'ปิดไฟ'}</span>
                <span className="text-sm">{lightCost ? `${lightCost} เหรียญ` : 'ไม่เสียเหรียญ'}</span>
              </button>
            )}
            <div>
              <p className="text-sm font-medium">ผู้ร่วมทีมจากอีเมลสมาชิก</p>
              <div className="mt-1 flex gap-2">
                <input value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="คั่นด้วยจุลภาค เช่น name@student.mahidol.ac.th" className="flex-1 rounded-2xl border px-3 py-3 text-base dark:border-white/10 dark:bg-transparent" />
                <Button type="button" variant="ghost" onClick={addEmails}><Plus size={16} /> เพิ่ม</Button>
              </div>
              <div className="mt-2 flex gap-2">
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="หรือเพิ่มชื่อผู้ร่วมที่ยังไม่มีบัญชี" className="flex-1 rounded-2xl border px-3 py-3 text-base dark:border-white/10 dark:bg-transparent" />
                <Button type="button" variant="ghost" onClick={() => { if (guestName.trim()) { setMates((m) => [...m, { name: guestName.trim(), email: '', phone: '', department: '' }]); setGuestName('') } }}>เพิ่มชื่อ</Button>
              </div>
              <ul className="mt-3 space-y-2">
                {mates.map((mate, index) => (
                  <li key={`${mate.email}-${index}`} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-sm dark:bg-white/5">
                    <span><b>{mate.name}</b> {mate.department && <span className="text-slate-500">· {mate.department}</span>} {mate.phone && <span className="text-slate-500">· {mate.phone}</span>}</span>
                    <button aria-label="ลบ" onClick={() => setMates((list) => list.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
            </div>
            {user?.role === 'STUDENT' ? <p className="text-sm text-slate-500">การยืมอุปกรณ์เปิดให้บุคลากรและผู้ดูแลสนาม</p> : (
              <div>
                <p className="text-sm font-medium">ยืมอุปกรณ์พร้อมการจอง</p>
                <div className="mt-2 space-y-2">
                  {equipment.map((item) => (
                    <label key={item.id} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-sm dark:bg-white/5">
                      <span>{item.nameTh} <span className="text-slate-500">คงเหลือ {item.availableQty}</span></span>
                      <input type="number" min={0} max={item.availableQty} value={qty[item.id] || 0} onChange={(e) => setQty((q) => ({ ...q, [item.id]: Number(e.target.value) }))} className="w-20 rounded-xl border px-2 py-1 dark:border-white/10 dark:bg-navy-950" />
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="block text-sm">บันทึกเพิ่มเติม
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-2xl border px-3 py-3 dark:border-white/10 dark:bg-transparent" rows={2} />
            </label>
            <Button variant="gold" disabled={busy || !user} onClick={submitBooking}>{user ? 'ส่งคำขอและรับ OTP' : 'เข้าสู่ระบบเพื่อจอง'}</Button>
          </div>
        )}

        {step === 'otp' && hold && (
          <OtpHoldPanel
            hold={hold}
            onConfirmed={(next) => { setBooking(next); setHold(null); setStep('done') }}
            onReleased={(message) => { setHold(null); setLost(message); setStep('time') }}
          />
        )}

        {step === 'done' && booking && (
          <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white"><Check /></div>
            <h2 className="mt-3 font-display text-3xl font-semibold">จองสำเร็จ</h2>
            <p className="text-slate-500">{facility.nameTh} · {formatThaiDate(booking.date)} · {booking.startTime}–{booking.endTime}</p>
            {booking.qrDataUrl && <img src={booking.qrDataUrl} alt="QR ยืนยันการจอง" className="mx-auto mt-4 h-56 w-56 rounded-3xl bg-white p-3" />}
            <p className="mt-2 font-display text-2xl tracking-[0.3em]">{booking.checkInCode}</p>
            <p className="text-sm text-slate-500">โปรดแสดงรหัส QR นี้แก่เจ้าหน้าที่ ณ สนามเพื่อเช็คอิน</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link to={`/bookings/${booking.id}`} className="rounded-2xl bg-navy-900 px-4 py-3 text-sm font-semibold text-white">ดูรายละเอียด</Link>
              <Link to="/calendar" className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-slate-200">กลับปฏิทิน</Link>
            </div>
          </motion.div>
        )}
      </section>
    </div>
  )
}
