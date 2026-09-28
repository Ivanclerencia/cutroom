import { useEffect, useState } from 'react'
import { today, shortDate, relative, daysBetween, weekday } from './lib/dates.js'

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

// Marca de jornada: "1" sólida (completa) o "½" clara (media)
export function WorkChip({ amount, planned }) {
  const n = Number(amount) || 0
  if (n <= 0) return null
  const whole = Math.floor(n)
  const label = `${whole || ''}${n % 1 ? '½' : ''}`
  const half = n < 1
  const kind = half ? 'Media jornada' : n === 1 ? 'Jornada completa' : `${String(n).replace('.', ',')} jornadas`
  return (
    <span className={`work-chip${half ? ' half' : ''}${planned ? ' planned' : ''}`} title={planned ? `${kind} prevista` : kind}>
      {label}
    </span>
  )
}

// Jornada prevista (pedida por el editor): la asistente la confirma cuando la hace
export function PlannedRow({ w, ctx }) {
  const { db, isAsistente, projectsById, profilesById, asistente } = ctx
  const by = profilesById[w.created_by]
  const past = w.date < today()
  const confirmDone = () => {
    db.update('workdays', w.id, { status: 'hecha' })
    ctx.notify('Jornada marcada como hecha')
  }
  const remove = () => {
    if (confirm(isAsistente ? '¿Quitar esta jornada prevista?' : `¿Anular la jornada pedida a ${asistente?.name ?? 'asistente'}?`)) {
      db.remove('workdays', w.id)
      ctx.notify('Jornada prevista quitada')
    }
  }
  return (
    <li className={past ? 'plan-row past' : 'plan-row'}>
      <WorkChip amount={w.amount} planned />
      <div className="plan-main">
        <strong className="capitalize">{weekday(w.date).replace('.', '')} {shortDate(w.date)} · {w.amount == 1 ? 'Completa' : 'Media'}</strong>
        <span className="plan-meta">
          <ProjectTag project={projectsById[w.project_id]} />
          {w.note && <span>{w.note}</span>}
          {by && by.id !== asistente?.id && <span>pedida por {by.name}</span>}
          {past && <span className="plan-past">{isAsistente ? '¿La hiciste?' : 'Sin confirmar'}</span>}
        </span>
      </div>
      <div className="plan-actions">
        {isAsistente && <button className="small" onClick={confirmDone}>Hecha</button>}
        <button className="icon-btn" title="Quitar" onClick={remove}>×</button>
      </div>
    </li>
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

// ---- Pastillas táctiles: al tocarlas se abre el selector nativo ----------------
const Chevron = () => (
  <svg className="pill-chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
)

// Estado con punto de color (entregas, proyectos)
export function PillSelect({ value, options, onChange, label }) {
  return (
    <label className={`pill-select tone-${value}`}>
      <i className="dot" />
      <span>{options[value]}</span>
      <Chevron />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </label>
  )
}

// Fecha: muestra "jue 1 oct" y abre el calendario del sistema
export function DatePill({ value, onChange, placeholder, done, required }) {
  let tone = ''
  if (value && !done) {
    const n = daysBetween(today(), value)
    tone = n < 0 ? ' late' : n <= 3 ? ' soon' : ''
  }
  return (
    <label className={`pill-select date-pill${value ? '' : ' empty'}${tone}`}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
      <span>{value ? `${shortDate(value)} · ${relative(value)}` : placeholder}</span>
      <input type="date" value={value ?? ''} required={required}
        onChange={(e) => onChange(e.target.value || null)} aria-label={placeholder} />
    </label>
  )
}

// Persona asignada con su avatar
export function AssigneePill({ value, profiles, onChange }) {
  const p = profiles.find((x) => x.id === value)
  return (
    <label className="pill-select person-pill">
      {p ? <Avatar profile={p} size="sm" /> : <span className="avatar-empty" />}
      <span>{p?.name ?? 'Sin asignar'}</span>
      <Chevron />
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label="Asignada a">
        <option value="">Sin asignar</option>
        {profiles.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
    </label>
  )
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
      <div className="task-main">
        <span className="task-title">{task.title}</span>
        <div className="task-meta">
          {showProject && <ProjectTag project={projectsById[task.project_id]} onClick={onProject && (() => onProject(task.project_id))} />}
          <AssigneePill value={task.assignee} profiles={ctx.data.profiles}
            onChange={(v) => db.update('tasks', task.id, { assignee: v })} />
          <DatePill value={task.due_date} done={task.done} placeholder="Sin fecha"
            onChange={(v) => db.update('tasks', task.id, { due_date: v })} />
        </div>
      </div>
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
  const [due, setDue] = useState(null)
  const [pid, setPid] = useState(projectId ?? '')
  const activeProjects = ctx.data.projects.filter((p) => p.status === 'activo')

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim() || !(projectId ?? pid)) return
    ctx.db.insert('tasks', {
      project_id: projectId ?? pid,
      title: title.trim(),
      assignee: assignee || null,
      due_date: due || null,
    })
    setTitle('')
    setDue(null)
    ctx.notify('Tarea añadida')
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-main">
        <input placeholder="Nueva tarea…" value={title} onChange={(e) => setTitle(e.target.value)} enterKeyHint="done" />
        <button type="submit" className="composer-add" disabled={!title.trim()}>Añadir</button>
      </div>
      <div className="composer-opts">
        {!projectId && (
          <label className="pill-select">
            <span>{activeProjects.find((p) => p.id === pid)?.name ?? 'Proyecto…'}</span>
            <Chevron />
            <select value={pid} onChange={(e) => setPid(e.target.value)} required aria-label="Proyecto">
              <option value="">Proyecto…</option>
              {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <AssigneePill value={assignee} profiles={ctx.data.profiles} onChange={setAssignee} />
        <DatePill value={due} onChange={setDue} placeholder="Fecha límite" />
      </div>
    </form>
  )
}

// Formulario para apuntar una jornada (completa o media)
export function WorkdayForm({ ctx, date: initialDate, onDone, plan }) {
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
    const row = { date, amount, project_id: projectId || null, note: note.trim() || null }
    // "Pedir" (editor): queda prevista a nombre de la asistente hasta que la confirme
    db.insert('workdays', plan ? { ...row, status: 'prevista', user_id: ctx.asistente?.id, created_by: ctx.me.id } : row)
    setNote('')
    ctx.notify(plan
      ? `Jornada pedida a ${ctx.asistente?.name ?? 'asistente'}`
      : amount === 1 ? 'Jornada completa apuntada' : 'Media jornada apuntada')
    onDone?.()
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
      <button type="submit">{plan ? `Pedir a ${ctx.asistente?.name ?? 'asistente'}` : 'Apuntar jornada'}</button>
      {!plan && overflow && (
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
    let current = null
    const over = (e) => {
      if (e.pointerType === 'touch') return
      const el = e.target.closest?.('[data-tip]') ?? null
      if (el === current) return // mismo elemento: no volver a pintar
      current = el
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
    const hide = () => {
      current = null
      setTip(null)
    }
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
