import { Request, Response, NextFunction } from 'express'
import { z, ZodSchema, ZodError } from 'zod'

// Zod formuliert seine eigenen Meldungen englisch. Gemessen am 24.10.2026:
// "Validierungsfehler: email: Invalid input: expected string, received
// undefined" - mitten in einer deutschen Oberfläche. Die eigenen Texte der
// Schemata bleiben davon unberührt.
z.config(z.locales.de())

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
