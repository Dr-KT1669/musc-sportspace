import { spawn } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'

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

await run('npx prisma db push')
await run('npx tsx prisma/seed.ts')
console.log('\n  MUSC SportSpace  →  http://127.0.0.1:43123\n')
await run(
  'npx concurrently -n server,web -c blue,magenta "npx tsx watch --env-file=.env server/src/index.ts" "npx vite --config client/vite.config.ts --host 0.0.0.0 --port 43123"',
)
