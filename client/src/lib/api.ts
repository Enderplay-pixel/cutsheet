const API_BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...headers, ...options?.headers },
    ...options,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Fehler beim Server-Request')
  return json.data
}

// ─── Projects ────────────────────────────────────────────────────────────────
export const api = {
  projects: {
    list: () => req<any[]>('/projects'),
    get: (id: number) => req<any>(`/projects/${id}`),
    create: (data: any) => req<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/projects/${id}`, { method: 'DELETE' }),
    duplicate: (id: number) => req<any>(`/projects/${id}/duplicate`, { method: 'POST' }),
    stats: (id: number) => req<any>(`/projects/${id}/stats`),
    updateSettings: (id: number, data: any) => req<any>(`/projects/${id}/settings`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // ─── Scenes ────────────────────────────────────────────────────────────────
  scenes: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/scenes`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/scenes`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/scenes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/scenes/${id}`, { method: 'DELETE' }),
    addCharacter: (id: number, data: any) => req<any>(`/scenes/${id}/characters`, { method: 'POST', body: JSON.stringify(data) }),
    removeCharacter: (id: number, charId: number) => req<any>(`/scenes/${id}/characters/${charId}`, { method: 'DELETE' }),
    addInventory: (id: number, data: any) => req<any>(`/scenes/${id}/inventory`, { method: 'POST', body: JSON.stringify(data) }),
    removeInventory: (id: number, itemId: number) => req<any>(`/scenes/${id}/inventory/${itemId}`, { method: 'DELETE' }),
    import: (projectId: number, text: string) => req<any[]>(`/projects/${projectId}/scenes/import`, { method: 'POST', body: JSON.stringify({ text }) }),
  },

  // ─── Characters & Cast ─────────────────────────────────────────────────────
  characters: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/characters`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/characters`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/characters/${id}`, { method: 'DELETE' }),
  },

  cast: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/cast`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/cast`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/cast/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/cast/${id}`, { method: 'DELETE' }),
  },

  // ─── Crew ──────────────────────────────────────────────────────────────────
  crew: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/crew`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/crew`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/crew/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/crew/${id}`, { method: 'DELETE' }),
  },

  // ─── Locations ─────────────────────────────────────────────────────────────
  locations: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/locations`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/locations`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/locations/${id}`, { method: 'DELETE' }),
  },

  // ─── Drehplan ──────────────────────────────────────────────────────────────
  drehplan: {
    listDays: (projectId: number) => req<any[]>(`/projects/${projectId}/shoot-days`),
    createDay: (projectId: number, data: any) => req<any>(`/projects/${projectId}/shoot-days`, { method: 'POST', body: JSON.stringify(data) }),
    updateDay: (id: number, data: any) => req<any>(`/shoot-days/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDay: (id: number) => req<any>(`/shoot-days/${id}`, { method: 'DELETE' }),
    addScene: (dayId: number, data: any) => req<any>(`/shoot-days/${dayId}/scenes`, { method: 'POST', body: JSON.stringify(data) }),
    removeScene: (dayId: number, sceneId: number) => req<any>(`/shoot-days/${dayId}/scenes/${sceneId}`, { method: 'DELETE' }),
    reorderScenes: (dayId: number, order: any[]) => req<any>(`/shoot-days/${dayId}/scenes/reorder`, { method: 'PUT', body: JSON.stringify({ order }) }),
    moveScene: (data: any) => req<any>(`/shoot-days/move-scene`, { method: 'POST', body: JSON.stringify(data) }),
    listVersions: (projectId: number) => req<any[]>(`/projects/${projectId}/drehplan/versions`),
    snapshot: (projectId: number, name?: string) => req<any>(`/projects/${projectId}/drehplan/snapshot`, { method: 'POST', body: JSON.stringify({ name }) }),
    restore: (projectId: number, versionId: number) => req<any[]>(`/projects/${projectId}/drehplan/restore/${versionId}`, { method: 'POST' }),
    deleteVersion: (versionId: number) => req<any>(`/drehplan-versions/${versionId}`, { method: 'DELETE' }),
  },

  // ─── Call Sheets ───────────────────────────────────────────────────────────
  callSheets: {
    get: (dayId: number) => req<any>(`/shoot-days/${dayId}/call-sheet`),
    createOrUpdate: (dayId: number, data: any) => req<any>(`/shoot-days/${dayId}/call-sheet`, { method: 'POST', body: JSON.stringify(data) }),
    updateEntries: (id: number, entries: any[]) => req<any>(`/call-sheets/${id}/entries`, { method: 'PUT', body: JSON.stringify({ entries }) }),
    addEntry: (id: number, data: { person_type: string; person_id: number; call_time?: number }) => req<any>(`/call-sheets/${id}/entries/add`, { method: 'POST', body: JSON.stringify(data) }),
    deleteEntry: (sheetId: number, entryId: number) => req<any>(`/call-sheets/${sheetId}/entries/${entryId}`, { method: 'DELETE' }),
    shiftTimes: (id: number, minutes: number) => req<any>(`/call-sheets/${id}/shift-times`, { method: 'POST', body: JSON.stringify({ minutes }) }),
  },

  // ─── Daily Reports ─────────────────────────────────────────────────────────
  dailyReports: {
    get: (dayId: number) => req<any>(`/shoot-days/${dayId}/daily-report`),
    createOrUpdate: (dayId: number, data: any) => req<any>(`/shoot-days/${dayId}/daily-report`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/daily-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // ─── Shots ─────────────────────────────────────────────────────────────────
  shots: {
    list: (projectId: number, params?: { sceneId?: number; shootDayId?: number }) => {
      const qs = new URLSearchParams()
      if (params?.sceneId) qs.set('sceneId', String(params.sceneId))
      if (params?.shootDayId) qs.set('shootDayId', String(params.shootDayId))
      return req<any[]>(`/projects/${projectId}/shots?${qs}`)
    },
    create: (sceneId: number, data: any) => req<any>(`/scenes/${sceneId}/shots`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/shots/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/shots/${id}`, { method: 'DELETE' }),
  },

  // ─── Budget ────────────────────────────────────────────────────────────────
  budget: {
    listVersions: (projectId: number) => req<any[]>(`/projects/${projectId}/budget-versions`),
    createVersion: (projectId: number, data: any) => req<any>(`/projects/${projectId}/budget-versions`, { method: 'POST', body: JSON.stringify(data) }),
    listLines: (versionId: number) => req<any[]>(`/budget-versions/${versionId}/lines`),
    createLine: (versionId: number, data: any) => req<any>(`/budget-versions/${versionId}/lines`, { method: 'POST', body: JSON.stringify(data) }),
    updateLine: (id: number, data: any) => req<any>(`/budget-lines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteLine: (id: number) => req<any>(`/budget-lines/${id}`, { method: 'DELETE' }),
    pullCrew: (versionId: number) => req<any>(`/budget-versions/${versionId}/pull-crew`, { method: 'POST' }),
    pullCast: (versionId: number) => req<any>(`/budget-versions/${versionId}/pull-cast`, { method: 'POST' }),
  },

  financing: {
    listVersions: (projectId: number) => req<any[]>(`/projects/${projectId}/financing-versions`),
    createVersion: (projectId: number, data: any) => req<any>(`/projects/${projectId}/financing-versions`, { method: 'POST', body: JSON.stringify(data) }),
    listEntries: (versionId: number) => req<any[]>(`/financing-versions/${versionId}/entries`),
    createEntry: (versionId: number, data: any) => req<any>(`/financing-versions/${versionId}/entries`, { method: 'POST', body: JSON.stringify(data) }),
    updateEntry: (id: number, data: any) => req<any>(`/financing-entries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEntry: (id: number) => req<any>(`/financing-entries/${id}`, { method: 'DELETE' }),
  },

  // ─── Equipment ─────────────────────────────────────────────────────────────
  equipment: {
    listLists: (projectId: number) => req<any[]>(`/projects/${projectId}/equipment-lists`),
    createList: (projectId: number, data: any) => req<any>(`/projects/${projectId}/equipment-lists`, { method: 'POST', body: JSON.stringify(data) }),
    listItems: (listId: number) => req<any[]>(`/equipment-lists/${listId}/items`),
    createItem: (listId: number, data: any) => req<any>(`/equipment-lists/${listId}/items`, { method: 'POST', body: JSON.stringify(data) }),
    updateItem: (id: number, data: any) => req<any>(`/equipment-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteItem: (id: number) => req<any>(`/equipment-items/${id}`, { method: 'DELETE' }),
  },

  // ─── Search ────────────────────────────────────────────────────────────────
  search: (projectId: number, q: string) => req<any[]>(`/projects/${projectId}/search?q=${encodeURIComponent(q)}`),

  // ─── Conflicts ─────────────────────────────────────────────────────────────
  conflicts: (projectId: number) => req<any[]>(`/projects/${projectId}/conflicts`),

  // ─── PDF Downloads ─────────────────────────────────────────────────────────
  pdf: {
    drehplan:       (projectId: number) => `/api/projects/${projectId}/pdf/drehplan`,
    tagesdispo:     (dayId: number)     => `/api/shoot-days/${dayId}/pdf/tagesdispo`,
    tagesbericht:   (dayId: number)     => `/api/shoot-days/${dayId}/pdf/tagesbericht`,
    stabliste:      (projectId: number) => `/api/projects/${projectId}/pdf/stabliste`,
    besetzung:      (projectId: number) => `/api/projects/${projectId}/pdf/besetzungsliste`,
    motivliste:     (projectId: number) => `/api/projects/${projectId}/pdf/motivliste`,
    kalkulation:    (projectId: number, versionId: number) => `/api/projects/${projectId}/pdf/kalkulation/${versionId}`,
    equipment:      (projectId: number) => `/api/projects/${projectId}/pdf/equipment`,
    shotlist:       (projectId: number) => `/api/projects/${projectId}/pdf/shotlist`,
  },

  // ─── Calendar ──────────────────────────────────────────────────────────────
  calendar: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/events`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/events`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/events/${id}`, { method: 'DELETE' }),
    holidays: (projectId: number, year: number, state?: string) => {
      const qs = new URLSearchParams({ year: String(year) })
      if (state) qs.set('state', state)
      return req<any[]>(`/projects/${projectId}/holidays?${qs}`)
    },
  },

  // ─── Budget Alerts ─────────────────────────────────────────────────────────
  budgetAlerts: {
    get: (projectId: number) => req<any>(`/projects/${projectId}/budget-alerts`),
    update: (projectId: number, data: any) => req<any>(`/projects/${projectId}/budget-alerts`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // ─── Time Analysis ─────────────────────────────────────────────────────────
  timeAnalysis: (projectId: number) => req<any[]>(`/projects/${projectId}/time-analysis`),

  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    login: (email: string, password: string) => req<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (email: string, password: string, name: string) => req<{ token: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
    me: () => req<any>('/auth/me'),
    users: () => req<any[]>('/auth/users'),
    updateRole: (id: number, role: string) => req<any>(`/auth/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    deleteUser: (id: number) => req<void>(`/auth/users/${id}`, { method: 'DELETE' }),
  },

  // ─── Sticky Notes ──────────────────────────────────────────────────────────
  stickyNotes: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/sticky-notes`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/sticky-notes`, { method: 'POST', body: JSON.stringify(data) }),
    update: (projectId: number, id: number, data: any) => req<any>(`/projects/${projectId}/sticky-notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (projectId: number, id: number) => req<void>(`/projects/${projectId}/sticky-notes/${id}`, { method: 'DELETE' }),
  },

  // ─── Vehicles ──────────────────────────────────────────────────────────────
  vehicles: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/vehicles`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/vehicles`, { method: 'POST', body: JSON.stringify(data) }),
    update: (projectId: number, id: number, data: any) => req<any>(`/projects/${projectId}/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (projectId: number, id: number) => req<void>(`/projects/${projectId}/vehicles/${id}`, { method: 'DELETE' }),
  },

  // ─── Extras / Komparsen ────────────────────────────────────────────────────
  extras: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/extras`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/extras`, { method: 'POST', body: JSON.stringify(data) }),
    update: (projectId: number, id: number, data: any) => req<any>(`/projects/${projectId}/extras/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (projectId: number, id: number) => req<void>(`/projects/${projectId}/extras/${id}`, { method: 'DELETE' }),
  },

  // ─── Camera Presets ────────────────────────────────────────────────────────
  cameraPresets: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/camera-presets`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/camera-presets`, { method: 'POST', body: JSON.stringify(data) }),
    update: (projectId: number, id: number, data: any) => req<any>(`/projects/${projectId}/camera-presets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (projectId: number, id: number) => req<void>(`/projects/${projectId}/camera-presets/${id}`, { method: 'DELETE' }),
  },

  // ─── Screenplay ────────────────────────────────────────────────────────────
  screenplay: {
    full: (projectId: number) => req<any[]>(`/projects/${projectId}/screenplay`),
    blocks: (sceneId: number) => req<any[]>(`/scenes/${sceneId}/blocks`),
    createBlock: (sceneId: number, data: any) => req<any>(`/scenes/${sceneId}/blocks`, { method: 'POST', body: JSON.stringify(data) }),
    updateBlock: (blockId: number, data: any) => req<any>(`/blocks/${blockId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBlock: (blockId: number) => req<void>(`/blocks/${blockId}`, { method: 'DELETE' }),
    reorder: (sceneId: number, blocks: any[]) => req<void>(`/scenes/${sceneId}/blocks/reorder`, { method: 'PUT', body: JSON.stringify({ blocks }) }),
    importFdx: (projectId: number, xml: string, filename: string) => req<any>(`/projects/${projectId}/fdx-import`, { method: 'POST', body: JSON.stringify({ xml, filename }) }),
  },

  // ─── Backup ────────────────────────────────────────────────────────────────
  backup: {
    export: (projectId: number) => `/api/projects/${projectId}/backup`,
    import: (data: any) => req<any>('/projects/import', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ─── Audit Log ─────────────────────────────────────────────────────────────
  audit: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/audit`),
  },
}
