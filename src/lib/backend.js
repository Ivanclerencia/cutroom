// Capa de datos. Con VITE_SUPABASE_URL configurado usa Supabase;
// si no, arranca en "modo demo" con datos de ejemplo guardados en el navegador.
import { createClient } from '@supabase/supabase-js'
import { createDemoBackend } from './demo.js'

export const TABLES = ['profiles', 'projects', 'deliveries', 'tasks', 'workdays', 'settings', 'invoices']

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isDemo = !url || !key

function createSupabaseBackend() {
  const sb = createClient(url, key)

  const check = ({ data, error }) => {
    if (error) throw new Error(error.message)
    return data
  }

  return {
    async getUser() {
      const { data } = await sb.auth.getSession()
      return data.session?.user ?? null
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null))
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message)
    },
    async signOut() {
      await sb.auth.signOut()
    },
    fetchAll: async (table) => check(await sb.from(table).select('*')),
    insert: async (table, row) => check(await sb.from(table).insert(row)),
    update: async (table, id, patch) => check(await sb.from(table).update(patch).eq('id', id)),
    remove: async (table, id) => check(await sb.from(table).delete().eq('id', id)),
    upsert: async (table, row, onConflict) => check(await sb.from(table).upsert(row, { onConflict })),
    subscribe(onChange) {
      const channel = sb
        .channel('estudio')
        .on('postgres_changes', { event: '*', schema: 'public' }, (p) => onChange(p.table))
        .subscribe()
      return () => sb.removeChannel(channel)
    },
  }
}

export const backend = isDemo ? createDemoBackend() : createSupabaseBackend()
