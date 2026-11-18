import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/format'

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'gold' }) {
  const styles = {
    primary: 'bg-navy-900 text-white hover:bg-navy-800 dark:bg-gold-400 dark:text-navy-950 dark:hover:bg-gold-300',
    gold: 'bg-gold-400 text-navy-950 hover:bg-gold-300',
    ghost: 'bg-white/70 text-navy-900 ring-1 ring-slate-200 hover:bg-white dark:bg-white/5 dark:text-white dark:ring-white/10',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
  }[variant]
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        styles,
        className,
      )}
    />
  )
}

export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium">{label}</span>
      <input
        {...props}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-gold-400 focus:ring-2 dark:border-white/10 dark:bg-white/5"
      />
      {hint && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-slate-200/80 dark:bg-white/10', className)} />
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-navy-950/60" aria-label="ปิด" onClick={onClose} />
      <div className="glass relative z-10 w-full max-w-md rounded-[28px] p-5">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    CONFIRMED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
    CHECKED_IN: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
    PENDING_OTP: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100',
    CANCELLED: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    COMPLETED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-100',
    EXPIRED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-100',
  }
  const label: Record<string, string> = {
    CONFIRMED: 'ยืนยันแล้ว',
    CHECKED_IN: 'เช็คอินแล้ว',
    PENDING_OTP: 'รอ OTP',
    CANCELLED: 'ยกเลิก',
    COMPLETED: 'เสร็จสิ้น',
    EXPIRED: 'หมดอายุ',
  }
  return <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', map[status] || map.CANCELLED)}>{label[status] || status}</span>
}
