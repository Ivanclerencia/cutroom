import { useCallback, useEffect, useState } from 'react'
import { backend, TABLES } from './backend.js'

const empty = Object.fromEntries(TABLES.map((t) => [t, []]))

// Copia local de los últimos datos vistos: la app se pinta al instante
// al abrirla y luego se actualiza en segundo plano.
const CACHE_PREFIX = 'estudio-cache-'
const readCache = (userId) => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId)
    return raw ? { ...empty, ...JSON.parse(raw) } : null
  } catch { return null }
}
const writeCache = (userId, data) => {
  try { localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(data)) } catch { /* sin almacenamiento */ }
}
export const clearDataCache = () => {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k))
  } catch { /* sin almacenamiento */ }
}

// Valores que la base de datos pone por defecto; se aplican ya en pantalla
const DEFAULTS = {
  projects: { status: 'activo' },
  deliveries: { status: 'pendiente' },
  tasks: { done: false },
  invoices: { status: 'pendiente' },
}

// Carga todas las tablas y las mantiene al día: cuando la otra persona
// cambia algo, llega un aviso en tiempo real y se recarga esa tabla.
// Los cambios propios se ven al instante (se guardan por detrás).
export function useData(userId) {
  const [cached] = useState(() => readCache(userId))
  const [data, setData] = useState(cached ?? empty)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState(null)
  const [live, setLive] = useState('connecting') // 'live' | 'connecting' | 'offline'

  const refresh = useCallback(async (table = '*') => {
    const tables = table === '*' ? TABLES : [table]
    try {
      const rows = await Promise.all(tables.map((t) => backend.fetchAll(t)))
      setData((prev) => {
        const next = { ...prev }
        tables.forEach((t, i) => (next[t] = rows[i]))
        return next
      })
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let alive = true
    refresh().then(() => alive && setLoading(false))
    const unsubscribe = backend.subscribe(
      (table) => refresh(TABLES.includes(table) ? table : '*'),
      (status) => alive && setLive(status),
    )
    // Por si se perdió algún aviso mientras el móvil/ordenador estaba en reposo
    const onFocus = () => refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    const onOffline = () => setLive('offline')
    window.addEventListener('focus', onFocus)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      unsubscribe()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, refresh])

  useEffect(() => {
    if (userId && !loading) writeCache(userId, data)
  }, [userId, loading, data])

  // Aplica el cambio en pantalla, lo guarda y recarga la tabla (o lo deshace si falla)
  const run = useCallback(
    async (table, optimistic, save) => {
      setData((prev) => optimistic(prev))
      try {
        await save()
        refresh(table)
        return true
      } catch (e) {
        setError(e.message)
        refresh('*')
        return false
      }
    },
    [refresh],
  )

  const db = {
    insert: (table, row) => {
      const owner = table === 'workdays' ? { user_id: userId } : {}
      const full = { id: crypto.randomUUID(), ...DEFAULTS[table], ...owner, ...row }
      return run(
        table,
        (d) => ({ ...d, [table]: [...d[table], { created_at: new Date().toISOString(), ...full }] }),
        () => backend.insert(table, full),
      )
    },
    update: (table, id, patch) => run(
      table,
      (d) => ({ ...d, [table]: d[table].map((r) => (r.id === id ? { ...r, ...patch } : r)) }),
      () => backend.update(table, id, patch),
    ),
    remove: (table, id) => run(
      table === 'projects' ? '*' : table,
      (d) => {
        const next = { ...d, [table]: d[table].filter((r) => r.id !== id) }
        if (table === 'projects') {
          next.deliveries = d.deliveries.filter((r) => r.project_id !== id)
          next.tasks = d.tasks.filter((r) => r.project_id !== id)
          next.workdays = d.workdays.map((w) => (w.project_id === id ? { ...w, project_id: null } : w))
        }
        return next
      },
      () => backend.remove(table, id),
    ),
    upsert: (table, row, onConflict = 'id') => run(
      table,
      (d) => {
        const i = d[table].findIndex((r) => r[onConflict] === row[onConflict])
        const rows = [...d[table]]
        if (i === -1) rows.push({ ...DEFAULTS[table], ...row })
        else rows[i] = { ...rows[i], ...row }
        return { ...d, [table]: rows }
      },
      () => backend.upsert(table, row, onConflict),
    ),
  }

  return { data, loading, error, clearError: () => setError(null), db, live, refresh }
}
