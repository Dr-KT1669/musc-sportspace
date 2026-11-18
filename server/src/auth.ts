import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'
import { getPrisma } from './db.js'
import { ApiError, toPublic, type PublicUser } from './http.js'

const COOKIE = 'sportspace_token'

function secret() {
  return process.env.JWT_SECRET || 'dev-only-change-me-sportspace'
}

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, secret(), { expiresIn: '7d' })
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === '1',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE, { path: '/' })
}

export function readToken(req: Request) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE]
  return cookie || null
}

async function userFromRequest(req: Request): Promise<PublicUser | null> {
  const token = readToken(req)
  if (!token) return null
  try {
    const payload = jwt.verify(token, secret()) as { sub: string }
    const user = await getPrisma().user.findUnique({ where: { id: payload.sub } })
    return user ? toPublic(user) : null
  } catch {
    return null
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    ;(req as Request & { user?: PublicUser }).user = (await userFromRequest(req)) || undefined
  } catch {
    /* ignore invalid token on public routes */
  }
  next()
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await userFromRequest(req)
  if (!user) {
    next(new ApiError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบ'))
    return
  }
  ;(req as Request & { user: PublicUser }).user = user
  next()
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: PublicUser }).user
    if (!user) {
      next(new ApiError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบ'))
      return
    }
    if (!roles.includes(user.role)) {
      next(new ApiError(403, 'FORBIDDEN', 'บัญชีนี้ไม่มีสิทธิ์ใช้งานส่วนนี้'))
      return
    }
    next()
  }
}

export function currentUser(req: Request) {
  return (req as Request & { user: PublicUser }).user
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export function authResponse(user: PublicUser, token: string) {
  return {
    user,
    token: process.env.NODE_ENV === 'production' ? undefined : token,
  }
}
