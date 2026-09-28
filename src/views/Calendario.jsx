import { useState } from 'react'
import { today, monthOf, addMonths, parseISO, toISO, addDays, monthName, longDate, shortDate, weekday, jornadas } from '../lib/dates.js'
import { ProjectTag, Badge, DELIVERY_STATUS, WorkdayForm, deliveryTip, tasksTip, dayTip, WorkChip, PlannedRow, ConfirmDay } from '../components.jsx'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export default function Calendario({ ctx, go }) {
  const { data, db, projectsById, isAsistente, asistente, planned } = ctx
  const [month, setMonth] = useState(monthOf(today()))
  const [selected, setSelected] = useState(today())
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('estudio-cal-view') || 'mes' } catch { return 'mes' }
  })
  const changeView = (v) => {
    setView(v)
    try { localStorage.setItem('estudio-cal-view', v) } catch { /* sin almacenamiento */ }
    if (v === 'mes') setMonth(monthOf(selected))
  }

  // Semana (lunes a domingo) del día seleccionado
  const sel = parseISO(selected)
  const monday = addDays(sel, -((sel.getDay() + 6) % 7))
  const weekDays = Array.from({ length: 7 }, (_, i) => toISO(addDays(monday, i)))
  const moveWeek = (n) => {
    const next = toISO(addDays(sel, n * 7))
    setSelected(next)
    setMonth(monthOf(next))
  }

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
  const workOf = (iso) => (workdays[iso] ?? []).reduce((s, w) => s + Number(w.amount), 0)
  const plannedBy = byDate(planned, 'date')
  const planOf = (iso) => (plannedBy[iso] ?? []).reduce((s, w) => s + Number(w.amount), 0)
  const weekTotal = weekDays.reduce((s, d) => s + workOf(d), 0)

  const dayWork = workdays[selected] ?? []
  const dayPlanned = plannedBy[selected] ?? []
  const dayDeliveries = deliveries[selected] ?? []
  const dayTasks = tasks[selected] ?? []

  return (
    <div className={view === 'semana' ? 'split cal-split week-mode' : 'split cal-split'}>
      <section className="card calendar">
        <div className="cal-head">
          <button className="ghost small" onClick={() => (view === 'mes' ? setMonth(addMonths(month, -1)) : moveWeek(-1))}
            aria-label={view === 'mes' ? 'Mes anterior' : 'Semana anterior'}>‹</button>
          <h3>{view === 'mes' ? monthName(month) : `${shortDate(weekDays[0])} – ${shortDate(weekDays[6])}`}</h3>
          <button className="ghost small" onClick={() => (view === 'mes' ? setMonth(addMonths(month, 1)) : moveWeek(1))}
            aria-label={view === 'mes' ? 'Mes siguiente' : 'Semana siguiente'}>›</button>
          <button className="ghost small" onClick={() => { setMonth(monthOf(today())); setSelected(today()) }}>Hoy</button>
          <span className="muted cal-total">{view === 'mes' ? `${jornadas(monthTotal)} este mes` : `${jornadas(weekTotal)} esta semana`}</span>
          <div className="segmented small cal-switch">
            <button className={view === 'semana' ? 'on' : ''} onClick={() => changeView('semana')}>Semana</button>
            <button className={view === 'mes' ? 'on' : ''} onClick={() => changeView('mes')}>Mes</button>
          </div>
        </div>
        {view === 'semana' ? (
          <div className="wk">
            {weekDays.map((iso) => {
              const work = workOf(iso)
              const dels = deliveries[iso] ?? []
              const dayT = tasks[iso] ?? []
              const cls = ['wk-day', iso === today() && 'today', iso === selected && 'selected', work > 0 && 'worked']
                .filter(Boolean).join(' ')
              return (
                <button key={iso} className={cls} onClick={() => setSelected(iso)}>
                  <span className="wk-head">
                    <span className="wk-wd">{weekday(iso).replace('.', '')}</span>
                    <span className="wk-num">{parseISO(iso).getDate()}</span>
                    <WorkChip amount={work} /><WorkChip amount={planOf(iso)} planned />
                  </span>
                  <span className="wk-items">
                    {dels.map((d) => (
                      <span key={d.id} className={`wk-item wk-delivery ${d.status}`} style={{ '--c': projectsById[d.project_id]?.color }}
                        data-tip={deliveryTip(d, projectsById[d.project_id])}>
                        <small>{projectsById[d.project_id]?.name ?? 'Sin proyecto'}</small>
                        {d.title}
                      </span>
                    ))}
                    {dayT.map((t) => (
                      <span key={t.id} className="wk-item wk-task" style={{ '--c': projectsById[t.project_id]?.color }}
                        data-tip={tasksTip([t], projectsById)}>
                        <small>{projectsById[t.project_id]?.name ?? 'Sin proyecto'}</small>
                        {t.title}
                      </span>
                    ))}
                    {dels.length + dayT.length === 0 && <span className="wk-empty">—</span>}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
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
                  <WorkChip amount={work} /><WorkChip amount={planOf(iso)} planned />
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
        )}
        <p className="legend muted">
          <WorkChip amount={1} /> jornada completa · <WorkChip amount={0.5} /> media · <WorkChip amount={1} planned /> pedida ·
          las barras de color son entregas; en la vista semanal, las tareas van con borde discontinuo
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
                <strong>{w.amount == 1 ? 'Jornada' : 'Media jornada'}</strong>
                <ConfirmDay w={w} ctx={ctx} />
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
        {dayPlanned.length > 0 && (
          <>
            <h4>Pedidas</h4>
            <ul className="plan-list">
              {dayPlanned.map((w) => <PlannedRow key={w.id} w={w} ctx={ctx} />)}
            </ul>
          </>
        )}
        {isAsistente
          ? <WorkdayForm key={selected} ctx={ctx} date={selected} />
          : asistente && (
            <div className="plan-form">
              <h4>Pedir jornada a {asistente.name}</h4>
              <WorkdayForm key={selected} ctx={ctx} date={selected} plan />
            </div>
          )}
      </aside>
    </div>
  )
}
