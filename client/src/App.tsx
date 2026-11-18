import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { api } from './lib/api'
import AdminPage from './pages/AdminPage'
import BookingDetailPage from './pages/BookingDetailPage'
import BookingsPage from './pages/BookingsPage'
import BookPage from './pages/BookPage'
import CalendarPage from './pages/CalendarPage'
import DevMailPage from './pages/DevMailPage'
import FacilitiesPage from './pages/FacilitiesPage'
import HistoryPage from './pages/HistoryPage'
import LoginPage from './pages/LoginPage'
import ScannerPage from './pages/ScannerPage'
import WalletPage from './pages/WalletPage'

export default function App() {
  const [devMail, setDevMail] = useState(false)
  useEffect(() => {
    api<{ devMail: boolean }>('/api/meta')
      .then((meta) => setDevMail(meta.devMail))
      .catch(() => setDevMail(false))
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout devMail={devMail} />}>
        <Route path="/" element={<Navigate to="/calendar" replace />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/facilities" element={<FacilitiesPage />} />
        <Route path="/book/:slug" element={<BookPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/scanner" element={<ScannerPage />} />
        <Route path="/dev-mail" element={<DevMailPage />} />
        <Route path="*" element={<p className="text-center text-slate-500">ไม่พบหน้านี้</p>} />
      </Route>
    </Routes>
  )
}
