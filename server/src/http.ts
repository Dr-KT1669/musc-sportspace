import type { NextFunction, Request, Response } from 'express'
import { ZodError, type ZodType } from 'zod'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export class TxAbort extends Error {
  api: ApiError
  constructor(api: ApiError) {
    super(api.message)
    this.api = api
  }
}

export function asyncRoute(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export function parseBody<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new ApiError(400, 'VALIDATION', issuesMessage(result.error))
  }
  return result.data
}

function issuesMessage(error: ZodError) {
  return error.issues.map((issue) => issue.message).join(' ')
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } })
    return
  }
  if (err instanceof TxAbort) {
    res.status(err.api.status).json({ error: { code: err.api.code, message: err.api.message } })
    return
  }
  console.error(err)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'ระบบขัดข้อง กรุณาลองใหม่' } })
}

export type PublicUser = {
  id: string
  studentId: string
  name: string
  email: string
  phone: string
  department: string
  role: string
  coinBalance: number
}

export function toPublic(user: PublicUser): PublicUser {
  return {
    id: user.id,
    studentId: user.studentId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    department: user.department,
    role: user.role,
    coinBalance: user.coinBalance,
  }
}
