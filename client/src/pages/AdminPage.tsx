import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, Field, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { ApiError, api } from '../lib/api'
import { STATUS_LABEL, addDays, todayIso } from '../lib/format'
import type { Facility } from '../lib/types'

type Stats = {
  summary: { todayBookings: number; upcoming: number; checkinsToday: number; lightCoins: number; activeFacilities: number; closedToday: number }
  byFacility: { name: string; type: string; count: number }[]
  byDay: { date: string; count: number }[]
  recent: { id: string; date: string; startTime: string; endTime: string; status: string; facilityNameTh: string; bookerName: string }[]
}

type Eq = { id: string; nameTh: string; nameEn: string; totalQty: number; availableQty: number }

function DayChart({ data, label }: { data: { date: string; count: number }[]; label: string }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  const w = 560
  const h = 200
  const points = data.map((d, i) => {
    const x = 28 + (i / Math.max(data.length - 1, 1)) * (w - 44)
    const y = 16 + (1 - d.count / max) * (h - 48)
    return { x, y, ...d }
  })
  const line = points.map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full" role="img" aria-label="กราฟการจอง 14 วัน">
      {[0, 0.5, 1].map((t) => (
        <line key={t} x1="28" x2={w - 12} y1={16 + t * (h - 48)} y2={16 + t * (h - 48)} stroke="currentColor" className="text-slate-200 dark:text-white/10" />
      ))}
      <polyline fill="none" stroke="#e2ae22" strokeWidth="3" strokeLinejoin="round" points={line} />
      {points.filter((p) => p.count === max).map((p) => (
        <circle key={p.date} cx={p.x} cy={p.y} r="4" fill="#e2ae22" />
      ))}
      {points.map((p, i) => i % 2 === 0 && (
        <text key={p.date} x={p.x} y={h - 8} textAnchor="middle" fontSize="11" fill={label}>{p.date.slice(5)}</text>
      ))}
    </svg>
  )
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const { theme } = useTheme()
  const toast = useToast()
  const [tab, setTab] = useState<'stats' | 'close' | 'gear'>('stats')
  const [stats, setStats] = useState<Stats | null>(null)
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [equipment, setEquipment] = useState<Eq[]>([])
  const [closure, setClosure] = useState({ facilitySlug: 'volleyball-1', startDate: addDays(todayIso(), 1), endDate: addDays(todayIso(), 1), reason: '' })
  const [gear, setGear] = useState({ nameTh: '', nameEn: '', totalQty: 10 })

  function load() {
    api<Stats>('/api/admin/stats').then(setStats).catch((error) => toast.push(error instanceof ApiError ? error.message : 'โหลดสถิติไม่สำเร็จ', 'err'))
    api<{ facilities: Facility[] }>('/api/facilities').then((data) => setFacilities(data.facilities)).catch(() => {})
    api<{ equipment: Eq[] }>('/api/equipment').then((data) => setEquipment(data.equipment)).catch(() => {})
  }
  useEffect(() => { if (user?.role === 'ADMIN') load() }, [user])

  if (loading) return <Skeleton className="h-80" />
  if (!user) return <Navigate to="/login" />
  if (user.role !== 'ADMIN') return <p>หน้านี้สำหรับผู้ดูแลสนาม</p>

  const axis = theme === 'dark' ? '#cbd5e1' : '#64748b'

  async function closeFacility(event: React.FormEvent) {
    event.preventDefault()
    try {
      await api('/api/admin/closures', { method: 'POST', body: JSON.stringify(closure) })
      toast.push('ปิดสนามในช่วงที่เลือกแล้ว', 'ok')
      setClosure((c) => ({ ...c, reason: '' }))
      load()
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'ปิดสนามไม่สำเร็จ', 'err')
    }
  }

  async function removeClosure(id: string) {
    await api(`/api/admin/closures/${id}`, { method: 'DELETE' })
    toast.push('ยกเลิกการปิดสนามแล้ว', 'ok')
    load()
  }

  async function saveGear(item: Eq) {
    try {
      await api(`/api/admin/equipment/${item.id}`, { method: 'PATCH', body: JSON.stringify({ totalQty: item.totalQty, availableQty: item.availableQty }) })
      toast.push('อัปเดตจำนวนแล้ว', 'ok')
      load()
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'บันทึกไม่สำเร็จ', 'err')
    }
  }

  async function addGear(event: React.FormEvent) {
    event.preventDefault()
    try {
      await api('/api/admin/equipment', { method: 'POST', body: JSON.stringify({ ...gear, totalQty: Number(gear.totalQty) }) })
      setGear({ nameTh: '', nameEn: '', totalQty: 10 })
      toast.push('เพิ่มอุปกรณ์แล้ว', 'ok')
      load()
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'เพิ่มไม่สำเร็จ', 'err')
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">แดชบอร์ดสนาม</h1>
      <div className="mt-3 flex gap-2">
        {[['stats', 'สถิติ'], ['close', 'ปิดปรับปรุง'], ['gear', 'อุปกรณ์']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as typeof tab)} className={`rounded-full px-4 py-2 text-sm ${tab === id ? 'bg-navy-900 text-white dark:bg-gold-400 dark:text-navy-950' : 'bg-white dark:bg-white/10'}`}>{label}</button>
        ))}
      </div>

      {tab === 'stats' && !stats && <Skeleton className="mt-4 h-80" />}
      {tab === 'stats' && stats && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['จองวันนี้', stats.summary.todayBookings],
              ['กำลังจะมาถึง', stats.summary.upcoming],
              ['เช็คอินวันนี้', stats.summary.checkinsToday],
              ['เหรียญค่าไฟ', stats.summary.lightCoins],
            ].map(([label, value]) => (
              <article key={String(label)} className="glass rounded-[24px] p-4">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="font-display text-4xl font-semibold">{value}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <article className="glass rounded-[28px] p-4">
              <h2 className="mb-2 font-semibold">การจอง 14 วัน</h2>
              <DayChart data={stats.byDay} label={axis} />
            </article>
            <article className="glass rounded-[28px] p-4">
              <h2 className="mb-3 font-semibold">ตามสนาม</h2>
              <ul className="space-y-3">
                {stats.byFacility.slice(0, 6).map((row) => {
                  const max = Math.max(...stats.byFacility.map((item) => item.count), 1)
                  return (
                    <li key={row.name}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{row.name}</span>
                        <span className="font-semibold">{row.count}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                        <div className="h-full rounded-full bg-navy-800 dark:bg-gold-400" style={{ width: `${Math.max(8, (row.count / max) * 100)}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </article>
          </div>
          <ul className="mt-4 space-y-2">
            {stats.recent.map((row) => (
              <li key={row.id} className="glass flex flex-wrap justify-between gap-2 rounded-2xl px-4 py-3 text-sm">
                <span>{row.facilityNameTh} · {row.bookerName}</span>
                <span className="text-slate-500">{row.date} {row.startTime}–{row.endTime} · {STATUS_LABEL[row.status] || row.status}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'close' && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form className="glass space-y-3 rounded-[28px] p-5" onSubmit={closeFacility}>
            <h2 className="font-display text-xl font-semibold">ปิดสนามชั่วคราว</h2>
            <label className="block text-sm">สนาม
              <select className="mt-1 w-full rounded-2xl border px-3 py-3 dark:border-white/10 dark:bg-navy-950" value={closure.facilitySlug} onChange={(e) => setClosure({ ...closure, facilitySlug: e.target.value })}>
                {facilities.map((f) => <option key={f.slug} value={f.slug}>{f.nameTh}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Field label="เริ่ม" type="date" value={closure.startDate} onChange={(e) => setClosure({ ...closure, startDate: e.target.value })} />
              <Field label="ถึง" type="date" value={closure.endDate} onChange={(e) => setClosure({ ...closure, endDate: e.target.value })} />
            </div>
            <Field label="เหตุผล" value={closure.reason} onChange={(e) => setClosure({ ...closure, reason: e.target.value })} required />
            <Button variant="gold">บันทึกการปิดสนาม</Button>
          </form>
          <div className="space-y-2">
            {facilities.flatMap((f) => f.closures.map((c) => ({ ...c, name: f.nameTh }))).map((c) => (
              <article key={c.id} className="glass flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
                <div><p className="font-medium">{c.name}</p><p className="text-slate-500">{c.startDate} – {c.endDate} · {c.reason}</p></div>
                <button className="text-rose-600" onClick={() => removeClosure(c.id)}>ยกเลิก</button>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'gear' && (
        <div className="mt-4 space-y-3">
          <form className="glass grid gap-2 rounded-[28px] p-4 sm:grid-cols-4" onSubmit={addGear}>
            <input required placeholder="ชื่อไทย" value={gear.nameTh} onChange={(e) => setGear({ ...gear, nameTh: e.target.value })} className="rounded-2xl border px-3 py-3 dark:border-white/10 dark:bg-transparent" />
            <input required placeholder="English name" value={gear.nameEn} onChange={(e) => setGear({ ...gear, nameEn: e.target.value })} className="rounded-2xl border px-3 py-3 dark:border-white/10 dark:bg-transparent" />
            <input type="number" min={1} value={gear.totalQty} onChange={(e) => setGear({ ...gear, totalQty: Number(e.target.value) })} className="rounded-2xl border px-3 py-3 dark:border-white/10 dark:bg-transparent" />
            <Button variant="gold">เพิ่ม</Button>
          </form>
          {equipment.map((item) => (
            <div key={item.id} className="glass grid items-center gap-2 rounded-2xl p-3 sm:grid-cols-[1fr_120px_120px_auto]">
              <p className="font-medium">{item.nameTh}<span className="block text-xs text-slate-500">{item.nameEn}</span></p>
              <label className="text-xs">ทั้งหมด<input type="number" className="mt-1 w-full rounded-xl border px-2 py-2 dark:border-white/10 dark:bg-navy-950" value={item.totalQty} onChange={(e) => setEquipment((list) => list.map((row) => row.id === item.id ? { ...row, totalQty: Number(e.target.value) } : row))} /></label>
              <label className="text-xs">คงเหลือ<input type="number" className="mt-1 w-full rounded-xl border px-2 py-2 dark:border-white/10 dark:bg-navy-950" value={item.availableQty} onChange={(e) => setEquipment((list) => list.map((row) => row.id === item.id ? { ...row, availableQty: Number(e.target.value) } : row))} /></label>
              <Button variant="ghost" onClick={() => saveGear(item)}>บันทึก</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
