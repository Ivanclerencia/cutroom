import { useEffect, useState } from 'react'

// Tema claro/oscuro. Por defecto sigue al sistema; si lo cambias a mano,
// se recuerda en este navegador. Todos los botones de tema se mantienen sincronizados.
const KEY = 'estudio-theme'
const EVENT = 'estudio-theme-change'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

const readPref = () => {
  try { return localStorage.getItem(KEY) || 'system' } catch { return 'system' }
}
const resolve = (pref) => (pref === 'system' ? (media().matches ? 'dark' : 'light') : pref)

export function ThemeToggle({ glass }) {
  const [theme, setTheme] = useState(() => resolve(readPref()))

  useEffect(() => {
    const apply = () => {
      const t = resolve(readPref())
      document.documentElement.dataset.theme = t
      setTheme(t)
    }
    apply()
    const mq = media()
    mq.addEventListener('change', apply)
    window.addEventListener(EVENT, apply)
    return () => {
      mq.removeEventListener('change', apply)
      window.removeEventListener(EVENT, apply)
    }
  }, [])

  const toggle = () => {
    try { localStorage.setItem(KEY, theme === 'dark' ? 'light' : 'dark') } catch { /* sin almacenamiento */ }
    window.dispatchEvent(new Event(EVENT))
  }

  const label = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
  return (
    <button className={glass ? 'glass-bubble theme-toggle' : 'icon-round theme-toggle'} onClick={toggle} title={label} aria-label={label}>
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
        </svg>
      )}
    </button>
  )
}
