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

// Carga todas las tablas y las mantiene al día: cuando la otra persona
// cambia algo, llega un aviso en tiempo real y se recarga esa tabla.
export function useData(userId) {
  const [cached] = useState(() => readCache(userId))
  const [data, setData] = useState(cached ?? empty)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState(null)

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
    const unsubscribe = backend.subscribe((table) => refresh(TABLES.includes(table) ? table : '*'))
    // Por si se perdió algún aviso mientras el móvil/ordenador estaba en reposo
    const onFocus = () => refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      unsubscribe()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, refresh])

  useEffect(() => {
    if (userId && !loading) writeCache(userId, data)
  }, [userId, loading, data])

  // Envuelve una escritura: la ejecuta, recarga la tabla y muestra el error si falla
  const run = useCallback(
    async (table, fn) => {
      try {
        await fn()
        await refresh(table)
        return true
      } catch (e) {
        setError(e.message)
        return false
      }
    },
    [refresh],
  )

  const db = {
    insert: (table, row) => run(table, () => backend.insert(table, row)),
    update: (table, id, patch) => run(table, () => backend.update(table, id, patch)),
    remove: (table, id) => run(table === 'projects' ? '*' : table, () => backend.remove(table, id)),
    upsert: (table, row, onConflict) => run(table, () => backend.upsert(table, row, onConflict)),
  }

  return { data, loading, error, clearError: () => setError(null), db }
}
