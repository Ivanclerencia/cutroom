import { useState } from 'react'
import { jornadas, today } from '../lib/dates.js'
import {
  PROJECT_STATUS, DELIVERY_STATUS, COLORS, Badge, DueLabel, TaskRow, NewTaskForm,
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

export default function Proyectos({ ctx, focusProject, setFocusProject }) {
  const { data, db } = ctx
  const [filter, setFilter] = useState('activos')
  const [creating, setCreating] = useState(false)

  const visible = data.projects
    .filter((p) => filter === 'todos' || p.status === 'activo' || p.status === 'en_pausa')
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const selected = data.projects.find((p) => p.id === focusProject) ?? visible[0]

  const create = async (e) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = form.get('name').trim()
    if (!name) return
    const color = COLORS[data.projects.length % COLORS.length]
    const ok = await db.insert('projects', { name, client: form.get('client').trim() || null, color })
    if (ok) setCreating(false)
  }

  return (
    <div className="split">
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="segmented small">
            <button className={filter === 'activos' ? 'on' : ''} onClick={() => setFilter('activos')}>En curso</button>
            <button className={filter === 'todos' ? 'on' : ''} onClick={() => setFilter('todos')}>Todos</button>
          </div>
          <button className="small" onClick={() => setCreating(true)}>+ Nuevo</button>
        </div>

        {creating && (
          <form className="new-project" onSubmit={create}>
            <input name="name" placeholder="Nombre del proyecto" autoFocus />
            <input name="client" placeholder="Cliente (opcional)" />
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
            return (
              <li key={p.id}>
                <button className={p.id === selected?.id ? 'project-item active' : 'project-item'} onClick={() => setFocusProject(p.id)}>
                  <i className="dot" style={{ background: p.color }} />
                  <span className="project-item-text">
                    <strong>{p.name}</strong>
                    <small>{p.client || '—'}{next ? ` · entrega ${next.due_date.slice(8)}/${next.due_date.slice(5, 7)}` : ''}</small>
                  </span>
                  {p.status !== 'activo' && <Badge kind={p.status}>{PROJECT_STATUS[p.status]}</Badge>}
                </button>
              </li>
            )
          })}
          {visible.length === 0 && <li className="empty">No hay proyectos todavía.</li>}
        </ul>
      </aside>

      {selected ? <ProjectDetail key={selected.id} project={selected} ctx={ctx} /> : (
        <div className="card empty-state">Crea el primer proyecto con “+ Nuevo”.</div>
      )}
    </div>
  )
}

function ProjectDetail({ project, ctx }) {
  const { data, db, asistente } = ctx
  const [showDone, setShowDone] = useState(false)
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

  const addDelivery = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    if (!f.get('title').trim() || !f.get('due_date')) return
    const ok = await db.insert('deliveries', { project_id: project.id, title: f.get('title').trim(), due_date: f.get('due_date') })
    if (ok) form.reset()
  }

  const removeProject = () => {
    if (confirm(`¿Borrar "${project.name}" con todas sus entregas y tareas? Las jornadas se conservan, sin proyecto.`)) {
      db.remove('projects', project.id)
    }
  }

  return (
    <div className="detail">
      <section className="card">
        <div className="project-head">
          <label className="color-pick" style={{ background: project.color }} title="Color">
            <select value={project.color} onChange={(e) => set({ color: e.target.value })} aria-label="Color">
              {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <Editable className="title-input" value={project.name} onSave={(v) => v && set({ name: v })} aria-label="Nombre" />
          <select value={project.status} onChange={(e) => set({ status: e.target.value })} aria-label="Estado">
            {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="project-meta">
          <label>
            Cliente
            <Editable value={project.client} onSave={(v) => set({ client: v || null })} placeholder="—" />
          </label>
          <div className="stat">
            <span>Jornadas en este proyecto</span>
            <strong>{jornadas(days)}</strong>
          </div>
        </div>
        <label>
          Notas y enlaces
          <Editable multiline rows={3} value={project.notes} onSave={(v) => set({ notes: v || null })}
            placeholder="Briefing, carpeta de material, enlaces de revisión…" />
        </label>
      </section>

      <section className="card">
        <div className="card-head"><h3>Entregas</h3></div>
        {deliveries.length > 0 && (
          <ul className="list">
            {deliveries.map((d) => (
              <li key={d.id} className="list-row delivery">
                <input type="date" className="inline-date" value={d.due_date}
                  onChange={(e) => e.target.value && db.update('deliveries', d.id, { due_date: e.target.value })} aria-label="Fecha" />
                <Editable className="inline-text" value={d.title} onSave={(v) => v && db.update('deliveries', d.id, { title: v })} aria-label="Entrega" />
                <DueLabel date={d.due_date} done={d.status !== 'pendiente'} />
                <select className={`inline-select status-${d.status}`} value={d.status}
                  onChange={(e) => db.update('deliveries', d.id, { status: e.target.value })} aria-label="Estado">
                  {Object.entries(DELIVERY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button className="icon-btn" title="Borrar entrega"
                  onClick={() => confirm(`¿Borrar la entrega "${d.title}"?`) && db.remove('deliveries', d.id)}>×</button>
              </li>
            ))}
          </ul>
        )}
        <form className="row-form" onSubmit={addDelivery}>
          <input name="title" placeholder="Nueva entrega (ej. Primer montaje, V2, Final)…" />
          <input name="due_date" type="date" aria-label="Fecha de entrega" />
          <button type="submit">Añadir</button>
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
        <ul className="tasks">
          {openTasks.map((t) => <TaskRow key={t.id} task={t} ctx={ctx} />)}
          {showDone && doneTasks.map((t) => <TaskRow key={t.id} task={t} ctx={ctx} />)}
        </ul>
        <NewTaskForm ctx={ctx} projectId={project.id} />
      </section>

      <button className="danger-link" onClick={removeProject}>Borrar proyecto</button>
    </div>
  )
}
