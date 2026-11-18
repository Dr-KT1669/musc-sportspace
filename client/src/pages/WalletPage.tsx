import { Coins } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { ApiError, api } from '../lib/api'
import { useToast } from '../context/ToastContext'

type Tx = { id: string; amount: number; reason: string; createdAt: string }

export default function WalletPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Tx[]>([])

  useEffect(() => {
    if (!loading && !user) navigate('/login')
    if (!user) return
    api<{ balance: number; transactions: Tx[] }>('/api/wallet')
      .then((data) => { setBalance(data.balance); setTransactions(data.transactions) })
      .catch((error) => toast.push(error instanceof ApiError ? error.message : 'โหลดกระเป๋าไม่สำเร็จ', 'err'))
  }, [user, loading])

  if (balance === null) return <Skeleton className="h-64" />
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Wallet</p>
      <h1 className="font-display text-3xl font-semibold">กระเป๋าเหรียญ</h1>
      <div className="mt-4 overflow-hidden rounded-[32px] bg-navy-900 p-6 text-white">
        <p className="flex items-center gap-2 text-sm text-gold-300"><Coins size={16} /> คงเหลือ</p>
        <p className="mt-2 font-display text-6xl font-semibold">{balance.toLocaleString('th-TH')}</p>
        <p className="mt-3 max-w-md text-sm text-white/70">เหรียญใช้เมื่อเปิดไฟสนาม ระบบกันวงเงินตอนส่งคำขอ และคืนให้ถ้า OTP หมดอายุหรือยกเลิกก่อนเวลาเริ่มอย่างน้อย 2 ชั่วโมง</p>
      </div>
      <ul className="mt-4 space-y-2">
        {transactions.map((tx) => (
          <li key={tx.id} className="glass flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
            <span>{tx.reason}<span className="mt-1 block text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString('th-TH')}</span></span>
            <span className={tx.amount < 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-600'}>{tx.amount > 0 ? '+' : ''}{tx.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
