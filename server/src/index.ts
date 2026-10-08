import 'express-async-errors'
import { assertSecrets } from './config/secrets'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { initDatabase } from './db'
import { starteVersandSchleife } from './lib/mailversand'
import { raeumeMailanhaengeAuf } from './lib/mailaufbewahrung'
import { optionalAuth } from './middleware/auth'
import { projectWriteGuard, requireMember } from './middleware/projectAuth'
import { pruefeIdParameter, saeubereKoerper, uebersetzeDatenbankfehler } from './middleware/eingabe'
import { schutzkoepfe, anmeldeBremse } from './middleware/haertung'

// Route imports
import projectsRouter from './routes/projects'
import scenesRouter from './routes/scenes'
import charactersRouter from './routes/characters'
import crewRouter from './routes/crew'
import locationsRouter from './routes/locations'
import drehplanRouter from './routes/drehplan'
import callsheetsRouter from './routes/callsheets'
import dailyreportsRouter from './routes/dailyreports'
import shotsRouter from './routes/shots'
import budgetRouter from './routes/budget'
import equipmentRouter from './routes/equipment'
import searchRouter from './routes/search'
import conflictsRouter from './routes/conflicts'
import calendarRouter from './routes/calendar'
import pdfRouter from './routes/pdf'
import authRouter from './routes/auth'
import auditRouter from './routes/audit'
import stickyNotesRouter from './routes/stickyNotes'
import vehiclesRouter from './routes/vehicles'
import extrasRouter from './routes/extras'
import cameraPresetsRouter from './routes/cameraPresets'
import backupRouter from './routes/backup'
import guestTokensRouter from './routes/guestTokens'
import invitesRouter from './routes/invites'
import sseRouter from './routes/sse'
import screenplayRouter from './routes/screenplay'
import adminRouter from './routes/admin'
import vfxRouter from './routes/vfx'
import postplanRouter from './routes/postplan'
import musicCuesRouter from './routes/musicCues'
import insurancesRouter from './routes/insurances'
import activityFeedRouter from './routes/activityFeed'
import sceneCommentsRouter from './routes/sceneComments'
import equipmentCalendarRouter from './routes/equipmentCalendar'
import moodboardRouter from './routes/moodboard'
import blackoutDatesRouter from './routes/blackoutDates'
import scriptSidesRouter from './routes/scriptSides'
import aiBreakdownRouter from './routes/aiBreakdown'
import optimizationSuggestionsRouter from './routes/optimizationSuggestions'
import checkinRouter from './routes/checkin'
import timesheetsRouter from './routes/timesheets'
import cateringRouter from './routes/catering'
import continuityRouter from './routes/continuity'
import doodRouter from './routes/dood'
import sunRouter from './routes/sun'
import emailRoutesRouter from './routes/emailRoutes'
import pushRouter from './routes/push'
import confirmationRouter from './routes/confirmation'
import icalRouter from './routes/ical'
import cameraReportsRouter from './routes/cameraReports'
import payrollRouter from './routes/payroll'
import locationReleaseRouter from './routes/locationRelease'
import aiSchedulingRouter from './routes/aiScheduling'
import foerderantragRouter from './routes/foerderantrag'
import morningBriefRouter from './routes/morningBrief'
import feedbackRouter from './routes/feedback'
import tasksRouter from './routes/tasks'
import creatorRouter from './routes/creator'
import youtubeRouter from './routes/youtube'
import floorplansRouter from './routes/floorplans'
import expensesRouter from './routes/expenses'
import contactsExportRouter from './routes/contactsExport'

const app = express()
const PORT = Number(process.env.PORT) || 3001
const isProd = process.env.NODE_ENV === 'production'

// Set to true once initDatabase() succeeds - guards all API routes
let dbReady = false

// In dev allow Vite dev server; in prod same-origin (no CORS needed)
if (!isProd) {
  app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'], credentials: true }))
}
// Schutzkoepfe vor allem anderen, damit sie auch auf Fehler- und
// Dateiantworten liegen.
app.use(schutzkoepfe(isProd))

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Nullbytes raus, Zahlen ausserhalb der Spaltenreichweite abweisen -
// bevor irgendetwas davon die Datenbank erreicht.
app.use(saeubereKoerper)

// Apply optional auth globally so req.user is populated when token is present
app.use(optionalAuth)

// Project-level role enforcement (runs after optionalAuth so req.user is set)
app.use('/api', projectWriteGuard)

// Leseschutz fuer alles unter /api/projects/:projectId/
//
// Warum das hier steht und nicht in den einzelnen Routern: projectWriteGuard
// laesst GET bewusst durch. Geschuetzt waren Leserouten bisher nur dadurch,
// dass rund zwanzig ANDERE Router ein router.use('/projects/:projectId',
// requireMember) tragen und frueher eingebunden werden - Express fuehrt deren
// Middleware ueber den Pfad-Praefix mit aus. Payroll, DOOD, Continuity und
// Foerderantrag haben selbst keine Pruefung und hingen allein daran.
//
// Das hat gehalten, war aber nicht beabsichtigt: eine geaenderte
// Einbindungsreihenfolge oder eine entfernte Zeile in einem fremden Router
// haette Gagen oeffentlich gemacht. Hier steht die Regel jetzt ausdruecklich.
//
// Routen ueber eine Kind-Id (/shoot-days/7/...) deckt dieser Praefix NICHT ab.
// Die brauchen weiterhin requireMemberVia an der Route selbst.
// Erst pruefen, ob die Kennung ueberhaupt eine sein kann. Sonst landet
// "abc" als NaN in der Abfrage und Postgres antwortet statt uns.
app.use('/api/projects/:projectId', pruefeIdParameter)
app.use('/api/projects/:projectId', requireMember)

// Serve uploads
const uploadsDir = path.join(__dirname, '../uploads')
app.use('/uploads', express.static(uploadsDir))

// In production: serve the built Vite frontend
if (isProd) {
  const distPath = path.join(__dirname, '../../client/dist')
  if (fs.existsSync(distPath)) {
    // Hashed assets: long-term cache (1 year)
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }))
    // index.html: never cache (ensures fresh chunk references after deploy)
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        }
      }
    }))
  }
}

// Public health check - always responds, used by Railway
app.get('/api/health', (_req, res) => res.json({ ok: true, db: dbReady }))

// Block all other API routes until DB is initialized
app.use('/api', (req, res, next) => {
  if (dbReady) return next()
  res.status(503).json({ data: null, error: 'Server startet noch - bitte kurz warten und erneut versuchen.' })
})

// Mount routes
app.use('/api/projects', projectsRouter)
app.use('/api', scenesRouter)
app.use('/api', charactersRouter)
app.use('/api', crewRouter)
app.use('/api', locationsRouter)
app.use('/api', drehplanRouter)
app.use('/api', callsheetsRouter)
app.use('/api', dailyreportsRouter)
app.use('/api', shotsRouter)
app.use('/api', budgetRouter)
app.use('/api', equipmentRouter)
app.use('/api', searchRouter)
app.use('/api', conflictsRouter)
app.use('/api', calendarRouter)
app.use('/api', pdfRouter)
// Fuenf Fehlversuche je Adresse und E-Mail, dann fuenfzehn Minuten Pause.
// Vorher waren zehn falsche Passwoerter in vier Sekunden moeglich.
app.use('/api/auth', anmeldeBremse)
app.use('/api/auth', authRouter)
app.use('/api', auditRouter)
app.use('/api', stickyNotesRouter)
app.use('/api', vehiclesRouter)
app.use('/api', extrasRouter)
app.use('/api', cameraPresetsRouter)
app.use('/api', backupRouter)
app.use('/api', guestTokensRouter)
app.use('/api', invitesRouter)
app.use('/api', screenplayRouter)
app.use('/api/admin', adminRouter)
app.use('/api', vfxRouter)
app.use('/api', postplanRouter)
app.use('/api', musicCuesRouter)
app.use('/api', insurancesRouter)
app.use('/api', activityFeedRouter)
app.use('/api', sceneCommentsRouter)
app.use('/api', equipmentCalendarRouter)
app.use('/api', moodboardRouter)
app.use('/api', blackoutDatesRouter)
app.use('/api', scriptSidesRouter)
app.use('/api', aiBreakdownRouter)
app.use('/api', optimizationSuggestionsRouter)
app.use('/api', checkinRouter)
app.use('/api', timesheetsRouter)
app.use('/api', cateringRouter)
app.use('/api', continuityRouter)
app.use('/api', doodRouter)
app.use('/api', sunRouter)
app.use('/api', emailRoutesRouter)
app.use('/api', pushRouter)
app.use('/api', confirmationRouter)
app.use('/api', icalRouter)
app.use('/api', cameraReportsRouter)
app.use('/api', payrollRouter)
app.use('/api', locationReleaseRouter)
app.use('/api', aiSchedulingRouter)
app.use('/api', foerderantragRouter)
app.use('/api', morningBriefRouter)
app.use('/api', feedbackRouter)
app.use('/api', tasksRouter)
app.use('/api', creatorRouter)
app.use('/api', youtubeRouter)
app.use('/api', floorplansRouter)
app.use('/api', expensesRouter)
app.use('/api', contactsExportRouter)
app.use(sseRouter)

// In production: serve index.html for all non-API routes (SPA fallback)
if (isProd) {
  const distPath = path.join(__dirname, '../../client/dist')
  app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html')
    if (fs.existsSync(indexPath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.sendFile(indexPath)
    } else {
      res.status(404).send('Frontend build not found. Run `npm run build` first.')
    }
  })
}

// Letzte Instanz. Uebersetzt bekannte Datenbankfehler in klare Saetze und
// haelt die Postgres-Rohmeldung (Spaltentypen, Kodierungen) im Log statt in
// der Antwort.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.status && err.status < 500) {
    return res.status(err.status).json({ data: null, error: err.message || 'Fehler' })
  }
  return uebersetzeDatenbankfehler(err, req, res, next)
})

// Initialize DB and start server
async function main() {
  // Geheimnisse pruefen, bevor irgendetwas Tokens ausstellt
  assertSecrets()

  // Start HTTP server FIRST so /api/health responds immediately.
  // Railway marks the deploy as healthy before DB is ready - this prevents
  // the health-check timeout when PG is still booting alongside the app.
  const server = await new Promise<import('http').Server>((resolve) => {
    const s = app.listen(PORT, () => {
      console.log(`[Server] CutSheet läuft auf http://localhost:${PORT}`)
      resolve(s)
    })
  })

  if (!process.env.DATABASE_URL) {
    console.warn('[DB] WARNUNG: DATABASE_URL nicht gesetzt - bitte PostgreSQL-Addon in Railway hinzufügen')
  }

  // Retry DB init - Railway may start app before PG plugin is ready
  const MAX_RETRIES = 10
  const RETRY_DELAY_MS = 3000
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await initDatabase()
      dbReady = true
      console.log('[DB] Datenbankverbindung hergestellt')
      // Der Postausgang laeuft erst, wenn die Datenbank steht - vorher gibt es
      // nichts abzuarbeiten, und jeder Versuch waere nur ein Fehler im Log.
      starteVersandSchleife()
      raeumeMailanhaengeAuf().catch(fehler =>
        console.warn('[Mail] Anhaenge konnten nicht aufgeraeumt werden:', fehler?.message || fehler))
      return
    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        console.error(`[FATAL] Datenbankverbindung nach ${MAX_RETRIES} Versuchen fehlgeschlagen:`, err.message)
        server.close()
        process.exit(1)
      }
      console.warn(`[DB] Verbindungsversuch ${attempt}/${MAX_RETRIES} fehlgeschlagen - nächster in ${RETRY_DELAY_MS / 1000}s`)
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
    }
  }
}

// Graceful shutdown - pg pool drains connections automatically
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT',  () => process.exit(0))

main()

