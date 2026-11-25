import { CalendarDays, Coins, History, LayoutGrid, LogOut, Mail, Menu, Moon, QrCode, Sun, Ticket, Wrench, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { api } from '../lib/api'
import { cn, roleLabel } from '../lib/format'
import { HoldBanner } from './HoldBanner'
import { Skeleton } from './ui'

function Seal({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <img
      src="/hero/mahidol-seal.svg"
      alt="ตราสัญลักษณ์มหาวิทยาลัยมหิดล"
      width={64}
      height={64}
      className={`${className} shrink-0 rounded-full bg-white object-contain ring-2 ring-gold-400 shadow-sm`}
    />
  )
}

const links = [
  { to: '/calendar', label: 'ปฏิทิน', icon: CalendarDays },
  { to: '/facilities', label: 'สนาม', icon: LayoutGrid },
  { to: '/bookings', label: 'การจอง', icon: Ticket },
  { to: '/history', label: 'ประวัติ', icon: History },
  { to: '/wallet', label: 'เหรียญ', icon: Coins },
]

export function Layout({ devMail }: { devMail: boolean }) {
  const { user, loading, setUser } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    setUser(null)
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="bg-app min-h-screen p-6">
        <Skeleton className="h-14 w-56" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    )
  }

  const nav = (
    <>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium',
              isActive ? 'bg-gold-400 text-navy-950' : 'text-white/80 hover:bg-white/10 hover:text-white',
            )
          }
        >
          <link.icon size={18} />
          {link.label}
        </NavLink>
      ))}
      {user?.role === 'ADMIN' && (
        <>
          <NavLink to="/admin" end onClick={() => setOpen(false)} className={({ isActive }) => cn('flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm', isActive ? 'bg-gold-400 text-navy-950' : 'text-white/80 hover:bg-white/10')}>
            <Wrench size={18} /> แดชบอร์ด
          </NavLink>
          <NavLink to="/admin/scanner" onClick={() => setOpen(false)} className={({ isActive }) => cn('flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm', isActive ? 'bg-gold-400 text-navy-950' : 'text-white/80 hover:bg-white/10')}>
            <QrCode size={18} /> สแกนเช็คอิน
          </NavLink>
        </>
      )}
      {devMail && (
        <NavLink to="/dev-mail" onClick={() => setOpen(false)} className={({ isActive }) => cn('flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm', isActive ? 'bg-gold-400 text-navy-950' : 'text-white/80 hover:bg-white/10')}>
          <Mail size={18} /> จดหมายทดสอบ
        </NavLink>
      )}
    </>
  )

  return (
    <div className="bg-app min-h-screen">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[90] focus:rounded-xl focus:bg-white focus:px-3 focus:py-2">ข้ามไปเนื้อหา</a>
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[250px] flex-col bg-navy-900 px-4 py-5 text-white lg:flex">
        <div className="flex items-center gap-3 px-1">
          <Seal />
          <div>
            <p className="font-display text-sm font-semibold leading-tight">MUSC SportSpace</p>
            <p className="mt-1 text-[11px] leading-tight text-gold-300">คณะวิทยาศาสตร์ มหิดล</p>
          </div>
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">{nav}</nav>
        {user ? (
          <button onClick={logout} className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-white/70 hover:bg-white/10">
            <LogOut size={16} /> ออกจากระบบ
          </button>
        ) : (
          <NavLink to="/login" className="rounded-2xl bg-gold-400 px-3 py-2 text-center text-sm font-semibold text-navy-950">เข้าสู่ระบบ</NavLink>
        )}
      </aside>

      <div className="lg:pl-[250px]">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/40 bg-white/70 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
          <div className="flex items-center gap-2 lg:hidden">
            <Seal className="h-10 w-10" />
            <span className="font-display text-sm font-semibold leading-tight">MUSC SportSpace</span>
          </div>
          <p className="hidden text-sm text-slate-500 dark:text-slate-400 lg:block">คณะวิทยาศาสตร์ มหาวิทยาลัยมหิดล</p>
          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden items-center gap-2 rounded-full bg-navy-900 px-3 py-1.5 text-xs text-white sm:flex dark:bg-gold-400 dark:text-navy-950">
                <Coins size={14} />
                <span className="font-semibold">{user.coinBalance.toLocaleString('th-TH')}</span>
                <span className="opacity-70">เหรียญ</span>
              </div>
            )}
            <button onClick={toggle} className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-slate-200 dark:bg-white/10 dark:ring-white/10" aria-label="สลับโหมดสี">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-slate-200 lg:hidden dark:bg-white/10 dark:ring-white/10" aria-label="เมนู" onClick={() => setOpen(true)}>
              <Menu size={18} />
            </button>
            {user && <div className="hidden text-right leading-tight lg:block"><p className="text-sm font-semibold">{user.name}</p><p className="text-xs text-slate-500">{roleLabel(user.role)}</p></div>}
          </div>
        </header>

        {open && (
          <div className="no-print fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-black/50" aria-label="ปิดเมนู" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-[78%] max-w-xs flex-col bg-navy-900 p-4 text-white">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Seal className="h-10 w-10" />
                  <span className="font-display text-sm font-semibold leading-tight">MUSC SportSpace</span>
                </div>
                <button aria-label="ปิด" onClick={() => setOpen(false)}><X /></button>
              </div>
              <div className="flex flex-col gap-1">{nav}</div>
              {user && <button onClick={logout} className="mt-auto flex items-center gap-2 px-3 py-3 text-sm text-white/70"><LogOut size={16} /> ออกจากระบบ</button>}
            </div>
          </div>
        )}

        <main id="content" className="pb-nav px-4 py-5 sm:px-6 lg:px-8">
          {user && <HoldBanner />}
          <Outlet />
        </main>
      </div>

      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/95 lg:hidden">
        <div className="grid grid-cols-5">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2 text-[11px]', isActive ? 'text-navy-800 dark:text-gold-300' : 'text-slate-500')}>
              <link.icon size={18} />
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
