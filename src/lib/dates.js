// Fechas siempre en hora local y formato 'YYYY-MM-DD' (igual que el tipo `date` de Postgres).

const pad = (n) => String(n).padStart(2, '0')

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const parseISO = (s) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export const today = () => toISO(new Date())

// Primer día del mes, en ISO: '2026-09-01'
export const monthOf = (iso) => `${iso.slice(0, 7)}-01`

export const addMonths = (monthIso, n) => {
  const d = parseISO(monthIso)
  return toISO(new Date(d.getFullYear(), d.getMonth() + n, 1))
}

export const daysBetween = (fromIso, toIso) =>
  Math.round((parseISO(toIso) - parseISO(fromIso)) / 86400000)

const fmt = (opts) => new Intl.DateTimeFormat('es-ES', opts)
const fShort = fmt({ day: 'numeric', month: 'short' })
const fLong = fmt({ weekday: 'long', day: 'numeric', month: 'long' })
const fMonth = fmt({ month: 'long', year: 'numeric' })
const fWeekday = fmt({ weekday: 'short' })

export const shortDate = (iso) => fShort.format(parseISO(iso))
export const longDate = (iso) => fLong.format(parseISO(iso))
export const monthName = (iso) => {
  const s = fMonth.format(parseISO(iso))
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export const weekday = (iso) => fWeekday.format(parseISO(iso))

// "hoy", "mañana", "en 3 días", "hace 2 días"
export const relative = (iso) => {
  const n = daysBetween(today(), iso)
  if (n === 0) return 'hoy'
  if (n === 1) return 'mañana'
  if (n === -1) return 'ayer'
  return n > 0 ? `en ${n} días` : `hace ${-n} días`
}

export const money = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0)

export const jornadas = (n) => {
  const v = Number(n) || 0
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')
  return `${s} ${v === 1 ? 'jornada' : 'jornadas'}`
}
