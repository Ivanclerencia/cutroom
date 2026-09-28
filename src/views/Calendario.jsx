import { useState } from 'react'
import { today, monthOf, addMonths, parseISO, toISO, addDays, monthName, longDate, jornadas } from '../lib/dates.js'
import { ProjectTag, Badge, DELIVERY_STATUS, WorkdayForm, deliveryTip, tasksTip, dayTip } from '../components.jsx'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export default function Calendario({ ctx, go }) {
  const { data, db, projectsById, isAsistente, asistente } = ctx
  const [month, setMonth] = useState(monthOf(today()))
  const [selected, setSelected] = useState(today())

  // Rejilla de semanas completas, empezando en lunes
  const first = parseISO(month)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  const end = addDays(last, 6 - ((last.getDay() + 6) % 7))
  const cells = []
  for (let d = start; d <= end; d = addDays(d, 1)) cells.push(toISO(d))

  const byDate = (rows, field) => rows.reduce((acc, r) => {
    if (r[field]) (acc[r[field]] ??= []).push(r)
    return acc
  }, {})
  const deliveries = byDate(data.deliveries, 'due_date')
  const tasks = byDate(data.tasks.filter((t) => !t.done), 'due_date')
  const workdays = byDate(data.workdays.filter((w) => w.user_id === asistente?.id), 'date')

  const monthTotal = data.workdays
    .filter((w) => w.user_id === asistente?.id && monthOf(w.date) === month)
    .reduce((s, w) => s + Number(w.amount), 0)

  const dayWork = workdays[selected] ?? []
  const dayDeliveries = deliveries[selected] ?? []
  const dayTasks = tasks[selected] ?? []

  return (
    <div className="split cal-split">
      <section className="card calendar">
        <div className="cal-head">
          <button className="ghost small" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior">‹</button>
          <h3>{monthName(month)}</h3>
          <button className="ghost small" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente">›</button>
          <button className="ghost small" onClick={() => { setMonth(monthOf(today())); setSelected(today()) }}>Hoy</button>
          <span className="muted cal-total">{jornadas(monthTotal)} este mes</span>
        </div>
        <div className="cal-grid">
          {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w}</div>)}
          {cells.map((iso) => {
            const out = monthOf(iso) !== month
            const work = (workdays[iso] ?? []).reduce((s, w) => s + Number(w.amount), 0)
            const cls = ['cal-cell', out && 'out', iso === today() && 'today', iso === selected && 'selected', work > 0 && 'worked']
              .filter(Boolean).join(' ')
            return (
              <button key={iso} className={cls} onClick={() => setSelected(iso)}
                data-tip={dayTip(deliveries[iso] ?? [], tasks[iso] ?? [], projectsById)}>
                <span className="cal-day">
                  <span className="cal-num">{parseISO(iso).getDate()}</span>
                  {work > 0 && <span className="work-chip">{work === 0.5 ? '½' : work}</span>}
                </span>
                {(deliveries[iso] ?? []).map((d) => (
                  <span key={d.id} className={`cal-event ${d.status}`} style={{ '--c': projectsById[d.project_id]?.color }}
                    data-tip={deliveryTip(d, projectsById[d.project_id])}>
                    {d.title}
                  </span>
                ))}
                {(tasks[iso]?.length ?? 0) > 0 && (
                  <span className="cal-tasks" data-tip={tasksTip(tasks[iso], projectsById)}>{tasks[iso].length} tarea{tasks[iso].length > 1 ? 's' : ''}</span>
                )}
              </button>
            )
          })}
        </div>
        <p className="legend muted">
          <span className="work-chip">1</span> jornada completa · <span className="work-chip">½</span> media jornada ·
          las barras de color son entregas
        </p>
      </section>

      <aside className="card day-panel">
        <h3 className="capitalize">{longDate(selected)}</h3>

        <h4>Entregas</h4>
        {dayDeliveries.length === 0 ? <p className="empty">Ninguna.</p> : (
          <ul className="list">
            {dayDeliveries.map((d) => (
              <li key={d.id} className="list-row">
                <strong>{d.title}</strong>
                <ProjectTag project={projectsById[d.project_id]} onClick={() => go('proyectos', d.project_id)} />
                <Badge kind={d.status}>{DELIVERY_STATUS[d.status]}</Badge>
              </li>
            ))}
          </ul>
        )}

        {dayTasks.length > 0 && (
          <>
            <h4>Tareas que vencen</h4>
            <ul className="list">
              {dayTasks.map((t) => (
                <li key={t.id} className="list-row">
                  <span>{t.title}</span>
                  <ProjectTag project={projectsById[t.project_id]} onClick={() => go('proyectos', t.project_id)} />
                </li>
              ))}
            </ul>
          </>
        )}

        <h4>Jornada{asistente && !isAsistente ? ` de ${asistente.name}` : ''}</h4>
        {dayWork.length === 0 ? <p className="empty">No trabajado.</p> : (
          <ul className="list">
            {dayWork.map((w) => (
              <li key={w.id} className="list-row">
                <strong>{w.amount == 1 ? 'Completa' : 'Media'}</strong>
                <ProjectTag project={projectsById[w.project_id]} />
                {w.note && <span className="muted">{w.note}</span>}
                {isAsistente && (
                  <button className="icon-btn" title="Borrar jornada"
                    onClick={() => confirm('¿Borrar esta jornada?') && db.remove('workdays', w.id)}>×</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {isAsistente && <WorkdayForm key={selected} ctx={ctx} date={selected} />}
      </aside>
    </div>
  )
}
