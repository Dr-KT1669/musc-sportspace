import { ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { sportOf } from '../components/Sports'
import { Skeleton } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { ApiError, api } from '../lib/api'
import { addDays, cn, formatThaiDate, monthMatrix, startOfWeek, todayIso } from '../lib/format'
import type { Facility, ScheduleItem } from '../lib/types'

type View = 'day' | 'week' | 'month'
type Mode = 'list' | 'grid'

export default function CalendarPage() {
  const toast = useToast()
  const [anchor, setAnchor] = useState(todayIso())
  const [view, setView] = useState<View>('day')
  const [mode, setMode] = useState<Mode>('grid')
  const [type, setType] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [closures, setClosures] = useState<{ facilitySlug: string; startDate: string; endDate: string; reason: string }[]>([])
  const [live, setLive] = useState(false)

  const range = useMemo(() => {
    if (view === 'day') return { from: anchor, to: anchor }
    if (view === 'week') {
      const start = startOfWeek(anchor)
      return { from: start, to: addDays(start, 6) }
    }
    const [y, m] = anchor.split('-').map(Number)
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const endDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return { from: start, to: `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}` }
  }, [anchor, view])

  useEffect(() => {
    let stop = false
    async function load() {
      try {
        const [schedule, facilityData] = await Promise.all([
          api<{ bookings: ScheduleItem[]; closures: { facilitySlug: string; startDate: string; endDate: string; reason: string }[] }>(`/api/schedule?from=${range.from}&to=${range.to}`),
          api<{ facilities: Facility[] }>('/api/facilities'),
        ])
        if (stop) return
        setItems(schedule.bookings)
        setClosures(schedule.closures)
        setFacilities(facilityData.facilities)
        setLoading(false)
      } catch (error) {
        if (!stop) toast.push(error instanceof ApiError ? error.message : 'โหลดตารางไม่สำเร็จ', 'err')
      }
    }
    load()
    const timer = window.setInterval(load, 5000)
    const stream = new EventSource('/api/events')
    stream.onopen = () => setLive(true)
    stream.onerror = () => setLive(false)
    stream.onmessage = () => load()
    return () => {
      stop = true
      clearInterval(timer)
      stream.close()
    }
  }, [range.from, range.to, toast])

  const filtered = items.filter((item) => type === 'ALL' || item.facilityType === type)
  const types = ['ALL', ...new Set(facilities.map((item) => item.type))]

  function shift(dir: number) {
    if (view === 'month') {
      const [y, m] = anchor.split('-').map(Number)
      const dt = new Date(Date.UTC(y, m - 1 + dir, 1))
      setAnchor(dt.toISOString().slice(0, 10))
    } else setAnchor(addDays(anchor, dir * (view === 'week' ? 7 : 1)))
  }

  const title = view === 'month' ? formatThaiDate(range.from, false).replace(/^\S+\s/, '') : view === 'week' ? `${formatThaiDate(range.from, false)} – ${formatThaiDate(range.to, false)}` : formatThaiDate(anchor)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
            <span className={cn('h-2 w-2 rounded-full', live ? 'live-dot bg-emerald-500' : 'bg-amber-400')} />
            {live ? 'ข้อมูลอัปเดตทันที' : 'กำลังเชื่อมต่อ'}
          </p>
          <h1 className="font-display text-3xl font-semibold">ปฏิทินการใช้สนาม</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-2xl bg-white p-1 dark:bg-white/10">
            {([['day', 'รายวัน'], ['week', 'รายสัปดาห์'], ['month', 'เดือน']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} className={cn('rounded-xl px-3 py-1.5 text-sm', view === id && 'bg-navy-900 text-white dark:bg-gold-400 dark:text-navy-950')}>{label}</button>
            ))}
          </div>
          {view === 'day' && (
            <div className="flex rounded-2xl bg-white p-1 dark:bg-white/10">
              <button onClick={() => setMode('grid')} className={cn('rounded-xl px-3 py-1.5 text-sm', mode === 'grid' && 'bg-navy-900 text-white dark:bg-gold-400 dark:text-navy-950')}>ตาราง</button>
              <button onClick={() => setMode('list')} className={cn('rounded-xl px-3 py-1.5 text-sm', mode === 'list' && 'bg-navy-900 text-white dark:bg-gold-400 dark:text-navy-950')}>รายการ</button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="grid h-10 w-10 place-items-center rounded-full bg-white dark:bg-white/10" aria-label="ก่อนหน้า" onClick={() => shift(-1)}><ChevronLeft size={18} /></button>
        <button className="rounded-full bg-white px-3 py-2 text-sm dark:bg-white/10" onClick={() => setAnchor(todayIso())}>วันนี้</button>
        <button className="grid h-10 w-10 place-items-center rounded-full bg-white dark:bg-white/10" aria-label="ถัดไป" onClick={() => shift(1)}><ChevronRight size={18} /></button>
        <p className="font-display text-lg font-semibold">{title}</p>
        <div className="ml-auto flex gap-2 overflow-x-auto">
          {types.map((item) => (
            <button key={item} onClick={() => setType(item)} className={cn('whitespace-nowrap rounded-full px-3 py-1.5 text-xs', type === item ? 'bg-gold-400 text-navy-950' : 'bg-white dark:bg-white/10')}>
              {item === 'ALL' ? 'ทุกประเภท' : sportOf(item).th}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Skeleton className="h-96" /> : view === 'month' ? <MonthView anchor={anchor} items={filtered} onPick={(date) => { setAnchor(date); setView('day') }} /> : view === 'week' ? <WeekView from={range.from} items={filtered} onPick={(date) => { setAnchor(date); setView('day') }} /> : mode === 'list' ? <DayList date={anchor} items={filtered} /> : <DayGrid date={anchor} items={filtered} facilities={facilities.filter((f) => type === 'ALL' || f.type === type)} closures={closures} />}
    </div>
  )
}

function DayList({ date, items }: { date: string; items: ScheduleItem[] }) {
  const rows = items.filter((item) => item.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime))
  if (!rows.length) return <Empty />
  return (
    <div className="glass overflow-hidden rounded-[28px]">
      {rows.map((item) => (
        <div key={item.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-white/5">
          <div className="w-28 shrink-0 text-sm font-semibold">{item.startTime}–{item.endTime}</div>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: sportOf(item.facilityType).from }} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{item.facilityNameTh}</p>
            <p className="text-xs text-slate-500">{item.isMine ? 'รายการของท่าน' : item.bookerName || 'มีการจองแล้ว'} {item.activityName && `· ${item.activityName}`}</p>
          </div>
          {item.lightsOn && <Lightbulb size={16} className="text-amber-500" aria-label="เปิดไฟ" />}
        </div>
      ))}
    </div>
  )
}

function DayGrid({ date, items, facilities, closures }: { date: string; items: ScheduleItem[]; facilities: Facility[]; closures: { facilitySlug: string; startDate: string; endDate: string }[] }) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 6)
  return (
    <div className="glass overflow-auto rounded-[28px]">
      <table className="min-w-[860px] w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white/90 px-2 py-3 text-left dark:bg-navy-950/90">เวลา</th>
            {facilities.map((facility) => (
              <th key={facility.id} className="px-2 py-3 text-left font-medium">{facility.nameTh.replace('สนาม', '').replace('ห้อง', '')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => {
            const start = `${String(hour).padStart(2, '0')}:00`
            return (
              <tr key={start} className="border-t border-slate-100 dark:border-white/5">
                <th className="sticky left-0 bg-white/90 px-2 py-2 text-left font-medium dark:bg-navy-950/90">{start}</th>
                {facilities.map((facility) => {
                  const closed = closures.some((c) => c.facilitySlug === facility.slug && c.startDate <= date && c.endDate >= date)
                  const hit = items.find((item) => item.facilitySlug === facility.slug && item.date === date && item.startTime <= start && item.endTime > start)
                  const open = start >= facility.openTime && start < facility.closeTime
                  if (!open) return <td key={facility.id} className="bg-slate-50 px-1 py-2 text-slate-300 dark:bg-white/5">—</td>
                  if (closed) return <td key={facility.id} className="px-1 py-2 text-slate-400">ปิด</td>
                  if (hit) return <td key={facility.id} className="px-1 py-2"><span className="block rounded-lg px-1.5 py-1 text-white" style={{ background: sportOf(facility.type).from }}>{hit.isMine ? 'ของท่าน' : 'จองแล้ว'}</span></td>
                  return <td key={facility.id} className="px-1 py-2"><Link to={`/book/${facility.slug}?date=${date}&start=${start}`} className="block rounded-lg bg-emerald-50 px-1.5 py-1 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">ว่าง</Link></td>
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function WeekView({ from, items, onPick }: { from: string; items: ScheduleItem[]; onPick: (date: string) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {days.map((date) => {
        const rows = items.filter((item) => item.date === date)
        return (
          <button key={date} onClick={() => onPick(date)} className="glass rounded-[24px] p-3 text-left">
            <p className="text-sm font-semibold">{formatThaiDate(date)}</p>
            <div className="mt-2 space-y-1">
              {rows.slice(0, 5).map((item) => (
                <p key={item.id} className="truncate rounded-lg px-2 py-1 text-[11px] text-white" style={{ background: sportOf(item.facilityType).from }}>{item.startTime} {sportOf(item.facilityType).th}</p>
              ))}
              {rows.length > 5 && <p className="text-xs text-slate-500">+{rows.length - 5}</p>}
              {!rows.length && <p className="text-xs text-slate-400">ไม่มีรายการจอง</p>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function MonthView({ anchor, items, onPick }: { anchor: string; items: ScheduleItem[]; onPick: (date: string) => void }) {
  const [y, m] = anchor.split('-').map(Number)
  const cells = monthMatrix(y, m)
  const today = todayIso()
  return (
    <div className="glass overflow-hidden rounded-[28px]">
      <div className="grid grid-cols-7 text-center text-xs text-slate-500">
        {['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 border-t border-slate-100 dark:border-white/5">
        {cells.map((date, index) => (
          <button key={index} disabled={!date} onClick={() => date && onPick(date)} className={cn('min-h-24 border-b border-r border-slate-100 p-1.5 text-left dark:border-white/5', date === today && 'bg-gold-400/15')}>
            {date && <span className="text-xs font-semibold">{Number(date.slice(-2))}</span>}
            <div className="mt-1 space-y-1">
              {items.filter((item) => item.date === date).slice(0, 3).map((item) => (
                <p key={item.id} className="truncate rounded px-1 text-[10px] text-white" style={{ background: sportOf(item.facilityType).from }}>{item.startTime} {sportOf(item.facilityType).th}</p>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function Empty() {
  return <div className="glass rounded-[28px] p-10 text-center text-slate-500">ไม่มีรายการจองในช่วงเวลาที่เลือก</div>
}
