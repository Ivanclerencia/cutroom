import { useState } from 'react'
import { today, monthOf, addMonths, monthName, weekday, shortDate, jornadas, money } from '../lib/dates.js'
import { ProjectTag, WorkdayForm, PlannedRow, ConfirmDay } from '../components.jsx'

export default function Jornadas({ ctx }) {
  const { data, db, projectsById, isAsistente, asistente, planned } = ctx
  const [month, setMonth] = useState(monthOf(today()))

  const rows = data.workdays
    .filter((w) => w.user_id === asistente?.id && monthOf(w.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date))
  const total = rows.reduce((s, w) => s + Number(w.amount), 0)
  const rate = Number(data.settings[0]?.day_rate) || 0

  // Reparto por proyecto
  const perProject = Object.entries(
    rows.reduce((acc, w) => ({ ...acc, [w.project_id ?? '']: (acc[w.project_id ?? ''] ?? 0) + Number(w.amount) }), {}),
  ).sort((a, b) => b[1] - a[1])

  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">
          Jornadas{!isAsistente && asistente ? ` de ${asistente.name}` : ''}
        </h2>
        <div className="month-nav">
          <button className="ghost small" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior">‹</button>
          <strong>{monthName(month)}</strong>
          <button className="ghost small" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente">›</button>
        </div>
      </div>

      {isAsistente ? (
        <section className="card">
          <h3>Apuntar jornada</h3>
          <WorkdayForm ctx={ctx} />
        </section>
      ) : asistente && (
        <section className="card">
          <h3>Pedir jornada a {asistente.name}</h3>
          <p className="muted small">{asistente.name} la aceptará y, cuando la haya trabajado, la marcará como hecha.</p>
          <WorkdayForm ctx={ctx} plan />
        </section>
      )}

      {planned.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h3>Pendientes de aceptar</h3>
            <span className="count">{planned.length}</span>
          </div>
          <ul className="plan-list">
            {planned.map((w) => <PlannedRow key={w.id} w={w} ctx={ctx} />)}
          </ul>
        </section>
      )}

      <div className="grid-3">
        <section className="card span-2">
          <div className="card-head">
            <h3>Días trabajados</h3>
            <span className="muted">{rows.length} registros</span>
          </div>
          {rows.length === 0 ? <p className="empty">No hay jornadas apuntadas en {monthName(month).toLowerCase()}.</p> : (
            <table className="table stack-mobile">
              <thead>
                <tr><th>Día</th><th>Tipo</th><th>Proyecto</th><th>Nota</th>{isAsistente && <th />}</tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.id}>
                    <td className="nowrap capitalize">{weekday(w.date)} {shortDate(w.date)}<ConfirmDay w={w} ctx={ctx} /></td>
                    <td>{w.amount == 1 ? 'Jornada' : 'Media jornada'}</td>
                    <td>
                      {isAsistente ? (
                        <select className="inline-select" value={w.project_id ?? ''}
                          onChange={(e) => db.update('workdays', w.id, { project_id: e.target.value || null })}>
                          <option value="">Sin proyecto</option>
                          {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      ) : <ProjectTag project={projectsById[w.project_id]} />}
                    </td>
                    <td className="muted">{w.note}</td>
                    {isAsistente && (
                      <td className="right">
                        <button className="icon-btn" title="Borrar"
                          onClick={() => confirm('¿Borrar esta jornada?') && db.remove('workdays', w.id)}>×</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h3>Resumen</h3>
          <div className="big-number">{jornadas(total)}</div>
          {isAsistente && <p className="muted">{money(total * rate)} con la tarifa actual</p>}
          {perProject.length > 0 && (
            <ul className="mini-list">
              {perProject.map(([pid, n]) => (
                <li key={pid}>
                  <ProjectTag project={projectsById[pid]} />
                  <span>{jornadas(n)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
