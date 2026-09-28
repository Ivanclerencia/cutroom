import { useState } from 'react'
import { jornadas, today, parseISO, weekday, relative } from '../lib/dates.js'
import {
  PROJECT_STATUS, DELIVERY_STATUS, COLORS, Badge, TaskRow, NewTaskForm, PillSelect, DatePill,
} from '../components.jsx'

// Campo de texto que guarda al salir de él. `key` fuerza a mostrar el valor
// nuevo si la otra persona lo cambia.
function Editable({ value, onSave, multiline, ...props }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Tag
      key={value ?? ''}
      defaultValue={value ?? ''}
      onBlur={(e) => {
        const v = e.target.value.trim()
        if (v !== (value ?? '')) onSave(v)
      }}
      onKeyDown={(e) => !multiline && e.key === 'Enter' && e.currentTarget.blur()}
      {...props}
    />
  )
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

export default function Proyectos({ ctx, focusProject, setFocusProject }) {
  const { data, db } = ctx
  const [filter, setFilter] = useState('activos')
  const [creating, setCreating] = useState(false)
  // En móvil se ve la lista o la ficha (como una app nativa); en ordenador, las dos
  const [showDetail, setShowDetail] = useState(!!focusProject)

  const visible = data.projects
    .filter((p) => filter === 'todos' || p.status === 'activo' || p.status === 'en_pausa')
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const selected = data.projects.find((p) => p.id === focusProject) ?? visible[0]

  const open = (id) => {
    setFocusProject(id)
    setShowDetail(true)
    window.scrollTo({ top: 0 })
  }

  // Se crea al instante en pantalla: se cierra el formulario, se abre el proyecto
  // nuevo y sale un aviso, así no hay forma de crearlo dos veces sin querer
  const create = (e) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = form.get('name').trim()
    if (!name) return
    const id = crypto.randomUUID()
    const color = COLORS[data.projects.length % COLORS.length]
    setCreating(false)
    setFilter('activos')
    ctx.notify(`Proyecto “${name}” creado`)
    db.insert('projects', { id, name, client: form.get('client').trim() || null, color })
    open(id)
  }

  return (
    <div className={showDetail ? 'split projects show-detail' : 'split projects'}>
      <aside className="sidebar">
        <h2 className="page-title mobile-only">Proyectos</h2>
        <div className="sidebar-head">
          <div className="segmented small">
            <button className={filter === 'activos' ? 'on' : ''} onClick={() => setFilter('activos')}>En curso</button>
            <button className={filter === 'todos' ? 'on' : ''} onClick={() => setFilter('todos')}>Todos</button>
          </div>
          <button className="small" onClick={() => setCreating(true)}>+ Nuevo</button>
        </div>

        {creating && (
          <form className="new-project" onSubmit={create}>
            <input name="name" placeholder="Nombre del proyecto" autoFocus enterKeyHint="next" />
            <input name="client" placeholder="Cliente (opcional)" enterKeyHint="done" />
            <div className="row">
              <button type="submit">Crear</button>
              <button type="button" className="ghost" onClick={() => setCreating(false)}>Cancelar</button>
            </div>
          </form>
        )}

        <ul className="project-list">
          {visible.map((p) => {
            const next = data.deliveries
              .filter((d) => d.project_id === p.id && d.status === 'pendiente' && d.due_date >= today())
              .sort((a, b) => a.due_date.localeCompare(b.due_date))[0]
            const open_tasks = data.tasks.filter((t) => t.project_id === p.id && !t.done).length
            return (
              <li key={p.id}>
                <button className={p.id === selected?.id ? 'project-item active' : 'project-item'} onClick={() => open(p.id)}>
                  <i className="dot" style={{ background: p.color }} />
                  <span className="project-item-text">
                    <strong>{p.name}</strong>
                    <small>
                      {p.client || 'Sin cliente'}
                      {next ? ` · entrega ${relative(next.due_date)}` : ''}
                      {open_tasks ? ` · ${open_tasks} tarea${open_tasks > 1 ? 's' : ''}` : ''}
                    </small>
                  </span>
                  {p.status !== 'activo' && <Badge kind={p.status}>{PROJECT_STATUS[p.status]}</Badge>}
                  <svg className="chev mobile-only" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
                </button>
              </li>
            )
          })}
          {visible.length === 0 && <li className="empty">No hay proyectos todavía.</li>}
        </ul>
      </aside>

      {selected ? (
        <ProjectDetail key={selected.id} project={selected} ctx={ctx} onBack={() => setShowDetail(false)} />
      ) : (
        <div className="card empty-state">Crea el primer proyecto con “+ Nuevo”.</div>
      )}
    </div>
  )
}

function DeliveryRow({ d, db }) {
  const date = parseISO(d.due_date)
  const n = Math.round((date - parseISO(today())) / 86400000)
  const tone = d.status !== 'pendiente' ? 'done' : n < 0 ? 'late' : n <= 3 ? 'soon' : ''
  return (
    <li className={`dl ${d.status}`}>
      <label className={`dl-date ${tone}`} title="Cambiar fecha">
        <span className="dl-wd">{weekday(d.due_date).replace('.', '')}</span>
        <span className="dl-day">{date.getDate()}</span>
        <span className="dl-mon">{MONTHS[date.getMonth()]}</span>
        <input type="date" value={d.due_date} aria-label="Fecha de entrega"
          onChange={(e) => e.target.value && db.update('deliveries', d.id, { due_date: e.target.value })} />
      </label>
      <div className="dl-main">
        <Editable className="dl-title" value={d.title} onSave={(v) => v && db.update('deliveries', d.id, { title: v })} aria-label="Entrega" />
        <span className={`dl-when ${tone}`}>{d.status === 'pendiente' ? relative(d.due_date) : DELIVERY_STATUS[d.status]}</span>
      </div>
      <div className="dl-status">
        <PillSelect value={d.status} options={DELIVERY_STATUS} label="Estado de la entrega"
          onChange={(v) => db.update('deliveries', d.id, { status: v })} />
      </div>
      <button className="icon-btn dl-del" title="Borrar entrega"
        onClick={() => confirm(`¿Borrar la entrega "${d.title}"?`) && db.remove('deliveries', d.id)}>×</button>
    </li>
  )
}

function ProjectDetail({ project, ctx, onBack }) {
  const { data, db, asistente } = ctx
  const [showDone, setShowDone] = useState(false)
  const [dTitle, setDTitle] = useState('')
  const [dDate, setDDate] = useState(null)
  const set = (patch) => db.update('projects', project.id, patch)

  const deliveries = data.deliveries
    .filter((d) => d.project_id === project.id)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  const tasks = data.tasks.filter((t) => t.project_id === project.id)
  const openTasks = tasks.filter((t) => !t.done).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
  const doneTasks = tasks.filter((t) => t.done)
  const days = data.workdays
    .filter((w) => w.project_id === project.id && w.user_id === asistente?.id)
    .reduce((s, w) => s + Number(w.amount), 0)
  const plannedDays = ctx.planned.filter((w) => w.project_id === project.id).reduce((s, w) => s + Number(w.amount), 0)

  const addDelivery = (e) => {
    e.preventDefault()
    if (!dTitle.trim() || !dDate) return
    db.insert('deliveries', { project_id: project.id, title: dTitle.trim(), due_date: dDate })
    setDTitle('')
    setDDate(null)
    ctx.notify('Entrega añadida')
  }

  const removeProject = () => {
    if (confirm(`¿Borrar "${project.name}" con todas sus entregas y tareas? Las jornadas se conservan, sin proyecto.`)) {
      db.remove('projects', project.id)
      ctx.notify('Proyecto borrado')
      onBack()
    }
  }

  return (
    <div className="detail">
      <button className="back-btn mobile-only" onClick={onBack}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        Proyectos
      </button>

      <section className="card project-card">
        <div className="project-head">
          <label className="color-pick" style={{ background: project.color }} title="Color">
            <select value={project.color} onChange={(e) => set({ color: e.target.value })} aria-label="Color">
              {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <Editable className="title-input" value={project.name} onSave={(v) => v && set({ name: v })} aria-label="Nombre" />
        </div>

        <div className="facts">
          <div className="fact">
            <span>Estado</span>
            <PillSelect value={project.status} options={PROJECT_STATUS} label="Estado del proyecto"
              onChange={(v) => set({ status: v })} />
          </div>
          <div className="fact">
            <span>Jornadas</span>
            <strong>{jornadas(days)}</strong>
            {plannedDays > 0 && <small className="fact-sub">+ {String(plannedDays).replace('.', ',')} pedidas</small>}
          </div>
          <label className="fact fact-wide">
            <span>Cliente</span>
            <Editable className="fact-input" value={project.client} onSave={(v) => set({ client: v || null })} placeholder="Añadir cliente" />
          </label>
        </div>

        <label className="fact fact-notes">
          <span>Notas y enlaces</span>
          <Editable multiline rows={3} value={project.notes} onSave={(v) => set({ notes: v || null })}
            placeholder="Briefing, carpeta de material, enlaces de revisión…" />
        </label>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Entregas</h3>
          {deliveries.length > 0 && <span className="count">{deliveries.length}</span>}
        </div>
        {deliveries.length > 0 && (
          <ul className="dl-list">
            {deliveries.map((d) => <DeliveryRow key={d.id} d={d} db={db} />)}
          </ul>
        )}
        <form className="composer" onSubmit={addDelivery}>
          <div className="composer-main">
            <input placeholder="Nueva entrega (Primer montaje, V2, Final…)" value={dTitle}
              onChange={(e) => setDTitle(e.target.value)} enterKeyHint="done" />
            <button type="submit" className="composer-add" disabled={!dTitle.trim() || !dDate}>Añadir</button>
          </div>
          <div className="composer-opts">
            <DatePill value={dDate} onChange={setDDate} placeholder="Fecha de entrega" />
            {dTitle.trim() && !dDate && <span className="composer-hint">Elige la fecha para añadirla</span>}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Tareas</h3>
          {doneTasks.length > 0 && (
            <button className="link" onClick={() => setShowDone(!showDone)}>
              {showDone ? 'Ocultar hechas' : `Ver hechas (${doneTasks.length})`}
            </button>
          )}
        </div>
        {(openTasks.length > 0 || showDone) && (
          <ul className="tasks">
            {openTasks.map((t) => <TaskRow key={t.id} task={t} ctx={ctx} />)}
            {showDone && doneTasks.map((t) => <TaskRow key={t.id} task={t} ctx={ctx} />)}
          </ul>
        )}
        <NewTaskForm ctx={ctx} projectId={project.id} />
      </section>

      <button className="danger-link" onClick={removeProject}>Borrar proyecto</button>
    </div>
  )
}
