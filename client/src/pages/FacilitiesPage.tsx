import { motion } from 'framer-motion'
import { Clock, MapPin, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SportArt, sportOf } from '../components/Sports'
import { Skeleton } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { ApiError, api } from '../lib/api'
import { todayIso } from '../lib/format'
import type { Facility } from '../lib/types'

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[] | null>(null)
  const toast = useToast()
  const [filter, setFilter] = useState('ALL')

  useEffect(() => {
    api<{ facilities: Facility[] }>(`/api/facilities?date=${todayIso()}`)
      .then((data) => setFacilities(data.facilities))
      .catch((error) => toast.push(error instanceof ApiError ? error.message : 'โหลดสนามไม่สำเร็จ', 'err'))
  }, [toast])

  const types = ['ALL', ...new Set((facilities || []).map((item) => item.type))]
  const visible = (facilities || []).filter((item) => filter === 'ALL' || item.type === filter)

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Facilities</p>
          <h1 className="font-display text-3xl font-semibold">สนามและอุปกรณ์</h1>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {types.map((type) => (
            <button key={type} onClick={() => setFilter(type)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${filter === type ? 'bg-navy-900 text-white dark:bg-gold-400 dark:text-navy-950' : 'bg-white dark:bg-white/10'}`}>
              {type === 'ALL' ? 'ทั้งหมด' : sportOf(type).th}
            </button>
          ))}
        </div>
      </header>
      {!facilities && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((facility, index) => {
          const sport = sportOf(facility.type)
          return (
            <motion.article key={facility.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="group relative overflow-hidden rounded-[28px] text-white shadow-lift" style={{ background: `linear-gradient(145deg, ${sport.from}, ${sport.to})` }}>
              <div className="absolute -right-4 -top-6 opacity-80 transition group-hover:scale-105"><SportArt type={facility.type} /></div>
              <div className="relative flex min-h-[250px] flex-col justify-end bg-gradient-to-t from-black/50 to-transparent p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-white/70">{sport.en}</p>
                <h2 className="font-display text-2xl font-semibold">{facility.nameTh}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-white/80">{facility.description}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/80">
                  <span className="inline-flex items-center gap-1"><Clock size={13} /> {facility.openTime}–{facility.closeTime}</span>
                  <span className="inline-flex items-center gap-1"><Users size={13} /> {facility.capacity} คน</span>
                  <span className="inline-flex items-center gap-1"><MapPin size={13} /> {facility.location}</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm">{facility.closedToday ? 'ปิดปรับปรุงวันนี้' : `ว่างวันนี้ ${facility.freeSlots}/${facility.totalSlots}`}</p>
                  <Link to={`/book/${facility.slug}`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy-950">จอง</Link>
                </div>
              </div>
            </motion.article>
          )
        })}
      </div>
    </div>
  )
}
