import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'
import SunCalc from 'suncalc'

const router = Router()

// Die Antwort verraet die Koordinaten des Motivs
router.use('/locations/:id', requireMemberVia(projectIdFromTable('locations', 'id')))

// Munich defaults
const DEFAULT_LAT = 48.1351
const DEFAULT_LNG = 11.5820

// GET /api/locations/:id/sun?date=YYYY-MM-DD
router.get('/locations/:id/sun', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const location = await db.get('SELECT * FROM locations WHERE id = ?', [req.params.id]) as any
  if (!location) return res.status(404).json({ data: null, error: 'Location nicht gefunden' })

  const lat: number = (location.lat != null && location.lat !== 0) ? location.lat : DEFAULT_LAT
  const lng: number = (location.lng != null && location.lng !== 0) ? location.lng : DEFAULT_LNG

  // Parse date parameter, default to today
  let date: Date
  if (req.query.date && typeof req.query.date === 'string') {
    const parsed = new Date(req.query.date + 'T12:00:00')
    date = isNaN(parsed.getTime()) ? new Date() : parsed
  } else {
    date = new Date()
  }

  const times = SunCalc.getTimes(date, lat, lng)

  // SunCalc field mapping:
  // times.sunrise          → sunrise
  // times.sunset           → sunset
  // times.solarNoon        → solar_noon
  // times.goldenHourEnd    → golden_hour_morning_end   (end of morning golden hour)
  // times.nauticalDawn     → golden_hour_morning_start (start of morning golden hour / nautical dawn)
  // times.goldenHour       → golden_hour_evening_start (start of evening golden hour)
  // times.sunsetStart      → golden_hour_evening_end   (end of evening golden hour / sunset start)

  return res.json({
    data: {
      sunrise: times.sunrise instanceof Date && !isNaN(times.sunrise.getTime()) ? times.sunrise.toISOString() : null,
      sunset: times.sunset instanceof Date && !isNaN(times.sunset.getTime()) ? times.sunset.toISOString() : null,
      solar_noon: times.solarNoon instanceof Date && !isNaN(times.solarNoon.getTime()) ? times.solarNoon.toISOString() : null,
      golden_hour_morning_start: times.nauticalDawn instanceof Date && !isNaN(times.nauticalDawn.getTime()) ? times.nauticalDawn.toISOString() : null,
      golden_hour_morning_end: times.goldenHourEnd instanceof Date && !isNaN(times.goldenHourEnd.getTime()) ? times.goldenHourEnd.toISOString() : null,
      golden_hour_evening_start: times.goldenHour instanceof Date && !isNaN(times.goldenHour.getTime()) ? times.goldenHour.toISOString() : null,
      golden_hour_evening_end: times.sunsetStart instanceof Date && !isNaN(times.sunsetStart.getTime()) ? times.sunsetStart.toISOString() : null,
      location: { id: location.id, name: location.name, lat, lng },
      date: date.toISOString().split('T')[0],
    },
    error: null,
  })
})

export default router
