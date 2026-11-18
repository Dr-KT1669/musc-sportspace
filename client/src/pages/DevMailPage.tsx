import { useEffect, useState } from 'react'
import { Skeleton } from '../components/ui'
import { api } from '../lib/api'

type Mail = { id: string; to: string; subject: string; text: string; createdAt: string; meta?: { otp?: string } }

export default function DevMailPage() {
  const [emails, setEmails] = useState<Mail[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stop = false
    async function load() {
      try {
        const data = await api<{ emails: Mail[] }>('/api/dev/mailbox')
        if (!stop) setEmails(data.emails)
      } catch {
        if (!stop) setError('กล่องจดหมายทดลองไม่พร้อม ถ้าตั้ง SMTP ไว้ รหัสจะถูกส่งทางอีเมลจริง')
      }
    }
    load()
    const timer = window.setInterval(load, 3000)
    return () => { stop = true; clearInterval(timer) }
  }, [])

  if (error) return <p className="text-slate-500">{error}</p>
  if (!emails) return <Skeleton className="h-64" />
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs uppercase tracking-[0.18em] text-amber-600">Development only</p>
      <h1 className="font-display text-3xl font-semibold">กล่องจดหมายทดลอง</h1>
      <p className="mb-4 text-sm text-slate-500">ไม่มี SMTP จึงแสดง OTP ที่นี่และในล็อกของเซิร์ฟเวอร์ ใช้ทดสอบการยืนยันการจองได้ครบ</p>
      {!emails.length && <p className="glass rounded-[28px] p-6 text-slate-500">ยังไม่มีอีเมล ลองจองสนามแล้วกลับมาที่นี่</p>}
      <div className="space-y-3">
        {emails.map((mail) => (
          <article key={mail.id} className="glass rounded-[28px] p-4">
            <p className="text-xs text-slate-500">{new Date(mail.createdAt).toLocaleString('th-TH')} · {mail.to}</p>
            <h2 className="font-semibold">{mail.subject}</h2>
            {mail.meta?.otp && <p className="mt-2 font-display text-4xl tracking-[0.3em] text-navy-800 dark:text-gold-300">{mail.meta.otp}</p>}
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-600 dark:text-slate-300">{mail.text}</pre>
          </article>
        ))}
      </div>
    </div>
  )
}
