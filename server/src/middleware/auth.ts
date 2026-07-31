import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

import { getJwtSecret } from '../config/secrets'

// Bewusst als Funktion statt als Konstante: in der Produktion soll ein
// fehlender Schluessel einen Fehler ausloesen und nicht still durchgehen.

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
    const payload = jwt.verify(token, getJwtSecret()) as AuthUser
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
      req.user = jwt.verify(token, getJwtSecret()) as AuthUser
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
  return jwt.sign(user, getJwtSecret(), { expiresIn: '30d' })
}
