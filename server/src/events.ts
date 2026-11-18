import type { Response } from 'express'

export type LiveEvent = {
  type: 'availability'
  facilityId: string
  date: string
  at: string
}

const clients = new Set<Response>()

export function addClient(res: Response) {
  clients.add(res)
  res.on('close', () => clients.delete(res))
}

export function broadcast(event: Omit<LiveEvent, 'at'> & { at?: string }) {
  const payload = JSON.stringify({ ...event, at: event.at || new Date().toISOString() })
  for (const res of clients) {
    res.write(`data: ${payload}\n\n`)
  }
}

export function clientCount() {
  return clients.size
}

const timer = setInterval(() => {
  for (const res of clients) res.write(`: ping\n\n`)
}, 20000)
timer.unref?.()
