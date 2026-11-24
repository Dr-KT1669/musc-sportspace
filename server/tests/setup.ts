import { execSync } from 'node:child_process'

process.env.DATABASE_URL = 'postgresql://sportspace:sportspace@127.0.0.1:5432/sportspace_test'
process.env.JWT_SECRET = 'test-secret-sportspace-please-change'
process.env.NODE_ENV = 'test'
process.env.RATE_LIMIT_DISABLED = '1'
process.env.OTP_TTL_MINUTES = '5'
process.env.OTP_MAX_ATTEMPTS = '5'
process.env.COOKIE_SECURE = '0'
process.env.DATABASE_POOL_SIZE = '10'

execSync('npx prisma db push --force-reset --skip-generate --accept-data-loss', {
  stdio: 'inherit',
  env: process.env,
})
