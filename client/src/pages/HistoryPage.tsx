import { Download, Printer, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatusPill, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ApiError, api } from '../lib/api'
import { addDays, formatThaiDate, todayIso } from '../lib/format'
import type { Booking } from '../lib/types'

export default function HistoryPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [rows, setRows] = useState<Booking[] | null>(null)
  const [q, setQ] = useState('')
  const [week, setWeek] = useState(true)
  const [from, setFrom] = useState(addDays(todayIso(), -7))
  const [to, setTo] = useState(todayIso())

  useEffect(() => {
    if (!loading && !user) navigate('/login')
    if (!user) return
    api<{ bookings: Booking[] }>('/api/bookings')
      .then((data) => setRows(data.bookings))
      .catch((error) => toast.push(error instanceof ApiError ? error.message : 'โหลดประวัติไม่สำเร็จ', 'err'))
  }, [user, loading])

  const filtered = useMemo(() => {
    const start = week ? addDays(todayIso(), -7) : from
    const end = week ? todayIso() : to
    return (rows || []).filter((row) => {
      if (row.date < start || row.date > end) return false
      const blob = `${row.facility.nameTh} ${row.activityName} ${row.checkInCode || ''} ${row.teammates.map((m) => m.name).join(' ')}`.toLowerCase()
      return blob.includes(q.trim().toLowerCase())
    })
  }, [rows, q, week, from, to])

  function exportCsv() {
    const header = ['ลำดับ', 'ประเภทกีฬา', 'วันที่', 'เวลา', 'เปิดไฟ/ปิดไฟ', 'สถานะ']
    const lines = filtered.map((row, index) => [index + 1, row.facility.nameTh, row.date, `${row.startTime}-${row.endTime}`, row.lightsOn ? 'เปิดไฟ' : 'ปิดไฟ', row.status])
    const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sportspace-history.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!rows) return <Skeleton className="h-80" />
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">History</p>
          <h1 className="font-display text-3xl font-semibold">ประวัติการจอง</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm dark:bg-white/10"><Printer size={16} /> พิมพ์</button>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-2xl bg-navy-900 px-3 py-2 text-sm text-white"><Download size={16} /> Export</button>
        </div>
      </div>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-2xl bg-white px-3 py-2 dark:bg-white/10">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาสนาม กิจกรรม หรือรหัส" className="w-full bg-transparent text-base outline-none" />
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={week} onChange={(e) => setWeek(e.target.checked)} /> 7 วันล่าสุด</label>
        {!week && (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border px-2 py-2 dark:border-white/10 dark:bg-navy-950" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border px-2 py-2 dark:border-white/10 dark:bg-navy-950" />
          </>
        )}
      </div>
      <div className="print-area glass overflow-x-auto rounded-[28px]">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-navy-900 text-white">
            <tr>{['ลำดับ', 'ประเภทกีฬา', 'วันที่', 'เวลา', 'เปิดไฟ/ปิดไฟ', 'สถานะ'].map((col) => <th key={col} className="px-3 py-3 font-medium">{col}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => (
              <tr key={row.id} className="border-t border-slate-100 dark:border-white/5">
                <td className="px-3 py-3">{index + 1}</td>
                <td className="px-3 py-3">{row.facility.nameTh}</td>
                <td className="px-3 py-3">{formatThaiDate(row.date, false)}</td>
                <td className="px-3 py-3">{row.startTime}–{row.endTime}</td>
                <td className="px-3 py-3">{row.lightsOn ? 'เปิดไฟ' : 'ปิดไฟ'}</td>
                <td className="px-3 py-3"><StatusPill status={row.status} /></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">ไม่พบรายการ</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
