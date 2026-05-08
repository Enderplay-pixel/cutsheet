import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (e) {
      if (e instanceof ZodError) {
        const errors = e.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
        return res.status(400).json({ data: null, error: `Validierungsfehler: ${errors}` })
      }
      next(e)
    }
  }
}
