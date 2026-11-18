export const SPORTS: Record<string, { th: string; en: string; from: string; to: string }> = {
  BADMINTON: { th: 'แบดมินตัน', en: 'Badminton', from: '#0f766e', to: '#042f2e' },
  BASKETBALL: { th: 'บาสเกตบอล', en: 'Basketball', from: '#c2410c', to: '#431407' },
  VOLLEYBALL: { th: 'วอลเลย์บอล', en: 'Volleyball', from: '#b45309', to: '#451a03' },
  TABLE_TENNIS: { th: 'ปิงปอง', en: 'Table tennis', from: '#4d7c0f', to: '#14532d' },
  FITNESS: { th: 'ฟิตเนส', en: 'Fitness', from: '#6d28d9', to: '#1e1b4b' },
  FOOTBALL: { th: 'ฟุตบอล', en: 'Football', from: '#15803d', to: '#052e16' },
  SWIMMING: { th: 'ว่ายน้ำ', en: 'Swimming', from: '#0369a1', to: '#082f49' },
}

export function sportOf(type: string) {
  return SPORTS[type] || { th: type, en: type, from: '#1d4ed8', to: '#071833' }
}

export function Logo({ className = 'h-11 w-11' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="#071833" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="#f5c542" strokeWidth="2.5" />
      <path d="M18 40 V24 l14 9 14-9 v16" fill="none" stroke="#d6ff4a" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="46" cy="18" r="3" fill="#f5c542" />
    </svg>
  )
}

export function SportArt({ type }: { type: string }) {
  const common = { fill: 'none', stroke: 'white', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (type === 'BASKETBALL') {
    return (
      <svg viewBox="0 0 120 120" className="h-28 w-28 opacity-90">
        <circle cx="60" cy="60" r="34" {...common} />
        <path d="M26 60h68M60 26c10 12 10 56 0 68M60 26c-10 12-10 56 0 68" {...common} />
      </svg>
    )
  }
  if (type === 'FOOTBALL') {
    return (
      <svg viewBox="0 0 120 120" className="h-28 w-28 opacity-90">
        <circle cx="60" cy="60" r="34" {...common} />
        <path d="M60 36l14 10-5 16H51l-5-16z" {...common} />
        <path d="M46 46 32 40M74 46l14-6M48 78l-8 14M72 78l8 14M60 62v16" {...common} />
      </svg>
    )
  }
  if (type === 'VOLLEYBALL') {
    return (
      <svg viewBox="0 0 120 120" className="h-28 w-28 opacity-90">
        <circle cx="60" cy="60" r="34" {...common} />
        <path d="M60 26c8 14 8 54 0 68M30 46c18 6 42 6 60 0M32 78c16-8 40-8 56 0" {...common} />
      </svg>
    )
  }
  if (type === 'TABLE_TENNIS') {
    return (
      <svg viewBox="0 0 120 120" className="h-28 w-28 opacity-90">
        <ellipse cx="48" cy="58" rx="22" ry="26" {...common} />
        <path d="M64 74 92 98" {...common} />
        <circle cx="86" cy="40" r="8" {...common} />
      </svg>
    )
  }
  if (type === 'FITNESS') {
    return (
      <svg viewBox="0 0 120 120" className="h-28 w-28 opacity-90">
        <path d="M18 60h16M86 60h16M34 42v36M74 42v36M34 60h40" {...common} />
      </svg>
    )
  }
  if (type === 'SWIMMING') {
    return (
      <svg viewBox="0 0 120 120" className="h-28 w-28 opacity-90">
        <path d="M18 78c10-10 16-10 26 0s16 10 26 0 16-10 26 0M18 96c10-10 16-10 26 0s16 10 26 0 16-10 26 0" {...common} />
        <circle cx="78" cy="40" r="7" {...common} />
        <path d="M70 52c8 6 16 8 28 6" {...common} />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28 opacity-90">
      <path d="M78 30c8 10 8 22-2 30L46 86c-6 4-14 2-16-6 8-2 14-10 12-18" {...common} />
      <path d="M70 42c10 2 16 12 12 22" {...common} />
      <circle cx="40" cy="34" r="4" fill="white" />
    </svg>
  )
}
