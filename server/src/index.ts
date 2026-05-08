import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { initDatabase } from './db'
import { optionalAuth } from './middleware/auth'

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

const app = express()
const PORT = Number(process.env.PORT) || 3001
const isProd = process.env.NODE_ENV === 'production'

// In dev allow Vite dev server; in prod same-origin (no CORS needed)
if (!isProd) {
  app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'], credentials: true }))
}
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Apply optional auth globally so req.user is populated when token is present
app.use(optionalAuth)

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

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[ERROR]', err)
  res.status(err.status || 500).json({ data: null, error: err.message || 'Interner Serverfehler' })
})

// Initialize DB and start server
async function main() {
  try {
    await initDatabase()
    app.listen(PORT, () => {
      console.log(`[Server] CutSheet läuft auf http://localhost:${PORT}`)
    })
  } catch (err) {
    console.error('[FATAL] Server konnte nicht gestartet werden:', err)
    process.exit(1)
  }
}

main()

