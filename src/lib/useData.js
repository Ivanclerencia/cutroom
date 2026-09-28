import { useCallback, useEffect, useState } from 'react'
import { backend, TABLES } from './backend.js'

const empty = Object.fromEntries(TABLES.map((t) => [t, []]))

// Carga todas las tablas y las mantiene al día: cuando la otra persona
// cambia algo, llega un aviso en tiempo real y se recarga esa tabla.
export function useData(userId) {
  const [data, setData] = useState(empty)
  const [loading, setLoading] = useState(true)
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
    // Por si se perdió algún aviso mientras el ordenador dormía
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [userId, refresh])

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
