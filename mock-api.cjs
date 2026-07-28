// Temporärer Mock-API-Server für visuelles Design-Review (kein DB nötig).
// Start: node mock-api.cjs  → läuft auf :3001, Vite-Proxy zeigt darauf.
const express = require('express')
const app = express()
app.use(express.json())

const user = { id: 1, email: 'florian@ruhrcut.de', name: 'Florian Florke', role: 'admin' }

const project = {
  id: 1,
  title: 'Schattenspiel',
  format: 'Kurzfilm',
  genre: 'Drama',
  length_minutes: 24,
  status: 'Pre-Production',
  synopsis: 'Ein junger Cutter entdeckt im Archivmaterial einer Doku eine Szene, die nie gedreht wurde — und beginnt, der Sache nachzugehen.',
  my_role: 'producer',
  is_demo: false,
}

const in6days = new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10)
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString()

const stats = {
  total_scenes: 42,
  scheduled_scenes: 31,
  shot_scenes: 12,
  total_shoot_days: 10,
  completed_shoot_days: 3,
  total_cast: 8,
  total_crew: 14,
  next_shoot_day: { id: 5, day_number: 4, date: in6days },
  budget_total_cents: 4500000,
  financing_total_cents: 3200000,
}

const conflicts = [
  { id: 1, severity: 'warning', type: 'cast', message: 'Sperrtag-Konflikt: Lena M. am Drehtag 5' },
  { id: 2, severity: 'warning', type: 'equipment', message: 'Kamera B doppelt gebucht (Tag 6)' },
  { id: 3, severity: 'info', type: 'schedule', message: 'Drehtag 7 hat nur 3/8 Seiten geplant' },
]

const tasks = [
  { id: 1, title: 'Drehgenehmigung Stadtpark einholen', status: 'in_arbeit', assignee: 'Lars', due_date: in6days, department: 'Produktion', created_at: ago(3) },
  { id: 2, title: 'Catering für Tag 4 bestellen (2x vegan!)', status: 'offen', assignee: 'Mia', due_date: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), department: '', created_at: ago(2) },
  { id: 3, title: 'Moodboard mit Regie abstimmen', status: 'abnahme', assignee: 'Florian', due_date: null, department: 'Regie', created_at: ago(5) },
  { id: 4, title: 'Versicherungspolice prüfen', status: 'erledigt', assignee: '', due_date: null, department: '', created_at: ago(8), completed_at: ago(1) },
]

const kostenstand = {
  budget_version: { id: 1, name: 'Kalkulation v2' },
  rows: [
    { category: '1000 - Stab', soll_cents: 1200000, ist_cents: 850000, diff_cents: 350000 },
    { category: '2000 - Kamera', soll_cents: 900000, ist_cents: 1020000, diff_cents: -120000 },
    { category: '5000 - Darsteller', soll_cents: 600000, ist_cents: 300000, diff_cents: 300000 },
    { category: '8000 - Sonstiges', soll_cents: 400000, ist_cents: 180000, diff_cents: 220000 },
  ],
  totals: { soll_cents: 3100000, ist_cents: 2350000, diff_cents: 750000 },
}

const expenses = [
  { id: 1, description: 'Objektiv-Miete Movietech', category: '2000 - Kamera', amount_cents: 68000, receipt_no: 'R-2026-014', expense_date: ago(2).slice(0, 10) },
  { id: 2, description: 'Tankquittung Produktionsbus', category: '8000 - Sonstiges', amount_cents: 8540, receipt_no: 'R-2026-015', expense_date: ago(1).slice(0, 10) },
]

const publicDispo = {
  project: { id: 1, title: 'Schattenspiel', format: 'Kurzfilm', genre: 'Drama' },
  day: { day_number: 4, date: in6days, notes: '' },
  sheet: { general_call: 420, shooting_call: 480, weather_forecast: 'Sonnig, 21 °C', sunrise: '05:18', sunset: '21:42', notes: 'Parken in der Nebenstraße. Funkdisziplin beachten!' },
  location: { name: 'Café Morgenrot', address: 'Leopoldstraße 45', city: 'München', zip: '80802' },
  me: { name: 'Anna Schmidt', role: 'Mia', call_time: 450, notes: 'Maske um 07:30', confirmed_at: null, email: 'anna.schmidt@email.de' },
  schedule: [
    { name: 'Lars Weber', role: 'Aufnahmeleiter', call_time: 390, is_me: false },
    { name: 'Felix Wagner', role: 'Andi', call_time: 420, is_me: false },
    { name: 'Anna Schmidt', role: 'Mia', call_time: 450, is_me: true },
    { name: 'Lisa Schneider', role: 'DOP', call_time: 420, is_me: false },
  ],
  has_account: false,
}

app.post('/api/auth/login', (_req, res) => res.json({ data: { token: 'mock-token', user } }))
app.post('/api/auth/register', (_req, res) => res.json({ data: { token: 'mock-token', user } }))
app.get('/api/auth/me', (_req, res) => res.json({ data: user }))
app.post('/api/auth/forgot-password', (_req, res) => res.json({ data: { ok: true, emailConfigured: true } }))
app.post('/api/auth/reset-password', (_req, res) => res.json({ data: { success: true } }))
app.get('/api/projects', (_req, res) => res.json({ data: [
  { ...project, scene_count: 42, shoot_day_count: 10 },
  { ...project, id: 2, title: 'Sprachlos (Demo)', is_demo: true, status: 'Vorproduktion' },
] }))
app.get('/api/projects/1', (_req, res) => res.json({ data: project }))
app.get('/api/projects/2', (_req, res) => res.json({ data: { ...project, id: 2, title: 'Sprachlos (Demo)', is_demo: true } }))
app.get('/api/projects/:id/stats', (_req, res) => res.json({ data: stats }))
app.get('/api/projects/:id/conflicts', (_req, res) => res.json({ data: conflicts }))
app.get('/api/projects/:id/tasks', (_req, res) => res.json({ data: tasks }))
app.post('/api/projects/:id/tasks', (req, res) => {
  const t = { id: Date.now(), status: 'offen', created_at: new Date().toISOString(), ...req.body }
  tasks.unshift(t)
  res.status(201).json({ data: t })
})
app.put('/api/tasks/:id', (req, res) => {
  const t = tasks.find(x => String(x.id) === req.params.id)
  if (t) Object.assign(t, req.body)
  res.json({ data: t })
})
app.delete('/api/tasks/:id', (req, res) => {
  const i = tasks.findIndex(x => String(x.id) === req.params.id)
  if (i >= 0) tasks.splice(i, 1)
  res.json({ data: { ok: true } })
})
app.get('/api/projects/:id/kostenstand', (_req, res) => res.json({ data: kostenstand }))
app.get('/api/projects/:id/expenses', (_req, res) => res.json({ data: expenses }))
app.post('/api/feedback', (_req, res) => res.status(201).json({ data: { id: 1 } }))
app.get('/api/feedback', (_req, res) => res.json({ data: [
  { id: 1, user_email: 'mia@filmhochschule.de', category: 'idee', message: 'Wäre cool, wenn man die Dispo auch als WhatsApp-Link teilen könnte!', page_path: '/projects/1/tagesdispo', resolved: false, created_at: ago(1) },
  { id: 2, user_email: 'lars@ruhrcut.de', category: 'fehler', message: 'Beim Drehplan-Export fehlt Tag 7.', page_path: '/projects/1/drehplan', resolved: true, created_at: ago(3) },
] }))
app.get('/api/cse/t/:token', (_req, res) => res.json({ data: publicDispo }))
app.post('/api/cse/t/:token/confirm', (_req, res) => {
  publicDispo.me.confirmed_at = new Date().toISOString()
  res.json({ data: { confirmed: true } })
})
app.get('/api/push/vapid-public-key', (_req, res) => res.json({ data: null }))

// Alles andere: leere Liste, damit Seiten ohne Fehler rendern
app.all('/api/*', (_req, res) => res.json({ data: [] }))

app.listen(3001, () => console.log('Mock API on :3001'))
