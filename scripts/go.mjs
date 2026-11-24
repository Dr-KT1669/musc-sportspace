import { spawn } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import net from 'node:net'

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env')
  console.log('Created .env from .env.example')
}

function run(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { stdio: 'inherit', shell: true })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with ${code}`))
    })
  })
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' }, () => {
      socket.end()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
  })
}

if (!(await portOpen(5432))) {
  console.log('PostgreSQL is not on port 5432. Trying docker compose up -d db ...')
  try {
    await run('docker compose up -d db')
  } catch {
    console.error('Start PostgreSQL first, or run: docker compose up -d db')
    console.error('Expected DATABASE_URL like postgresql://sportspace:sportspace@127.0.0.1:5432/sportspace')
    process.exit(1)
  }
  for (let i = 0; i < 30 && !(await portOpen(5432)); i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

await run('npx prisma db push')
await run('npx tsx prisma/seed.ts')
console.log('\n  MUSC SportSpace  →  http://127.0.0.1:43123\n')
await run(
  'npx concurrently -n server,web -c blue,magenta "npx tsx watch --env-file=.env server/src/index.ts" "npx vite --config client/vite.config.ts --host 0.0.0.0 --port 43123"',
)
