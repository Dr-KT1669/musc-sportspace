import type { Response } from 'express'

export type LiveEvent = {
  type: 'availability'
  facilityId: string
  date: string
  at: string
}

const clients = new Set<Response>()
const pending = new Map<string, LiveEvent>()
let flushTimer: ReturnType<typeof setTimeout> | undefined

export function addClient(res: Response) {
  clients.add(res)
  res.on('close', () => clients.delete(res))
}

/**
 * Coalesce a burst of booking events into one message per facility+date.
 * A rush of hundreds of attempts should not write hundreds of frames to every viewer.
 */
export function broadcast(event: Omit<LiveEvent, 'at'> & { at?: string }) {
  const full: LiveEvent = { ...event, type: 'availability', at: event.at || new Date().toISOString() }
  pending.set(`${full.facilityId}:${full.date}`, full)
  if (flushTimer) return
  flushTimer = setTimeout(flush, 80)
  flushTimer.unref?.()
}

function flush() {
  flushTimer = undefined
  if (pending.size === 0 || clients.size === 0) {
    pending.clear()
    return
  }
  const payload = JSON.stringify({ type: 'availability', changes: [...pending.values()] })
  pending.clear()
  for (const res of clients) {
    try {
      res.write(`data: ${payload}\n\n`)
    } catch {
      clients.delete(res)
    }
  }
}

export function clientCount() {
  return clients.size
}

const timer = setInterval(() => {
  for (const res of clients) {
    try {
      res.write(`: ping\n\n`)
    } catch {
      clients.delete(res)
    }
  }
}, 20000)
timer.unref?.()
