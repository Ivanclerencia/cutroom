import { useEffect, useRef, useState } from 'react'
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
import { useToast, SettingsSheet, useLock, LockScreen } from './chrome.jsx'
import { useBootSplash } from './burning.jsx'
import { weekday, shortDate, today } from './lib/dates.js'

const APP_NAME = 'Cutroom'

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

  useBootSplash()
  return (
    <>
      {user ? <Shell user={user} /> : <Login appName={APP_NAME} />}
    </>
  )
}

function Shell({ user }) {
  const { data, loading, error, clearError, db, isMine } = useData(user.id)
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
  // Jornadas pedidas (prevista → aceptada) aparte: todas las sumas y cobros usan solo las hechas
  const isPending = (w) => w.status === 'prevista' || w.status === 'aceptada'
  const planned = data.workdays.filter(isPending).sort((a, b) => a.date.localeCompare(b.date))
  const ctx = {
    data: { ...data, workdays: data.workdays.filter((w) => !isPending(w)) },
    planned, db, me, isAsistente, notify,
    projectsById: Object.fromEntries(data.projects.map((p) => [p.id, p])),
    profilesById: Object.fromEntries(data.profiles.map((p) => [p.id, p])),
    asistente: data.profiles.find((p) => p.role === 'asistente'),
  }

  // Avisos en directo: jornada pedida (a la asistente) y jornada confirmada (al editor)
  const seen = useRef(null)
  useEffect(() => {
    if (loading) return
    const plannedNow = new Map(planned.map((w) => [w.id, { ...w }]))
    const prev = seen.current
    seen.current = plannedNow
    if (!prev) return // primera carga: no avisar de lo que ya había
    const when = (w) => `${weekday(w.date).replace('.', '')} ${shortDate(w.date)}`
    for (const w of plannedNow.values()) {
      if (!prev.has(w.id) && isAsistente && w.created_by !== me.id) {
        notify(`${ctx.profilesById[w.created_by]?.name ?? 'Te'} te ha pedido una jornada: ${when(w)}`)
      }
    }
    const who = ctx.asistente?.name ?? 'La asistente'
    for (const w of prev.values()) {
      if (isAsistente) continue
      const now = plannedNow.get(w.id)
      if (now && w.status === 'prevista' && now.status === 'aceptada') notify(`${who} ha aceptado la jornada del ${when(w)}`)
      const nowDone = !now && data.workdays.some((x) => x.id === w.id && !isPending(x))
      if (nowDone) notify(`${who} ha completado la jornada del ${when(w)}`)
    }
  }, [planned, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Avisos de lo que hace el otro: entregas nuevas o entregadas, y tareas que te asigna
  const lastSeen = useRef(null)
  useEffect(() => {
    if (loading) return
    const snap = {
      deliveries: new Map(data.deliveries.map((d) => [d.id, d])),
      tasks: new Map(data.tasks.map((t) => [t.id, t])),
    }
    const prev = lastSeen.current
    lastSeen.current = snap
    if (!prev) return
    const other = data.profiles.find((p) => p.id !== me.id)?.name ?? 'Alguien'
    const proj = (id) => ctx.projectsById[id]?.name
    const msgs = []
    for (const d of snap.deliveries.values()) {
      if (isMine(d.id)) continue
      const before = prev.deliveries.get(d.id)
      if (!before) msgs.push(`${other} ha añadido la entrega “${d.title}”${proj(d.project_id) ? ` · ${proj(d.project_id)}` : ''} · ${shortDate(d.due_date)}`)
      else if (before.status !== d.status) {
        const label = { pendiente: 'pendiente', enviada: 'entregada', aprobada: 'aprobada' }[d.status]
        msgs.push(`${other} ha marcado “${d.title}” como ${label}`)
      }
    }
    for (const t of snap.tasks.values()) {
      if (isMine(t.id) || t.assignee !== me.id) continue
      const before = prev.tasks.get(t.id)
      if (!before || before.assignee !== me.id) msgs.push(`${other} te ha asignado una tarea: “${t.title}”`)
    }
    if (msgs.length === 1) notify(msgs[0])
    else if (msgs.length > 1) notify(`${msgs.length} novedades de ${other}. ${msgs[0]}`)
  }, [data.deliveries, data.tasks, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Contador: pedidas por aceptar + aceptadas cuyo día ya llegó (para marcar hechas)
  const hoy = today()
  const badges = {
    jornadas: isAsistente ? planned.filter((w) => w.status === 'prevista' || w.date <= hoy).length : 0,
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
              {badges[t.id] > 0 && <span className="nav-badge">{badges[t.id]}</span>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
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
        </div>
        <div className="side-actions">
          <ThemeToggle glass />
          <button className="glass-bubble avatar-bubble" onClick={() => setSettings(true)} aria-label="Ajustes">
            {(me.name ?? '?').trim().slice(0, 1).toUpperCase()}
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
            {badges[t.id] > 0 && <span className="nav-badge">{badges[t.id]}</span>}
          </button>
        ))}
      </nav>

      {locked && <LockScreen user={user} onUnlock={unlockApp} />}
    </div>
  )
}
