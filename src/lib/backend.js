// Capa de datos. Con VITE_SUPABASE_URL configurado usa Supabase;
// si no, arranca en "modo demo" con datos de ejemplo guardados en el navegador.
import { createDemoBackend } from './demo.js'

export const TABLES = ['profiles', 'projects', 'deliveries', 'tasks', 'workdays', 'settings', 'invoices']

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isDemo = !url || !key

function createSupabaseBackend() {
  // La librería de Supabase es lo más pesado de la app: se descarga aparte y en
  // paralelo, así la interfaz se pinta al instante con los datos guardados.
  let clientPromise
  const client = () => (clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(url, key)))

  const check = ({ data, error }) => {
    if (!error) return data
    // Columna o tabla que aún no existe: falta ejecutar una migración en Supabase
    if (['42703', 'PGRST204', '23514'].includes(error.code) || /schema cache|does not exist|check constraint/.test(error.message)) {
      throw new Error('Falta actualizar la base de datos: ejecuta en Supabase el último archivo de supabase/migracion-*.sql')
    }
    if (error.code === '42501' || /row-level security/.test(error.message)) {
      throw new Error('No tienes permiso para hacer esto')
    }
    throw new Error(error.message)
  }

  // Errores pasajeros de la sesión: justo tras renovarla, los servidores de Supabase pueden
  // tener los relojes desfasados un segundo ("JWT issued at future"), o el pase acaba de
  // caducar. Se reintenta solo, sin molestar, antes de mostrar nada.
  const TRANSIENT = /JWT issued at future|JWT expired|jwt expired|Failed to fetch|NetworkError|Load failed/i
  const call = async (query) => {
    for (let attempt = 0; ; attempt++) {
      const sb = await client()
      let res
      try {
        res = await query(sb)
      } catch (e) {
        res = { error: { message: e.message } }
      }
      if (res.error && TRANSIENT.test(res.error.message) && attempt < 3) {
        if (/expired/i.test(res.error.message)) await sb.auth.refreshSession().catch(() => {})
        await new Promise((r) => setTimeout(r, 700 * (attempt + 1)))
        continue
      }
      return check(res)
    }
  }

  // Sesión guardada por Supabase en este dispositivo (lectura inmediata, sin red)
  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
  const peekUser = () => {
    try { return JSON.parse(localStorage.getItem(storageKey))?.user ?? null } catch { return null }
  }

  return {
    peekUser,
    async getUser() {
      const { data } = await (await client()).auth.getSession()
      return data.session?.user ?? null
    },
    onAuthChange(cb) {
      let sub
      let cancelled = false
      client().then((sb) => {
        if (cancelled) return
        sub = sb.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null)).data.subscription
      })
      return () => {
        cancelled = true
        sub?.unsubscribe()
      }
    },
    async signIn(email, password) {
      const { error } = await (await client()).auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message)
    },
    async signOut() {
      await (await client()).auth.signOut()
    },
    fetchAll: (table) => call((sb) => sb.from(table).select('*')),
    insert: (table, row) => call((sb) => sb.from(table).insert(row)),
    update: (table, id, patch) => call((sb) => sb.from(table).update(patch).eq('id', id)),
    remove: (table, id) => call((sb) => sb.from(table).delete().eq('id', id)),
    upsert: (table, row, onConflict) => call((sb) => sb.from(table).upsert(row, { onConflict })),
    subscribe(onChange, onStatus = () => {}) {
      let sb
      let channel
      let cancelled = false
      client().then((c) => {
        if (cancelled) return
        sb = c
        channel = c
          .channel('estudio')
          .on('postgres_changes', { event: '*', schema: 'public' }, (p) => onChange(p.table))
          .subscribe((status) => onStatus(status === 'SUBSCRIBED' ? 'live' : 'connecting'))
      })
      return () => {
        cancelled = true
        if (channel) sb.removeChannel(channel)
      }
    },
  }
}

export const backend = isDemo ? createDemoBackend() : createSupabaseBackend()
