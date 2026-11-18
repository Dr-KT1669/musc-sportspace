import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'

type Tone = 'ok' | 'err' | 'info'
type Toast = { id: number; message: string; tone: Tone }

const ToastContext = createContext<{
  push: (message: string, tone?: Tone) => void
}>({ push: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((message: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((list) => [...list, { id, message, tone }])
    window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 4200)
  }, [])
  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 top-16 z-[80] flex flex-col items-center gap-2 px-3 sm:top-20 sm:items-end sm:px-5" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-white/50 bg-white/95 px-4 py-3 text-sm shadow-lift dark:border-white/10 dark:bg-navy-950/95"
            role="status"
          >
            {toast.tone === 'ok' && <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={18} />}
            {toast.tone === 'err' && <XCircle className="mt-0.5 shrink-0 text-rose-500" size={18} />}
            {toast.tone === 'info' && <Info className="mt-0.5 shrink-0 text-sky-500" size={18} />}
            <p className="flex-1 leading-6">{toast.message}</p>
            <button className="text-slate-400" aria-label="ปิดการแจ้งเตือน" onClick={() => setToasts((list) => list.filter((item) => item.id !== toast.id))}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
