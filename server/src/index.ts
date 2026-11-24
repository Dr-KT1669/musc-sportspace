import dotenv from 'dotenv'
import { createApp } from './app.js'
import { sweep } from './booking.js'
import { initDb } from './db.js'

dotenv.config()

const port = Number(process.env.PORT || 43124)

await initDb()
const sweeper = setInterval(() => {
  sweep().catch((error) => console.error('sweep failed', error))
}, 2000)
sweeper.unref()
const app = createApp()
app.listen(port, '0.0.0.0', () => {
  console.log(`MUSC SportSpace API on http://127.0.0.1:${port}`)
  if ((process.env.JWT_SECRET || '').includes('change-me')) {
    console.warn('JWT_SECRET is still the development default. Change it before a public deploy.')
  }
  if (!process.env.SMTP_HOST) {
    console.log('Mailer: dev mailbox (no SMTP_HOST). OTP codes are logged here and shown at /dev-mail.')
  }
})
