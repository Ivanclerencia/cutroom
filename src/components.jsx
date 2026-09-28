import { useEffect, useState } from 'react'
import { today, shortDate, relative, daysBetween } from './lib/dates.js'

export const PROJECT_STATUS = { activo: 'Activo', en_pausa: 'En pausa', entregado: 'Entregado', archivado: 'Archivado' }
export const DELIVERY_STATUS = { pendiente: 'Pendiente', enviada: 'Enviada', aprobada: 'Aprobada' }
export const INVOICE_STATUS = { pendiente: 'Pendiente', facturado: 'Facturado', pagado: 'Pagado' }
export const COLORS = ['#4f6bed', '#e0533d', '#2f9e6e', '#8a5cf6', '#d4912a', '#1f9bb8', '#d0467f', '#6b7280']

export function Brand({ name }) {
  return (
    <div className="brand">
      <img className="brand-mark" src={`${import.meta.env.BASE_URL}brand.png`} alt="" width="30" height="30" />
      <span className="brand-name">{name}</span>
    </div>
  )
}

export function Avatar({ profile, size }) {
  const initials = (profile?.name ?? '?').trim().slice(0, 1).toUpperCase()
  return (
    <span className={`avatar avatar-${profile?.role ?? 'editor'}${size === 'sm' ? ' sm' : ''}`} title={profile?.name}>
      {initials}
    </span>
  )
}

export function ProjectTag({ project, onClick }) {
  if (!project) return <span className="tag muted">Sin proyecto</span>
  return (
    <span className={onClick ? 'tag clickable' : 'tag'} onClick={onClick}>
      <i className="dot" style={{ background: project.color }} />
      {project.name}
    </span>
  )
}

export function Badge({ kind, children }) {
  return <span className={`badge badge-${kind}`}>{children}</span>
}

export function DueLabel({ date, done }) {
  if (!date) return null
  const n = daysBetween(today(), date)
  const cls = done ? 'due' : n < 0 ? 'due late' : n <= 3 ? 'due soon' : 'due'
  return <span className={cls} title={shortDate(date)}>{shortDate(date)} · {relative(date)}</span>
}

export function TaskRow({ task, ctx, showProject, onProject }) {
  const { db, projectsById } = ctx
  return (
    <li className={task.done ? 'task done' : 'task'}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => db.update('tasks', task.id, { done: !task.done })}
        aria-label="Hecha"
      />
      <span className="task-title">{task.title}</span>
      {showProject && <ProjectTag project={projectsById[task.project_id]} onClick={onProject && (() => onProject(task.project_id))} />}
      <select
        className="inline-select"
        value={task.assignee ?? ''}
        onChange={(e) => db.update('tasks', task.id, { assignee: e.target.value || null })}
        aria-label="Asignada a"
      >
        <option value="">Sin asignar</option>
        {ctx.data.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <DueLabel date={task.due_date} done={task.done} />
      <button
        className="icon-btn"
        title="Borrar tarea"
        onClick={() => confirm(`¿Borrar la tarea "${task.title}"?`) && db.remove('tasks', task.id)}
      >
        ×
      </button>
    </li>
  )
}

export function NewTaskForm({ ctx, projectId }) {
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState(ctx.me.id)
  const [due, setDue] = useState('')
  const [pid, setPid] = useState(projectId ?? '')
  const activeProjects = ctx.data.projects.filter((p) => p.status === 'activo')

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !(projectId ?? pid)) return
    const ok = await ctx.db.insert('tasks', {
      project_id: projectId ?? pid,
      title: title.trim(),
      assignee: assignee || null,
      due_date: due || null,
    })
    if (ok) { setTitle(''); setDue('') }
  }

  return (
    <form className="row-form" onSubmit={submit}>
      <input placeholder="Nueva tarea…" value={title} onChange={(e) => setTitle(e.target.value)} />
      {!projectId && (
        <select value={pid} onChange={(e) => setPid(e.target.value)} required>
          <option value="">Proyecto…</option>
          {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <select value={assignee ?? ''} onChange={(e) => setAssignee(e.target.value)}>
        <option value="">Sin asignar</option>
        {ctx.data.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Fecha límite" />
      <button type="submit" disabled={!title.trim()}>Añadir</button>
    </form>
  )
}

// Formulario para apuntar una jornada (completa o media)
export function WorkdayForm({ ctx, date: initialDate, onDone }) {
  const { data, db } = ctx
  const [date, setDate] = useState(initialDate ?? today())
  const [amount, setAmount] = useState(1)
  const [projectId, setProjectId] = useState('')
  const [note, setNote] = useState('')
  const activeProjects = data.projects.filter((p) => p.status === 'activo')

  const already = data.workdays
    .filter((w) => w.date === date && w.user_id === ctx.me.id)
    .reduce((s, w) => s + Number(w.amount), 0)
  const overflow = already + amount > 1

  const submit = async (e) => {
    e.preventDefault()
    const ok = await db.insert('workdays', { date, amount, project_id: projectId || null, note: note.trim() || null })
    if (ok) {
      setNote('')
      onDone?.()
    }
  }

  return (
    <form className="workday-form" onSubmit={submit}>
      <label>
        Día
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <div className="field">
        <span>Tipo</span>
        <div className="segmented">
          <button type="button" className={amount === 1 ? 'on' : ''} onClick={() => setAmount(1)}>Completa</button>
          <button type="button" className={amount === 0.5 ? 'on' : ''} onClick={() => setAmount(0.5)}>Media</button>
        </div>
      </div>
      <label>
        Proyecto
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Sin proyecto</option>
          {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="grow">
        Nota
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
      </label>
      <button type="submit">Apuntar jornada</button>
      {overflow && (
        <p className="warn">Ojo: ese día ya tienes {already === 1 ? 'una jornada completa' : 'media jornada'} apuntada.</p>
      )}
    </form>
  )
}

// ---- Etiqueta flotante al pasar el ratón (solo en dispositivos con ratón) ----
// Cualquier elemento con data-tip='[{"color","project","title"}]' la muestra.
const projectLabel = (p) => (p ? `${p.name}${p.client ? ` · ${p.client}` : ''}` : 'Sin proyecto')

export const deliveryTip = (d, project) =>
  JSON.stringify([{ color: project?.color, project: projectLabel(project), title: `Entrega: ${d.title} · ${DELIVERY_STATUS[d.status]}` }])

export const tasksTip = (tasks, projectsById) =>
  JSON.stringify(tasks.map((t) => {
    const p = projectsById[t.project_id]
    return { color: p?.color, project: projectLabel(p), title: `Tarea: ${t.title}` }
  }))

// Todo lo de un día: entregas + tareas que vencen (para la casilla completa)
export const dayTip = (deliveries, tasks, projectsById) => {
  const items = [...JSON.parse(deliveryListTip(deliveries, projectsById)), ...JSON.parse(tasksTip(tasks, projectsById))]
  return items.length ? JSON.stringify(items) : undefined
}
const deliveryListTip = (deliveries, projectsById) =>
  JSON.stringify(deliveries.map((d) => JSON.parse(deliveryTip(d, projectsById[d.project_id]))[0]))

export function HoverTip() {
  const [tip, setTip] = useState(null)

  useEffect(() => {
    // Se decide en cada movimiento (no al cargar): con dedo no se muestra
    const over = (e) => {
      if (e.pointerType === 'touch') return
      const el = e.target.closest?.('[data-tip]')
      if (!el) return setTip(null)
      const r = el.getBoundingClientRect()
      try {
        setTip({
          items: JSON.parse(el.dataset.tip),
          x: Math.min(Math.max(r.left + r.width / 2, 150), window.innerWidth - 150),
          y: r.top < 120 ? r.bottom : r.top,
          below: r.top < 120,
        })
      } catch { setTip(null) }
    }
    const hide = () => setTip(null)
    document.addEventListener('pointerover', over)
    document.documentElement.addEventListener('pointerleave', hide)
    window.addEventListener('scroll', hide, true)
    return () => {
      document.removeEventListener('pointerover', over)
      document.documentElement.removeEventListener('pointerleave', hide)
      window.removeEventListener('scroll', hide, true)
    }
  }, [])

  if (!tip) return null
  return (
    <div className={tip.below ? 'hover-tip below' : 'hover-tip'} style={{ left: tip.x, top: tip.y }} role="tooltip">
      {tip.items.map((it, i) => (
        <div key={i} className="hover-tip-row">
          <i className="dot" style={{ background: it.color ?? 'var(--faint)' }} />
          <div>
            <strong>{it.project}</strong>
            <span>{it.title}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Aviso de instalación: solo en iPhone/iPad abierto desde el navegador (no instalada)
export function InstallHint() {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('estudio-install-hint') === 'off' } catch { return false }
  })
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const installed = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
  if (!ios || installed || hidden) return null

  const close = () => {
    try { localStorage.setItem('estudio-install-hint', 'off') } catch { /* sin almacenamiento */ }
    setHidden(true)
  }
  return (
    <div className="install-hint" role="note">
      <strong>Instálala como app</strong>
      <span>
        Pulsa <b>Compartir</b> <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="icono compartir"><path d="M12 15V3.5M8 7.5l4-4 4 4M6 11H5a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 5 21h14a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 19 11h-1" /></svg>
        {' '}→ <b>Añadir a pantalla de inicio</b> con <b>Abrir como app web</b> activado, y ábrela desde el icono.
      </span>
      <button className="link" onClick={close}>Entendido</button>
    </div>
  )
}
