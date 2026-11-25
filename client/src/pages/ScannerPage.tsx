import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ApiError, api } from '../lib/api'
import { todayIso } from '../lib/format'

type Row = { id: string; startTime: string; endTime: string; status: string; facilityNameTh: string; bookerName: string; checkInCode: string | null }
type Result = { alreadyCheckedIn: boolean; booking: { facility: { nameTh: string }; booker: { name: string }; startTime: string; endTime: string; checkInCode: string | null; status: string } }

export default function ScannerPage() {
  const { user, loading } = useAuth()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [cameraError, setCameraError] = useState('')
  const regionId = 'qr-region'
  const running = useRef(false)

  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    api<{ bookings: Row[] }>(`/api/admin/bookings?date=${todayIso()}`).then((data) => setRows(data.bookings)).catch(() => setRows([]))
  }, [user, result])

  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    let scanner: { stop: () => Promise<void> } | null = null
    let cancelled = false
    ;(async () => {
      try {
        const mod = await import('html5-qrcode')
        if (cancelled || running.current) return
        const instance = new mod.Html5Qrcode(regionId)
        scanner = instance
        running.current = true
        await instance.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: 220 },
          (text: string) => { void submit(text) },
          () => {},
        )
      } catch {
        if (!cancelled) setCameraError('ใช้กล้องไม่ได้ในเครื่องนี้ กรอกรหัสด้านล่างแทน')
      }
    })()
    return () => {
      cancelled = true
      running.current = false
      scanner?.stop().catch(() => {})
    }
  }, [user])

  async function submit(raw: string) {
    const value = raw.trim()
    if (value.length < 4) return
    try {
      const data = await api<Result>('/api/admin/checkin', { method: 'POST', body: JSON.stringify({ code: value }) })
      setResult(data)
      toast.push(data.alreadyCheckedIn ? 'รายการนี้ได้ดำเนินการเช็คอินแล้ว' : 'เช็คอินเรียบร้อยแล้ว', 'ok')
      setCode('')
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'เช็คอินไม่สำเร็จ', 'err')
    }
  }

  if (loading) return <Skeleton className="h-80" />
  if (!user) return <Navigate to="/login" />
  if (user.role !== 'ADMIN') return <p>หน้านี้สำหรับผู้ดูแลสนาม</p>

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="glass rounded-[28px] p-4">
        <h1 className="font-display text-3xl font-semibold">สแกนเช็คอิน</h1>
        <p className="mb-3 text-sm text-slate-500">สแกนรหัส QR จากอุปกรณ์ของผู้จอง หรือกรอกรหัส 6 หลัก</p>
        <div id={regionId} className="overflow-hidden rounded-3xl bg-navy-950" />
        {cameraError && <p className="mt-2 text-sm text-amber-700">{cameraError}</p>}
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit(code) }}>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="เช่น MUSC:AB12CD หรือ AB12CD" className="flex-1 rounded-2xl border px-3 py-3 text-base uppercase dark:border-white/10 dark:bg-transparent" aria-label="รหัสเช็คอิน" />
          <Button variant="gold">ตรวจ</Button>
        </form>
        {result && (
          <article className="mt-4 rounded-3xl bg-emerald-500 p-4 text-white">
            <p className="text-sm">{result.alreadyCheckedIn ? 'เช็คอินแล้ว' : 'ผ่านเข้าใช้ได้'}</p>
            <h2 className="font-display text-2xl font-semibold">{result.booking.booker.name}</h2>
            <p>{result.booking.facility.nameTh}</p>
            <p>{result.booking.startTime}–{result.booking.endTime} · {result.booking.checkInCode}</p>
          </article>
        )}
      </section>
      <section>
        <h2 className="mb-2 font-display text-xl font-semibold">การจองวันนี้</h2>
        {!rows && <Skeleton className="h-40" />}
        <ul className="space-y-2">
          {(rows || []).map((row) => (
            <li key={row.id} className="glass flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm">
              <div>
                <p className="font-medium">{row.startTime}–{row.endTime} · {row.facilityNameTh}</p>
                <p className="text-slate-500">{row.bookerName} · {row.status}</p>
              </div>
              {row.checkInCode && <button className="rounded-xl bg-navy-900 px-3 py-2 text-xs text-white" onClick={() => submit(row.checkInCode || '')}>{row.checkInCode}</button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
