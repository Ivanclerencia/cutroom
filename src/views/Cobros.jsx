import { today, monthOf, monthName, money, jornadas } from '../lib/dates.js'
import { INVOICE_STATUS } from '../components.jsx'

export default function Cobros({ ctx }) {
  const { data, db, me } = ctx
  const rate = Number(data.settings[0]?.day_rate) || 0
  const current = monthOf(today())

  const invoices = Object.fromEntries(data.invoices.map((i) => [i.month, i]))
  const daysByMonth = data.workdays
    .filter((w) => w.user_id === me.id)
    .reduce((acc, w) => {
      const m = monthOf(w.date)
      acc[m] = (acc[m] ?? 0) + Number(w.amount)
      return acc
    }, {})

  const months = [...new Set([...Object.keys(daysByMonth), ...Object.keys(invoices)])]
    .sort((a, b) => b.localeCompare(a))
    .map((m) => {
      const inv = invoices[m]
      const days = daysByMonth[m] ?? 0
      const r = inv?.status !== 'pendiente' && inv?.rate != null ? Number(inv.rate) : rate
      return { month: m, days, rate: r, amount: days * r, inv, status: inv?.status ?? 'pendiente' }
    })

  const sum = (fn) => months.filter(fn).reduce((s, m) => s + m.amount, 0)
  const year = today().slice(0, 4)
  const toInvoice = sum((m) => m.status === 'pendiente' && m.month < current)
  const awaiting = sum((m) => m.status === 'facturado')
  const paidYear = sum((m) => m.status === 'pagado' && m.month.startsWith(year))
  const inProgress = months.find((m) => m.month === current)

  const save = (m, patch) => db.upsert('invoices', { month: m.month, status: m.status, ...patch }, 'month')

  const setStatus = (m, status) => {
    const patch = { status }
    if (status === 'pendiente') patch.rate = null
    else if (m.inv?.rate == null) patch.rate = rate // congela la tarifa al facturar
    if (status !== 'pendiente' && !m.inv?.invoiced_on) patch.invoiced_on = today()
    if (status === 'pagado' && !m.inv?.paid_on) patch.paid_on = today()
    save(m, patch)
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">Cobros</h2>
        <label className="rate">
          Tarifa por jornada (€)
          <input
            type="number" min="0" step="1" key={rate} defaultValue={rate || ''}
            placeholder="0"
            onBlur={(e) => {
              const v = Number(e.target.value) || 0
              if (v !== rate) db.upsert('settings', { id: 1, day_rate: v }, 'id')
            }}
          />
        </label>
      </div>
      <p className="muted small-print">Solo tú ves esta sección. La media jornada cuenta como la mitad.</p>

      {rate === 0 && <div className="warn-box">Pon tu tarifa por jornada para calcular los importes.</div>}

      <div className="grid-4">
        <div className="card kpi">
          <span>Mes en curso</span>
          <strong>{money(inProgress?.amount)}</strong>
          <small>{jornadas(inProgress?.days)}</small>
        </div>
        <div className="card kpi">
          <span>Por facturar</span>
          <strong>{money(toInvoice)}</strong>
          <small>meses cerrados sin factura</small>
        </div>
        <div className="card kpi">
          <span>Facturado, sin cobrar</span>
          <strong>{money(awaiting)}</strong>
          <small>esperando pago</small>
        </div>
        <div className="card kpi">
          <span>Cobrado en {year}</span>
          <strong>{money(paidYear)}</strong>
        </div>
      </div>

      <section className="card">
        <h3>Por meses</h3>
        {months.length === 0 ? <p className="empty">Todavía no hay jornadas apuntadas.</p> : (
          <div className="table-wrap">
            <table className="table cobros-table">
              <thead>
                <tr>
                  <th>Mes</th><th className="right">Jornadas</th><th className="right">Tarifa</th>
                  <th className="right">Importe</th><th>Estado</th><th>Nº factura</th><th>Facturado</th><th>Pagado</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month}>
                    <td className="nowrap">
                      {monthName(m.month)}
                      {m.month === current && <span className="badge badge-soft">en curso</span>}
                    </td>
                    <td className="right" data-label="Jornadas">{String(m.days).replace('.', ',')}</td>
                    <td className="right muted" data-label="Tarifa">{money(m.rate)}</td>
                    <td className="right cobro-importe"><strong>{money(m.amount)}</strong></td>
                    <td data-label="Estado">
                      <select className={`inline-select status-${m.status}`} value={m.status} onChange={(e) => setStatus(m, e.target.value)}>
                        {Object.entries(INVOICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td data-label="Nº factura">
                      <input className="inline-text narrow" key={m.inv?.invoice_number ?? ''} defaultValue={m.inv?.invoice_number ?? ''}
                        placeholder="—"
                        onBlur={(e) => e.target.value.trim() !== (m.inv?.invoice_number ?? '') && save(m, { invoice_number: e.target.value.trim() || null })} />
                    </td>
                    <td data-label="Facturado">
                      <input type="date" className="inline-date" value={m.inv?.invoiced_on ?? ''}
                        onChange={(e) => save(m, { invoiced_on: e.target.value || null })} />
                    </td>
                    <td data-label="Pagado">
                      <input type="date" className="inline-date" value={m.inv?.paid_on ?? ''}
                        onChange={(e) => save(m, { paid_on: e.target.value || null })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
