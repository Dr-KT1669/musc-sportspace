import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'

process.env.DATABASE_URL = 'file:./test.db'
process.env.JWT_SECRET = 'test-secret-sportspace-please-change'
process.env.NODE_ENV = 'test'
process.env.RATE_LIMIT_DISABLED = '1'
process.env.OTP_TTL_MINUTES = '5'
process.env.OTP_MAX_ATTEMPTS = '5'
process.env.COOKIE_SECURE = '0'

for (const file of ['prisma/test.db', 'prisma/test.db-journal', 'prisma/test.db-wal', 'prisma/test.db-shm']) {
  rmSync(file, { force: true })
}

execSync('npx prisma db push --skip-generate --accept-data-loss', {
  stdio: 'inherit',
  env: process.env,
})
