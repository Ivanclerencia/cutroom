// Backend de demostración: datos en localStorage, sesión por pestaña.
// Abre dos pestañas (una como asistente, otra como editor) y los cambios
// se reflejan entre ellas igual que con Supabase.
import { toISO, addDays } from './dates.js'

const DATA_KEY = 'estudio-demo-data'
const SESSION_KEY = 'estudio-demo-user'

const USERS = [
  { id: 'u-asistente', email: 'asistente@demo', name: 'Iván', role: 'asistente' },
  { id: 'u-editor', email: 'presti@demo', name: 'Presti', role: 'editor' },
]

function seed() {
  const t = new Date()
  const d = (n) => toISO(addDays(t, n))
  const p1 = 'p-1', p2 = 'p-2', p3 = 'p-3'
  return {
    profiles: USERS,
    projects: [
      { id: p1, name: 'Spot Navidad', client: 'Cervezas Norte', status: 'activo', color: '#e0533d', notes: 'Material en la carpeta compartida.', created_at: d(-20) },
      { id: p2, name: 'Documental Sierra', client: 'TV Local', status: 'activo', color: '#2f9e6e', notes: '', created_at: d(-15) },
      { id: p3, name: 'Videoclip Luna', client: 'Luna Band', status: 'en_pausa', color: '#8a5cf6', notes: '', created_at: d(-40) },
    ],
    deliveries: [
      { id: 'd-1', project_id: p1, title: 'Primer montaje', due_date: d(3), status: 'pendiente' },
      { id: 'd-2', project_id: p1, title: 'Versión final', due_date: d(12), status: 'pendiente' },
      { id: 'd-3', project_id: p2, title: 'Selección de brutos', due_date: d(-2), status: 'enviada' },
      { id: 'd-4', project_id: p2, title: 'Corte 1', due_date: d(9), status: 'pendiente' },
    ],
    tasks: [
      { id: 't-1', project_id: p1, title: 'Sincronizar audio', assignee: 'u-asistente', due_date: d(1), done: false, created_at: d(-5) },
      { id: 't-2', project_id: p1, title: 'Etalonaje planos exteriores', assignee: 'u-editor', due_date: d(6), done: false, created_at: d(-4) },
      { id: 't-3', project_id: p2, title: 'Organizar bins por entrevistado', assignee: 'u-asistente', due_date: null, done: true, created_at: d(-8) },
      { id: 't-4', project_id: p2, title: 'Subtítulos entrevista 2', assignee: 'u-asistente', due_date: d(4), done: false, created_at: d(-2) },
    ],
    workdays: [
      { id: 'w-1', user_id: 'u-asistente', date: d(-6), amount: 1, project_id: p2, note: 'Ingesta y sincro' },
      { id: 'w-2', user_id: 'u-asistente', date: d(-5), amount: 1, project_id: p2, note: '' },
      { id: 'w-3', user_id: 'u-asistente', date: d(-2), amount: 0.5, project_id: p1, note: 'Conformado' },
      { id: 'w-4', user_id: 'u-asistente', date: d(-1), amount: 1, project_id: p1, note: '' },
    ],
    settings: [{ id: 1, day_rate: 180 }],
    invoices: [],
  }
}

let counter = 0
const newId = () => `x-${Date.now().toString(36)}-${(counter++).toString(36)}`

export function createDemoBackend() {
  const load = () => {
    try {
      const raw = localStorage.getItem(DATA_KEY)
      // Los perfiles salen siempre de USERS, para que un cambio de nombre
      // se vea aunque haya datos de demo guardados de antes
      if (raw) return { ...JSON.parse(raw), profiles: USERS }
    } catch { /* datos corruptos: se regeneran */ }
    const s = seed()
    save(s)
    return s
  }
  const save = (db) => {
    try { localStorage.setItem(DATA_KEY, JSON.stringify(db)) } catch { /* sin almacenamiento */ }
  }

  const authListeners = new Set()
  const changeListeners = new Set()
  const currentUser = () => {
    try { return USERS.find((u) => u.id === sessionStorage.getItem(SESSION_KEY)) ?? null } catch { return null }
  }
  const emit = (table) => changeListeners.forEach((cb) => cb(table))

  // Imita las reglas de seguridad de Supabase
  const canRead = (table) => !['settings', 'invoices'].includes(table) || currentUser()?.role === 'asistente'
  const canWrite = (table) => {
    const u = currentUser()
    if (!u) return false
    if (['settings', 'invoices', 'workdays'].includes(table)) return u.role === 'asistente'
    return table !== 'profiles'
  }
  const mutate = (table, fn) => {
    if (!canWrite(table)) throw new Error('No tienes permiso para hacer esto')
    const db = load()
    db[table] = fn(db[table] ?? [])
    save(db)
    emit(table)
  }

  window.addEventListener('storage', (e) => {
    if (e.key === DATA_KEY) emit('*')
  })

  return {
    demoUsers: USERS,
    peekUser: () => currentUser(),
    async getUser() { return currentUser() },
    onAuthChange(cb) { authListeners.add(cb); return () => authListeners.delete(cb) },
    async signIn(userId) {
      sessionStorage.setItem(SESSION_KEY, userId)
      authListeners.forEach((cb) => cb(currentUser()))
    },
    async signOut() {
      sessionStorage.removeItem(SESSION_KEY)
      authListeners.forEach((cb) => cb(null))
    },
    async fetchAll(table) { return canRead(table) ? (load()[table] ?? []) : [] },
    async insert(table, row) {
      const extra = table === 'workdays' ? { user_id: currentUser().id } : {}
      mutate(table, (rows) => [...rows, { id: newId(), created_at: new Date().toISOString(), ...extra, ...row }])
    },
    async update(table, id, patch) {
      mutate(table, (rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    },
    async remove(table, id) {
      mutate(table, (rows) => rows.filter((r) => r.id !== id))
      if (table === 'projects') {
        // Igual que "on delete cascade / set null" en la base de datos real
        const db = load()
        for (const t of ['deliveries', 'tasks']) db[t] = db[t].filter((r) => r.project_id !== id)
        db.workdays = db.workdays.map((w) => (w.project_id === id ? { ...w, project_id: null } : w))
        save(db)
        emit('*')
      }
    },
    async upsert(table, row, onConflict = 'id') {
      mutate(table, (rows) => {
        const i = rows.findIndex((r) => r[onConflict] === row[onConflict])
        if (i === -1) return [...rows, { id: newId(), ...row }]
        const next = [...rows]
        next[i] = { ...next[i], ...row }
        return next
      })
    },
    subscribe(cb) { changeListeners.add(cb); return () => changeListeners.delete(cb) },
    reset() { localStorage.removeItem(DATA_KEY); emit('*') },
  }
}
