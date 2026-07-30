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
    list: (archived = false) => req<any[]>(`/projects${archived ? '?archived=1' : ''}`),
    get: (id: number) => req<any>(`/projects/${id}`),
    create: (data: any) => req<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/projects/${id}`, { method: 'DELETE' }),
    duplicate: (id: number) => req<any>(`/projects/${id}/duplicate`, { method: 'POST' }),
    stats: (id: number) => req<any>(`/projects/${id}/stats`),
    updateSettings: (id: number, data: any) => req<any>(`/projects/${id}/settings`, { method: 'PUT', body: JSON.stringify(data) }),
    archive: (id: number, archived: boolean) => req<any>(`/projects/${id}/archive`, { method: 'PATCH', body: JSON.stringify({ archived }) }),
  },

  // ─── Creator-Modus (YouTube / Content) ─────────────────────────────────────
  creator: {
    videos: (projectId: number) => req<any[]>(`/projects/${projectId}/creator/videos`),
    createVideo: (projectId: number, data: any) =>
      req<any>(`/projects/${projectId}/creator/videos`, { method: 'POST', body: JSON.stringify(data) }),
    video: (videoId: number) => req<any>(`/creator/videos/${videoId}`),
    updateVideo: (videoId: number, data: any) =>
      req<any>(`/creator/videos/${videoId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteVideo: (videoId: number) => req<any>(`/creator/videos/${videoId}`, { method: 'DELETE' }),
    createSection: (videoId: number, data: any) =>
      req<any>(`/creator/videos/${videoId}/sections`, { method: 'POST', body: JSON.stringify(data) }),
    updateSection: (sectionId: number, data: any) =>
      req<any>(`/creator/sections/${sectionId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSection: (sectionId: number) => req<any>(`/creator/sections/${sectionId}`, { method: 'DELETE' }),
    reorderSections: (videoId: number, sections: Array<{ id: number; sort_order: number }>) =>
      req<any>(`/creator/videos/${videoId}/sections/reorder`, { method: 'PUT', body: JSON.stringify({ sections }) }),
    scriptPdfUrl: (videoId: number) => `/api/creator/videos/${videoId}/pdf`,

    // Ideen-Backlog
    ideas: (projectId: number) => req<any[]>(`/projects/${projectId}/creator/ideas`),
    createIdea: (projectId: number, data: any) =>
      req<any>(`/projects/${projectId}/creator/ideas`, { method: 'POST', body: JSON.stringify(data) }),
    updateIdea: (ideaId: number, data: any) =>
      req<any>(`/creator/ideas/${ideaId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteIdea: (ideaId: number) => req<any>(`/creator/ideas/${ideaId}`, { method: 'DELETE' }),
    convertIdea: (ideaId: number) => req<any>(`/creator/ideas/${ideaId}/convert`, { method: 'POST' }),

    // Material und Rechte
    createAsset: (videoId: number, data: any) =>
      req<any>(`/creator/videos/${videoId}/assets`, { method: 'POST', body: JSON.stringify(data) }),
    updateAsset: (assetId: number, data: any) =>
      req<any>(`/creator/assets/${assetId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteAsset: (assetId: number) => req<any>(`/creator/assets/${assetId}`, { method: 'DELETE' }),

    // Auskopplungen
    createClip: (videoId: number, data: any) =>
      req<any>(`/creator/videos/${videoId}/clips`, { method: 'POST', body: JSON.stringify(data) }),
    updateClip: (clipId: number, data: any) =>
      req<any>(`/creator/clips/${clipId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteClip: (clipId: number) => req<any>(`/creator/clips/${clipId}`, { method: 'DELETE' }),

    // Upload-Checkliste
    addChecklistItem: (videoId: number, label: string) =>
      req<any>(`/creator/videos/${videoId}/checklist`, { method: 'POST', body: JSON.stringify({ label }) }),
    updateChecklistItem: (itemId: number, data: any) =>
      req<any>(`/creator/checklist/${itemId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteChecklistItem: (itemId: number) => req<any>(`/creator/checklist/${itemId}`, { method: 'DELETE' }),

    // Kanal-Auswertung und Kalender
    overview: (projectId: number) => req<any>(`/projects/${projectId}/creator/overview`),

    // YouTube-Anbindung
    ytStatus: (projectId: number) => req<any>(`/projects/${projectId}/creator/youtube/status`),
    ytConnect: (projectId: number) => req<any>(`/projects/${projectId}/creator/youtube/connect`),
    ytSync: (projectId: number) => req<any>(`/projects/${projectId}/creator/youtube/sync`, { method: 'POST' }),
    ytDisconnect: (projectId: number) => req<any>(`/projects/${projectId}/creator/youtube`, { method: 'DELETE' }),
    retention: (videoId: number) => req<any>(`/creator/videos/${videoId}/retention`),
    patterns: (projectId: number) => req<any>(`/projects/${projectId}/creator/patterns`),
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
    createDaysBatch: (projectId: number, dates: string[]) => req<any[]>(`/projects/${projectId}/shoot-days/batch`, { method: 'POST', body: JSON.stringify({ dates }) }),
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
    toggleDone: (id: number) => req<any>(`/shots/${id}/done`, { method: 'PATCH' }),
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
    screenplay:          (projectId: number) => `/api/projects/${projectId}/pdf/screenplay`,
    screenplayWithNotes: (projectId: number) => `/api/projects/${projectId}/pdf/screenplay?notes=1`,
  },

  // ─── Invites & Members ────────────────────────────────────────────────────
  invites: {
    list:   (projectId: number)                    => req<any[]>(`/projects/${projectId}/invites`),
    create: (projectId: number, data: { role: string; label?: string; email?: string }) =>
                                                      req<any>(`/projects/${projectId}/invites`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (projectId: number, inviteId: number)  => req<any>(`/projects/${projectId}/invites/${inviteId}`, { method: 'DELETE' }),
    getByToken: (token: string)                    => req<any>(`/invites/${token}`),
    accept: (token: string)                        => req<any>(`/invites/${token}/accept`, { method: 'POST' }),
  },
  members: {
    list:       (projectId: number)                         => req<any[]>(`/projects/${projectId}/members`),
    updateRole: (projectId: number, userId: number, role: string) =>
                                                               req<any>(`/projects/${projectId}/members/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    remove:     (projectId: number, userId: number)         => req<any>(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
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
    updateMe: (data: { name?: string }) => req<any>('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),
    changePassword: (data: { current_password: string; new_password: string }) =>
      req<any>('/auth/me/password', { method: 'PUT', body: JSON.stringify(data) }),
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

  // ─── VFX ───────────────────────────────────────────────────────────────────
  vfx: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/vfx`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/vfx`, { method: 'POST', body: JSON.stringify(data) }),
    update: (projectId: number, id: number, data: any) => req<any>(`/projects/${projectId}/vfx/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (projectId: number, id: number) => req<any>(`/projects/${projectId}/vfx/${id}`, { method: 'DELETE' }),
  },

  // ─── Post Plan ─────────────────────────────────────────────────────────────
  postplan: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/post-phases`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/post-phases`, { method: 'POST', body: JSON.stringify(data) }),
    update: (projectId: number, id: number, data: any) => req<any>(`/projects/${projectId}/post-phases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (projectId: number, id: number) => req<any>(`/projects/${projectId}/post-phases/${id}`, { method: 'DELETE' }),
  },

  // ─── Music Cues ────────────────────────────────────────────────────────────
  musicCues: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/music-cues`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/music-cues`, { method: 'POST', body: JSON.stringify(data) }),
    update: (projectId: number, id: number, data: any) => req<any>(`/projects/${projectId}/music-cues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (projectId: number, id: number) => req<any>(`/projects/${projectId}/music-cues/${id}`, { method: 'DELETE' }),
  },

  // ─── Insurances ────────────────────────────────────────────────────────────
  insurances: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/insurances`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/insurances`, { method: 'POST', body: JSON.stringify(data) }),
    update: (projectId: number, id: number, data: any) => req<any>(`/projects/${projectId}/insurances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (projectId: number, id: number) => req<any>(`/projects/${projectId}/insurances/${id}`, { method: 'DELETE' }),
  },

  // ─── Check-in (A1) ─────────────────────────────────────────────────────────
  checkin: {
    checkin: (entryId: number, checkedIn = true) =>
      req<any>(`/call-sheet-entries/${entryId}/checkin`, { method: 'POST', body: JSON.stringify({ checked_in: checkedIn }) }),
    status: (callSheetId: number) => req<any[]>(`/call-sheets/${callSheetId}/checkin-status`),
  },

  // ─── Timesheets (A2) ───────────────────────────────────────────────────────
  timesheets: {
    list: (dayId: number) => req<any[]>(`/shoot-days/${dayId}/timesheets`),
    create: (dayId: number, data: any) => req<any>(`/shoot-days/${dayId}/timesheets`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/timesheets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/timesheets/${id}`, { method: 'DELETE' }),
    exportCsv: (projectId: number) => `/api/projects/${projectId}/timesheets/export.csv`,
  },

  // ─── Catering (A4) ─────────────────────────────────────────────────────────
  catering: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/catering-preferences`),
    upsert: (projectId: number, data: any) => req<any>(`/projects/${projectId}/catering-preferences`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/catering-preferences/${id}`, { method: 'DELETE' }),
    dayList: (dayId: number) => req<any>(`/shoot-days/${dayId}/catering-list`),
  },

  // ─── Continuity (A5) ───────────────────────────────────────────────────────
  continuity: {
    list: (projectId: number, params?: { scene_id?: number; cast_id?: number; category?: string }) => {
      const qs = new URLSearchParams()
      if (params?.scene_id) qs.set('scene_id', String(params.scene_id))
      if (params?.cast_id) qs.set('cast_id', String(params.cast_id))
      if (params?.category) qs.set('category', params.category)
      return req<any[]>(`/projects/${projectId}/continuity?${qs}`)
    },
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/continuity`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/continuity/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/continuity/${id}`, { method: 'DELETE' }),
  },

  // ─── DOOD Report (B1) ──────────────────────────────────────────────────────
  dood: {
    report: (projectId: number) => req<any>(`/projects/${projectId}/dood-report`),
  },

  // ─── Sun Calculator (B5) ───────────────────────────────────────────────────
  sun: {
    get: (locationId: number, date: string) => req<any>(`/locations/${locationId}/sun?date=${date}`),
  },

  // ─── Location Release (B3) ─────────────────────────────────────────────────
  locationRelease: {
    get: (locationId: number) => req<any>(`/locations/${locationId}/release`),
    save: (locationId: number, data: any) => req<any>(`/locations/${locationId}/release`, { method: 'POST', body: JSON.stringify(data) }),
    sign: (locationId: number, data: any) => req<any>(`/locations/${locationId}/release/sign`, { method: 'PATCH', body: JSON.stringify(data) }),
    pdf: (locationId: number) => `/api/locations/${locationId}/release/pdf`,
  },

  // ─── AI Breakdown (B2) ─────────────────────────────────────────────────────
  aiBreakdown: {
    analyze: (sceneId: number) => req<any>(`/scenes/${sceneId}/ai-breakdown`, { method: 'POST' }),
  },

  // ─── AI Scheduling (B4) ────────────────────────────────────────────────────
  aiScheduling: {
    optimize: (projectId: number) => req<any>(`/projects/${projectId}/drehplan/ai-optimize`, { method: 'POST' }),
  },

  // ─── Email (C1) ────────────────────────────────────────────────────────────
  emailSend: {
    send: (projectId: number, data: any) => req<any>(`/projects/${projectId}/email/send`, { method: 'POST', body: JSON.stringify(data) }),
    status: (projectId: number) => req<any>(`/projects/${projectId}/email/status`),
    test: (projectId: number) => req<any>(`/projects/${projectId}/email/test`, { method: 'POST' }),
  },

  // ─── Push Notifications (C2) ───────────────────────────────────────────────
  push: {
    subscribe: (data: any) => req<any>('/push/subscribe', { method: 'POST', body: JSON.stringify(data) }),
    unsubscribe: (data: any) => req<any>('/push/unsubscribe', { method: 'POST', body: JSON.stringify(data) }),
    vapidKey: () => req<any>('/push/vapid-public-key'),
  },

  // ─── Confirmation (C3) ─────────────────────────────────────────────────────
  confirmation: {
    confirm: (entryId: number) => req<any>(`/call-sheet-entries/${entryId}/confirm`, { method: 'POST' }),
  },

  // ─── iCal (C4) ─────────────────────────────────────────────────────────────
  ical: {
    export: (projectId: number, from?: string, to?: string) => {
      const qs = new URLSearchParams()
      if (from) qs.set('from', from)
      if (to) qs.set('to', to)
      return `/api/projects/${projectId}/calendar/export.ics?${qs}`
    },
  },

  // ─── Camera Reports (D1) ───────────────────────────────────────────────────
  cameraReports: {
    list: (dayId: number) => req<any[]>(`/shoot-days/${dayId}/camera-reports`),
    create: (dayId: number, data: any) => req<any>(`/shoot-days/${dayId}/camera-reports`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/camera-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/camera-reports/${id}`, { method: 'DELETE' }),
    addTake: (reportId: number, data: any) => req<any>(`/camera-reports/${reportId}/takes`, { method: 'POST', body: JSON.stringify(data) }),
    updateTake: (id: number, data: any) => req<any>(`/camera-takes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTake: (id: number) => req<any>(`/camera-takes/${id}`, { method: 'DELETE' }),
  },

  // ─── Payroll (D3) ──────────────────────────────────────────────────────────
  payroll: {
    export: (projectId: number, type?: string) => `/api/projects/${projectId}/payroll/export.csv${type ? `?type=${type}` : ''}`,
  },

  // ─── Förderantrag (D5) ─────────────────────────────────────────────────────
  foerderantrag: {
    data: (projectId: number) => req<any>(`/projects/${projectId}/foerderantrag/export`),
    pdf: (projectId: number) => `/api/projects/${projectId}/foerderantrag/export?format=pdf`,
  },

  // ─── Activity Feed (E1) ────────────────────────────────────────────────────
  activity: {
    list: (projectId: number, limit = 100) => req<any[]>(`/projects/${projectId}/activity?limit=${limit}`),
  },

  // ─── Scene Comments (E2) ───────────────────────────────────────────────────
  sceneComments: {
    list: (projectId: number, sceneId: number) => req<any[]>(`/projects/${projectId}/scenes/${sceneId}/comments`),
    create: (projectId: number, sceneId: number, content: string) => req<any>(`/projects/${projectId}/scenes/${sceneId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
    resolve: (id: number) => req<any>(`/comments/${id}/resolve`, { method: 'PATCH' }),
    delete: (id: number) => req<any>(`/comments/${id}`, { method: 'DELETE' }),
  },

  // ─── Equipment Calendar (E3) ───────────────────────────────────────────────
  equipmentBookings: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/equipment-bookings`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/equipment-bookings`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/equipment-bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/equipment-bookings/${id}`, { method: 'DELETE' }),
    conflicts: (projectId: number) => req<any[]>(`/projects/${projectId}/equipment-bookings/conflicts`),
  },

  // ─── Moodboard (E4) ────────────────────────────────────────────────────────
  moodboard: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/moodboard`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/moodboard`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/moodboard/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/moodboard/${id}`, { method: 'DELETE' }),
  },

  // ─── Blackout Dates / Sperrtage (E6) ──────────────────────────────────────
  blackoutDates: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/blackout-dates`),
    listForCast: (projectId: number, castId: number) => req<any[]>(`/projects/${projectId}/cast/${castId}/blackout-dates`),
    create: (projectId: number, castId: number, data: any) => req<any>(`/projects/${projectId}/cast/${castId}/blackout-dates`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/blackout-dates/${id}`, { method: 'DELETE' }),
    conflicts: (projectId: number) => req<any[]>(`/projects/${projectId}/blackout-dates/conflicts`),
  },

  // ─── Scheduling Suggestions (E10) ─────────────────────────────────────────
  schedulingSuggestions: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/scheduling-suggestions`),
    generate: (projectId: number) => req<any[]>(`/projects/${projectId}/scheduling-suggestions/generate`, { method: 'POST' }),
    dismiss: (id: number) => req<any>(`/scheduling-suggestions/${id}/dismiss`, { method: 'PATCH' }),
  },

  // ─── Script Sides (A3) ─────────────────────────────────────────────────────
  scriptSides: {
    pdf: (dayId: number, castId?: number) => `/api/shoot-days/${dayId}/script-sides/pdf${castId ? `?cast_id=${castId}` : ''}`,
  },

  // ─── Morning Brief (E5) ────────────────────────────────────────────────────
  morningBrief: {
    data: (dayId: number) => req<any>(`/shoot-days/${dayId}/morning-brief`),
    pdf: (dayId: number) => `/api/shoot-days/${dayId}/morning-brief/pdf`,
  },

  // ─── Auth-Erweiterungen: Passwort-Reset + DSGVO ────────────────────────────
  authExtra: {
    forgotPassword: (email: string) =>
      req<{ ok: boolean; emailConfigured: boolean }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token: string, password: string) =>
      req<{ success: boolean }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
    deleteAccount: (password: string) =>
      req<{ success: boolean }>('/auth/me', { method: 'DELETE', body: JSON.stringify({ password }) }),
    exportUrl: () => '/api/auth/me/export',
  },

  // ─── Screenplay-Import/-Export ─────────────────────────────────────────────
  screenplayIO: {
    fdxImport: (projectId: number, xml: string, filename: string) =>
      req<{ scenes_created: number; blocks_created: number }>(
        `/projects/${projectId}/fdx-import`, { method: 'POST', body: JSON.stringify({ xml, filename }) }),
    fountainExportUrl: (projectId: number) => `/api/projects/${projectId}/screenplay/export.fountain`,
  },

  // ─── Dispo-Versand ─────────────────────────────────────────────────────────
  callsheetSend: {
    send: (dayId: number) =>
      req<{ sent: number; failed: string[]; skipped_no_email: string[]; smtp_configured: boolean }>(
        `/shoot-days/${dayId}/call-sheet/send`, { method: 'POST' }),
  },

  // ─── Aufgaben (Tasks mit Abnahmeschleife) ──────────────────────────────────
  tasks: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/tasks`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/tasks/${id}`, { method: 'DELETE' }),
  },

  // ─── Kostenstand (Belege / Soll-Ist) ───────────────────────────────────────
  expenses: {
    list: (projectId: number) => req<any[]>(`/projects/${projectId}/expenses`),
    create: (projectId: number, data: any) => req<any>(`/projects/${projectId}/expenses`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => req<any>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<any>(`/expenses/${id}`, { method: 'DELETE' }),
    kostenstand: (projectId: number) => req<any>(`/projects/${projectId}/kostenstand`),
  },

  // ─── Feedback ──────────────────────────────────────────────────────────────
  feedback: {
    submit: (data: { category: string; message: string; page_path: string }) =>
      req<{ id: number }>('/feedback', { method: 'POST', body: JSON.stringify(data) }),
    list: () => req<any[]>('/feedback'),
    resolve: (id: number, resolved: boolean) => req<any>(`/feedback/${id}`, { method: 'PUT', body: JSON.stringify({ resolved }) }),
  },

  // ─── Kontakt-Export ────────────────────────────────────────────────────────
  contactsExport: {
    vcfUrl: (projectId: number) => `/api/projects/${projectId}/kontakte/export.vcf`,
    csvUrl: (projectId: number) => `/api/projects/${projectId}/kontakte/export.csv`,
  },

  // ─── Public Dispo (Token-basiert, kein Auth-Header nötig) ──────────────────
  publicDispo: {
    get: (token: string) => req<any>(`/cse/t/${token}`),
    confirm: (token: string) => req<any>(`/cse/t/${token}/confirm`, { method: 'POST' }),
    claim: (token: string, data: { password: string; name?: string }) =>
      req<{ token: string; user: any; project_id: number }>(`/cse/t/${token}/claim`, { method: 'POST', body: JSON.stringify(data) }),
  },
}
