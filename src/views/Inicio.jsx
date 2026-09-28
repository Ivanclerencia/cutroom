import { useState } from 'react'
import {
  today, monthOf, monthName, daysBetween, money, jornadas, weekday, shortDate, longDate, parseISO, toISO, addDays,
} from '../lib/dates.js'
import { ProjectTag, DueLabel, TaskRow, DELIVERY_STATUS, WorkdayForm, PillSelect, deliveryTip, tasksTip, dayTip, WorkChip, PlannedRow } from '../components.jsx'
import { Icon } from '../icons.jsx'

const pad = (n) => String(n).padStart(2, '0')
const num = (n) => (Number.isInteger(n) ? pad(n) : String(n).replace('.', ','))

// Días laborables (lunes a viernes) del mes
function workingDays(monthIso) {
  const d = parseISO(monthIso)
  let n = 0
  for (let day = 1; day <= new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); day++) {
    const wd = new Date(d.getFullYear(), d.getMonth(), day).getDay()
    if (wd !== 0 && wd !== 6) n++
  }
  return n
}

export default function Inicio({ ctx, go }) {
  const { data, me, isAsistente, projectsById, asistente } = ctx
  const [adding, setAdding] = useState(false)
  const t = today()
  const month = monthOf(t)

  const deliveries = data.deliveries
    .filter((d) => d.status !== 'aprobada' && daysBetween(t, d.due_date) <= 21)
    .filter((d) => projectsById[d.project_id]?.status !== 'archivado')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  const thisWeek = deliveries.filter((d) => d.status === 'pendiente' && daysBetween(t, d.due_date) <= 7)
  const next = deliveries.find((d) => d.status === 'pendiente' && d.due_date >= t)

  const myTasks = data.tasks
    .filter((x) => x.assignee === me.id && !x.done)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))

  const monthDays = data.workdays.filter((w) => monthOf(w.date) === month && w.user_id === asistente?.id)
  const total = monthDays.reduce((s, w) => s + Number(w.amount), 0)
  const rate = Number(data.settings[0]?.day_rate) || 0
  const recent = [...monthDays].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const capacity = workingDays(month)

  return (
    <div className="page">
      <header className="hero-head">
        <p className="eyebrow capitalize">{longDate(t)}</p>
        <h1 className="display">
          Hola, {me.name}
          <br />
          <span>Resumen de hoy</span>
        </h1>
      </header>

      <div className="counters">
        <div className="counter">
          <strong>{pad(thisWeek.length)}</strong>
          <span>Entregas<br />esta semana</span>
        </div>
        <div className="counter soft">
          <strong>{pad(myTasks.length)}</strong>
          <span>Tareas<br />pendientes</span>
        </div>
        <div className="counter">
          <strong>{num(total)}</strong>
          <span>Jornadas<br />en {monthName(month).split(' ')[0].toLowerCase()}</span>
        </div>
        <button className="icon-round big" onClick={() => go('calendario')} title="Calendario" aria-label="Calendario">
          <Icon name="calendar" />
        </button>
      </div>

      <div className="grid-3">
        {/* Tarjeta destacada: la próxima entrega */}
        <section className="card hero-card span-2">
          <div className="orb" style={{ '--c': projectsById[next?.project_id]?.color ?? '#ff9a5a' }} />
          {next ? (
            <>
              <div className="hero-body">
                <p className="eyebrow">Próxima entrega</p>
                <h2 className="hero-title">{next.title}</h2>
                <p className="muted">{projectsById[next.project_id]?.name}{projectsById[next.project_id]?.client ? ` · ${projectsById[next.project_id].client}` : ''}</p>
                <div className="hero-stats">
                  <div><span>Fecha</span><strong className="capitalize">{weekday(next.due_date)} {shortDate(next.due_date)}</strong></div>
                  <div><span>Faltan</span><strong>{daysBetween(t, next.due_date) === 0 ? 'Es hoy' : `${daysBetween(t, next.due_date)} días`}</strong></div>
                  <div><span>Estado</span><strong>{DELIVERY_STATUS[next.status]}</strong></div>
                </div>
              </div>
              <button className="hero-foot" onClick={() => go('proyectos', next.project_id)}>
                Abrir proyecto
                <Icon name="arrow" />
              </button>
            </>
          ) : (
            <div className="hero-body">
              <p className="eyebrow">Próxima entrega</p>
              <h2 className="hero-title">Nada pendiente</h2>
              <p className="muted">No hay entregas pendientes en las próximas semanas.</p>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>{monthName(month)}</h3>
            {isAsistente && !adding
              ? <button className="chip-btn mobile-only" onClick={() => setAdding(true)}>+ Apuntar</button>
              : null}
            <button className="link desktop-only" onClick={() => go('jornadas')}>Ver todo</button>
          </div>
          <div className="big-number">
            {num(total)}<small>/{capacity}</small>
          </div>
          <div className="meter"><i style={{ width: `${Math.min(100, (total / capacity) * 100)}%` }} /></div>
          <p className="muted small">
            {isAsistente ? `${money(total * rate)} · ${money(rate)}/jornada` : `jornadas de ${asistente?.name ?? 'asistente'} sobre ${capacity} laborables`}
          </p>
          {recent.length > 0 && (
            <ul className="mini-list">
              {recent.map((w) => (
                <li key={w.id}>
                  <span className="capitalize">{weekday(w.date)} {shortDate(w.date)}</span>
                  <span className="muted">{w.amount == 1 ? 'Completa' : 'Media'}</span>
                </li>
              ))}
            </ul>
          )}
          {isAsistente && (adding
            ? <WorkdayForm ctx={ctx} onDone={() => setAdding(false)} />
            : <button className="desktop-only" onClick={() => setAdding(true)}>Apuntar jornada</button>)}
        </section>
      </div>

      {ctx.planned.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h3>{isAsistente ? 'Tus jornadas pedidas' : `Jornadas pedidas a ${asistente?.name ?? 'asistente'}`}</h3>
            <button className="link" onClick={() => go('jornadas')}>Ver todas</button>
          </div>
          <ul className="plan-list">
            {ctx.planned.slice(0, 4).map((w) => <PlannedRow key={w.id} w={w} ctx={ctx} />)}
          </ul>
        </section>
      )}

      <WeekStrip ctx={ctx} go={go} />

      <div className="grid-2">
        <DeliveriesCard ctx={ctx} go={go} />

        <section className="card">
          <div className="card-head">
            <h3>Mis tareas</h3>
            <span className="count">{myTasks.length}</span>
          </div>
          {myTasks.length === 0 ? <p className="empty">Nada pendiente.</p> : (
            <ul className="tasks">
              {myTasks.map((task) => (
                <TaskRow key={task.id} task={task} ctx={ctx} showProject onProject={(id) => go('proyectos', id)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

// Mini calendario semanal (solo en ordenador)
function WeekStrip({ ctx, go }) {
  const { data, projectsById, asistente } = ctx
  const [offset, setOffset] = useState(0)
  const t = today()
  const now = parseISO(t)
  const monday = addDays(now, -((now.getDay() + 6) % 7) + offset * 7)
  const days = Array.from({ length: 7 }, (_, i) => toISO(addDays(monday, i)))

  const worked = (iso) => data.workdays
    .filter((w) => w.date === iso && w.user_id === asistente?.id)
    .reduce((s, w) => s + Number(w.amount), 0)
  const weekTotal = days.reduce((s, d) => s + worked(d), 0)
  const planOf = (iso) => ctx.planned.filter((w) => w.date === iso).reduce((s, w) => s + Number(w.amount), 0)
  const acceptedOn = (iso) => ctx.planned.some((w) => w.date === iso && w.status === 'aceptada')
  const range = `${shortDate(days[0])} – ${shortDate(days[6])}`

  return (
    <section className="card week">
      <div className="card-head">
        <div className="week-title">
          <h3>{offset === 0 ? 'Esta semana' : offset === 1 ? 'Semana que viene' : offset === -1 ? 'Semana pasada' : 'Semana'}</h3>
          <span className="muted small">{range} · {jornadas(weekTotal)}</span>
        </div>
        <div className="week-nav">
          {offset !== 0 && <button className="link" onClick={() => setOffset(0)}>Hoy</button>}
          <button className="icon-round sm" onClick={() => setOffset(offset - 1)} aria-label="Semana anterior">‹</button>
          <button className="icon-round sm" onClick={() => setOffset(offset + 1)} aria-label="Semana siguiente">›</button>
        </div>
      </div>
      <div className="week-grid">
        {days.map((iso) => {
          const w = worked(iso)
          const dels = data.deliveries.filter((d) => d.due_date === iso)
          const dayTasks = data.tasks.filter((x) => x.due_date === iso && !x.done)
          const tasks = dayTasks.length
          const weekend = [5, 6].includes(days.indexOf(iso))
          const cls = ['week-day', iso === t && 'today', iso < t && 'past', weekend && 'weekend', w > 0 && 'worked']
            .filter(Boolean).join(' ')
          return (
            <button key={iso} className={cls} onClick={() => go('calendario')}
              data-tip={dayTip(dels, dayTasks, projectsById)}>
              <span className="week-head">
                <span className="week-wd">{weekday(iso).replace('.', '')}</span>
                <span className="week-num">{parseISO(iso).getDate()}</span>
              </span>
              <span className="week-body">
                {dels.map((d) => (
                  <span key={d.id} className={`cal-event ${d.status}`} style={{ '--c': projectsById[d.project_id]?.color }}
                    data-tip={deliveryTip(d, projectsById[d.project_id])}>
                    {d.title}
                  </span>
                ))}
                {tasks > 0 && <span className="week-tasks" data-tip={tasksTip(dayTasks, projectsById)}>{tasks} tarea{tasks > 1 ? 's' : ''}</span>}
              </span>
              <span className="week-foot">
                {w > 0 || planOf(iso) > 0
                  ? <><WorkChip amount={w} /><WorkChip amount={planOf(iso)} planned accepted={acceptedOn(iso)} /></>
                  : <span className="week-empty">—</span>}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// Entregas de todos los proyectos, compartidas: próximas (pendientes) y entregadas
function DeliveriesCard({ ctx, go }) {
  const { data, db, projectsById } = ctx
  const [tab, setTab] = useState('proximas')
  const live = data.deliveries.filter((d) => projectsById[d.project_id]?.status !== 'archivado')
  const pending = live.filter((d) => d.status === 'pendiente').sort((a, b) => a.due_date.localeCompare(b.due_date))
  const delivered = live.filter((d) => d.status !== 'pendiente').sort((a, b) => b.due_date.localeCompare(a.due_date)).slice(0, 10)
  const rows = tab === 'proximas' ? pending : delivered

  return (
    <section className="card">
      <div className="card-head">
        <h3>Entregas</h3>
        <div className="segmented small">
          <button className={tab === 'proximas' ? 'on' : ''} onClick={() => setTab('proximas')}>Próximas {pending.length > 0 && `· ${pending.length}`}</button>
          <button className={tab === 'hechas' ? 'on' : ''} onClick={() => setTab('hechas')}>Entregadas</button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="empty">{tab === 'proximas' ? 'No hay entregas pendientes.' : 'Aún no hay entregas hechas.'}</p>
      ) : (
        <ul className="list">
          {rows.map((d) => (
            <li key={d.id} className="list-row">
              <div className="list-main">
                <strong>{d.title}</strong>
                <DueLabel date={d.due_date} done={d.status !== 'pendiente'} />
              </div>
              <ProjectTag project={projectsById[d.project_id]} onClick={() => go('proyectos', d.project_id)} />
              <PillSelect value={d.status} options={DELIVERY_STATUS} label="Estado de la entrega"
                onChange={(v) => {
                  db.update('deliveries', d.id, { status: v })
                  ctx.notify(`“${d.title}”: ${DELIVERY_STATUS[v].toLowerCase()}`)
                }} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
