import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'
import SunCalc from 'suncalc'
import { heuteISO } from '../lib/datum'

const router = Router()

// Die Antwort verrät die Koordinaten des Motivs
router.use('/locations/:id', requireMemberVia(projectIdFromTable('locations', 'id')))

// Munich defaults
const DEFAULT_LAT = 48.1351
const DEFAULT_LNG = 11.5820

// GET /api/locations/:id/sun?date=YYYY-MM-DD
router.get('/locations/:id/sun', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const location = await db.get('SELECT * FROM locations WHERE id = ?', [req.params.id]) as any
  if (!location) return res.status(404).json({ data: null, error: 'Motiv nicht gefunden' })

  // Ohne Koordinaten am Motiv wird München eingesetzt. Das ist eine Annahme,
  // keine Messung: zwischen München und Bochum liegen gut vier Längengrade,
  // die Golden Hour verschiebt sich um eine Viertelstunde. Die Antwort sagt
  // deshalb, woher die Koordinaten stammen - die Oberfläche kann es anzeigen.
  const hatKoordinaten = (location.lat != null && location.lat !== 0)
    && (location.lng != null && location.lng !== 0)
  const lat: number = hatKoordinaten ? location.lat : DEFAULT_LAT
  const lng: number = hatKoordinaten ? location.lng : DEFAULT_LNG

  // Mittag des Tages, ohne Datum heute in deutscher Zeit. Vorher "jetzt" in
  // der Zeit des Servers - zwischen 0 und 2 Uhr nachts der Vortag.
  const parsed = new Date(`${String(req.query.date || '').slice(0, 10)}T12:00:00Z`)
  const date = isNaN(parsed.getTime()) ? new Date(`${heuteISO()}T12:00:00Z`) : parsed

  const times = SunCalc.getTimes(date, lat, lng)

  // Golden Hour: vom Sonnenaufgang, bis die Sonne 6 Grad hoch steht
  // (goldenHourEnd), und abends von 6 Grad (goldenHour) bis zum Untergang.
  // Vorher begann sie morgens mit der nautischen Dämmerung - die Sonne steht
  // dann 12 Grad unter dem Horizont. Gemessen am 25.10.2026 für Bochum am
  // 02.11.: "Golden Hour ab 06:12", Sonnenaufgang 07:27.

  return res.json({
    data: {
      sunrise: times.sunrise instanceof Date && !isNaN(times.sunrise.getTime()) ? times.sunrise.toISOString() : null,
      sunset: times.sunset instanceof Date && !isNaN(times.sunset.getTime()) ? times.sunset.toISOString() : null,
      solar_noon: times.solarNoon instanceof Date && !isNaN(times.solarNoon.getTime()) ? times.solarNoon.toISOString() : null,
      golden_hour_morning_start: times.sunrise instanceof Date && !isNaN(times.sunrise.getTime()) ? times.sunrise.toISOString() : null,
      golden_hour_morning_end: times.goldenHourEnd instanceof Date && !isNaN(times.goldenHourEnd.getTime()) ? times.goldenHourEnd.toISOString() : null,
      golden_hour_evening_start: times.goldenHour instanceof Date && !isNaN(times.goldenHour.getTime()) ? times.goldenHour.toISOString() : null,
      golden_hour_evening_end: times.sunset instanceof Date && !isNaN(times.sunset.getTime()) ? times.sunset.toISOString() : null,
      location: { id: location.id, name: location.name, lat, lng },
      koordinaten: hatKoordinaten ? 'motiv' : 'standard',
      date: date.toISOString().split('T')[0],
    },
    error: null,
  })
})

export default router
