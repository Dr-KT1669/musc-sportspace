import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Sports'
import { Button, Field } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { ApiError, api } from '../lib/api'
import type { User } from '../lib/types'

const DEMOS = [
  { label: 'นักศึกษา', id: '66381234' },
  { label: 'บุคลากร', id: 'STF10234' },
  { label: 'ผู้ดูแลสนาม', id: 'ADM10001' },
]

const DEPARTMENTS = [
  'ภาควิชาคณิตศาสตร์',
  'ภาควิชาเคมี',
  'ภาควิชาชีววิทยา',
  'ภาควิชาฟิสิกส์',
  'ภาควิชาวิทยาการคอมพิวเตอร์',
  'ภาควิชาเทคโนโลยีชีวภาพ',
  'ภาควิชาพฤกษศาสตร์',
  'ภาควิชาชีวเคมี',
  'งานกิจการนักศึกษา',
  'หน่วยสนามกีฬา คณะวิทยาศาสตร์',
  'สำนักงานคณบดี',
]

export default function LoginPage() {
  const { user, setUser } = useAuth()
  const { theme, toggle } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [busy, setBusy] = useState(false)
  const [free, setFree] = useState<number | null>(null)
  const [form, setForm] = useState({
    studentId: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    department: DEPARTMENTS[4],
    role: 'STUDENT',
  })

  useEffect(() => {
    if (user) navigate('/calendar', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    api<{ facilities: { freeSlots?: number }[] }>('/api/facilities')
      .then((data) => setFree(data.facilities.reduce((sum, item) => sum + (item.freeSlots || 0), 0)))
      .catch(() => setFree(null))
  }, [])

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = mode === 'login' ? { studentId: form.studentId, password: form.password } : form
      const data = await api<{ user: User }>(path, { method: 'POST', body: JSON.stringify(body) })
      setUser(data.user)
      toast.push(mode === 'login' ? `สวัสดี ${data.user.name}` : 'สมัครสมาชิกแล้ว เริ่มจองสนามได้เลย', 'ok')
      navigate('/calendar')
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'เข้าสู่ระบบไม่สำเร็จ', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="court-lines absolute inset-0 opacity-70" />
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
        <svg className="absolute inset-x-8 top-24 hidden h-64 w-[80%] opacity-40 md:block" viewBox="0 0 600 240" fill="none">
          <rect x="8" y="8" width="584" height="224" rx="28" stroke="white" strokeWidth="2" />
          <path className="dash" d="M300 8v224M8 120h584" stroke="#f5c542" strokeWidth="2" />
          <circle cx="300" cy="120" r="42" stroke="#d6ff4a" strokeWidth="2" />
        </svg>
        <div className="relative flex min-h-[42vh] flex-col justify-between p-6 sm:p-10 lg:min-h-screen">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo />
              <div>
                <p className="font-display text-xl font-semibold leading-none">MUSC SportSpace</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gold-300">Faculty of Science</p>
              </div>
            </div>
            <button onClick={toggle} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label="สลับโหมดสี">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
          <div className="max-w-xl py-10">
            <p className="text-sm text-gold-300">ระบบจองสนามกีฬาและอุปกรณ์กีฬาออนไลน์</p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-6xl">จองคอร์ท ก่อนเพื่อนจะกดทัน</h1>
            <p className="mt-4 max-w-md text-white/75">แบดมินตัน บาสเกตบอล วอลเลย์บอล ปิงปอง ฟิตเนส ฟุตบอล และสระว่ายน้ำ — ยืนยันด้วย OTP อีเมลสถาบัน แล้วพก QR ไปเช็คอินหน้าสนาม</p>
            {free !== null && (
              <p className="mt-6 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm">วันนี้ยังว่าง <span className="mx-1 font-semibold text-court">{free}</span> ช่วงเวลา</p>
            )}
          </div>
          <p className="text-xs text-white/50">คณะวิทยาศาสตร์ มหาวิทยาลัยมหิดล · Salaya</p>
        </div>
      </section>

      <section className="bg-app flex items-center justify-center px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass w-full max-w-md rounded-[32px] p-6 sm:p-8">
          <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-sm font-medium dark:bg-white/5">
            <button className={mode === 'login' ? 'rounded-xl bg-white py-2 shadow dark:bg-navy-800' : 'py-2 text-slate-500'} onClick={() => setMode('login')}>เข้าสู่ระบบ</button>
            <button className={mode === 'register' ? 'rounded-xl bg-white py-2 shadow dark:bg-navy-800' : 'py-2 text-slate-500'} onClick={() => setMode('register')}>สมัครสมาชิก</button>
          </div>
          <form className="mt-5 space-y-3" onSubmit={submit}>
            <Field label="รหัสนักศึกษา / บุคลากร" value={form.studentId} onChange={(e) => set('studentId', e.target.value)} autoComplete="username" required />
            {mode === 'register' && (
              <>
                <Field label="ชื่อ-นามสกุล" value={form.name} onChange={(e) => set('name', e.target.value)} required />
                <Field label="อีเมลสถาบัน" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} hint="@mahidol.edu หรือ @mahidol.ac.th" required />
                <Field label="เบอร์โทร" value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" required />
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium">สังกัด</span>
                  <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-navy-950" value={form.department} onChange={(e) => set('department', e.target.value)}>
                    {DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium">ประเภทสมาชิก</span>
                  <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-navy-950" value={form.role} onChange={(e) => set('role', e.target.value)}>
                    <option value="STUDENT">นักศึกษา</option>
                    <option value="STAFF">บุคลากร / อาจารย์</option>
                  </select>
                </label>
              </>
            )}
            <Field label="รหัสผ่าน" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} hint={mode === 'register' ? 'อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข' : undefined} required />
            <Button className="w-full" variant="gold" disabled={busy}>{busy ? 'กำลังตรวจ...' : mode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}</Button>
          </form>
          {mode === 'login' && (
            <div className="mt-5">
              <p className="text-xs text-slate-500">บัญชีทดลอง รหัสผ่าน Sport@123</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DEMOS.map((demo) => (
                  <button key={demo.id} type="button" className="rounded-full bg-navy-900/5 px-3 py-1.5 text-xs font-medium dark:bg-white/10" onClick={() => setForm((f) => ({ ...f, studentId: demo.id, password: 'Sport@123' }))}>
                    {demo.label} · {demo.id}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </section>
    </div>
  )
}
