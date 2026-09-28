import { useEffect, useState } from 'react'
import { backend, isDemo } from './lib/backend.js'
import { useData, clearDataCache } from './lib/useData.js'
import Login from './views/Login.jsx'
import Inicio from './views/Inicio.jsx'
import Proyectos from './views/Proyectos.jsx'
import Calendario from './views/Calendario.jsx'
import Jornadas from './views/Jornadas.jsx'
import Cobros from './views/Cobros.jsx'
import { ThemeToggle } from './theme.jsx'
import { Brand, Avatar, HoverTip, InstallHint } from './components.jsx'
import { Icon } from './icons.jsx'
import { useToast, LivePill, SettingsSheet, FaceIdPrompt, useLock, LockScreen } from './chrome.jsx'

const APP_NAME = 'Splice'

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: 'home', view: Inicio },
  { id: 'proyectos', label: 'Proyectos', icon: 'folder', view: Proyectos },
  { id: 'calendario', label: 'Calendario', icon: 'calendar', view: Calendario },
  { id: 'jornadas', label: 'Jornadas', icon: 'clock', view: Jornadas },
  { id: 'cobros', label: 'Cobros', icon: 'euro', view: Cobros, onlyAsistente: true },
]

export default function App() {
  // Si hay sesión guardada en el dispositivo se entra directamente, sin esperar a la red
  const [user, setUser] = useState(() => backend.peekUser())

  useEffect(() => {
    // Confirma la sesión en segundo plano. Solo se echa al usuario si la sesión
    // ya no está guardada (sin conexión, Supabase no puede renovarla pero sigue siendo válida)
    backend.getUser().then((u) => {
      if (u || !backend.peekUser()) setUser(u)
    })
    return backend.onAuthChange((u) => {
      if (!u) clearDataCache() // al salir no queda nada guardado en el dispositivo
      setUser(u)
    })
  }, [])

  if (!user) return <Login appName={APP_NAME} />
  return <Shell user={user} />
}

function Shell({ user }) {
  const { data, loading, error, clearError, db, live, refresh } = useData(user.id)
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('estudio-tab') || 'inicio' } catch { return 'inicio' }
  })
  const [focusProject, setFocusProject] = useState(null)
  const [settings, setSettings] = useState(false)
  const [notify, toast] = useToast()
  const [locked, unlockApp] = useLock(user)

  const me = data.profiles.find((p) => p.id === user.id) ?? { id: user.id, name: user.email, role: 'editor' }
  const isAsistente = me.role === 'asistente'

  // Jornadas previstas (pedidas) aparte: todas las sumas y cobros usan solo las hechas
  const planned = data.workdays.filter((w) => w.status === 'prevista').sort((a, b) => a.date.localeCompare(b.date))
  const ctx = {
    data: { ...data, workdays: data.workdays.filter((w) => w.status !== 'prevista') },
    planned, db, me, isAsistente, notify,
    projectsById: Object.fromEntries(data.projects.map((p) => [p.id, p])),
    profilesById: Object.fromEntries(data.profiles.map((p) => [p.id, p])),
    asistente: data.profiles.find((p) => p.role === 'asistente'),
  }

  const tabs = TABS.filter((t) => !t.onlyAsistente || isAsistente)
  const current = tabs.find((t) => t.id === tab) ?? tabs[0]
  const View = current.view

  const go = (id, projectId) => {
    setTab(id)
    try { localStorage.setItem('estudio-tab', id) } catch { /* sin almacenamiento */ }
    if (projectId) setFocusProject(projectId)
  }

  const role = isAsistente ? 'Asistente' : 'Editor'
  const refreshAll = async () => {
    await refresh()
    notify('Actualizado')
  }

  return (
    <div className="app">
      {/* Ordenador: panel lateral */}
      <aside className="side">
        <Brand name={APP_NAME} />
        <p className="side-title">Espacio<br />de trabajo</p>
        <nav className="side-nav">
          {tabs.map((t) => (
            <button key={t.id} className={t.id === current.id ? 'side-item active' : 'side-item'} onClick={() => go(t.id)}>
              <Icon name={t.icon} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <LivePill status={live} onRefresh={refreshAll} />
          <button className="side-user" onClick={() => setSettings(true)} title="Ajustes">
            <Avatar profile={me} />
            <span className="me-name">{me.name}<small>{role}</small></span>
          </button>
          <div className="side-actions">
            <ThemeToggle />
            <button className="icon-round" onClick={() => confirm('¿Cerrar sesión en este dispositivo?') && backend.signOut()} title="Salir" aria-label="Salir">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Móvil: cabecera compacta */}
      <header className="mobile-top">
        <div className="mobile-left">
          <Brand name={APP_NAME} />
          <LivePill status={live} onRefresh={refreshAll} />
        </div>
        <div className="side-actions">
          <ThemeToggle />
          <button className="avatar-btn" onClick={() => setSettings(true)} aria-label="Ajustes">
            <Avatar profile={me} />
          </button>
        </div>
      </header>

      <div className="content">
        <InstallHint />
        {isDemo && (
          <div className="demo-bar">
            Modo demo: datos de ejemplo guardados solo en este navegador.
            <button className="link" onClick={() => backend.reset()}>Restablecer</button>
          </div>
        )}

        {error && (
          <div className="error-bar" role="alert">
            {error}
            <button className="link" onClick={clearError}>Cerrar</button>
          </div>
        )}

        <main className="main">
          <FaceIdPrompt me={me} user={user} notify={notify} />
          {loading ? <div className="splash">Cargando…</div> : (
            <View key={current.id} ctx={ctx} go={go} focusProject={focusProject} setFocusProject={setFocusProject} />
          )}
        </main>
      </div>

      <HoverTip />
      {toast}
      {settings && <SettingsSheet me={me} user={user} role={role} notify={notify} onClose={() => setSettings(false)} />}

      {/* Móvil: degradado para que el contenido no choque con el menú, y barra de burbujas */}
      <div className="bottom-fade" aria-hidden="true" />
      <nav className="bottom-nav">
        {tabs.map((t) => (
          <button key={t.id} className={t.id === current.id ? 'bottom-item active' : 'bottom-item'}
            onClick={() => go(t.id)} title={t.label} aria-label={t.label}>
            <Icon name={t.icon} size={23} />
          </button>
        ))}
      </nav>

      {locked && <LockScreen user={user} appName={APP_NAME} onUnlock={unlockApp} />}
    </div>
  )
}
