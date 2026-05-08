import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'cutsheet-dev-secret-change-in-production'

export interface AuthUser {
  id: number
  email: string
  name: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser
    req.user = payload
    next()
  } catch {
    res.status(401).json({ data: null, error: 'Token ungültig oder abgelaufen' })
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET) as AuthUser
    } catch {}
  }
  next()
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ data: null, error: 'Keine Berechtigung' })
    next()
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '30d' })
}
