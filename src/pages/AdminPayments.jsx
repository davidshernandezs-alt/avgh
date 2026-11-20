import { useMemo, useState } from 'react'
import { FaSackDollar, FaFileInvoice, FaTrash } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useAllFacturas, deleteInvoice } from '../data/useData'
import { formatDate } from '../components/ActivityCard'
import { localize } from '../utils/localized'
import { CURRENCY } from '../config'

const paymentLabels = {
  transfer: 'insc.payment.transfer',
  mobile: 'insc.payment.mobile',
  cash: 'insc.payment.cash',
  card: 'insc.payment.card',
  zelle: 'Zelle',
  binance: 'Binance'
}

function clientName(user) {
  const full = `${user?.nombres || ''} ${user?.apellidos || ''}`.trim()
  if (user?.tipoPersona === 'juridico') return user.nombreEmpresa || full || user?.email || user?.dni || 'Participante Excel'
  return full || user?.email || user?.dni || 'Participante Excel'
}

function monthKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key, lang) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
    month: 'long',
    year: 'numeric'
  })
}

function startOfWeekOffset(offset) {
  const d = new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day - 7 * offset)
  d.setHours(0, 0, 0, 0)
  return d
}

function FacturaBadge({ estado }) {
  const { t } = useLang()
  const cls =
    estado === 'completada' ? 'completada' : estado === 'rechazada' ? 'Rechazada' : 'pendiente'
  const key =
    estado === 'completada'
      ? 'insc.statusCompletada'
      : estado === 'rechazada'
        ? 'insc.statusRechazada'
        : 'insc.statusPendiente'
  return <span className={`badge badge-${cls}`}>{t(key)}</span>
}

export default function AdminPayments() {
  const { t, lang } = useLang()
  const { rows, loading, error } = useAllFacturas()
  const [week, setWeek] = useState('all')
  const [month, setMonth] = useState('all')

  const removeInvoice = async (uid, facturaId) => {
    if (!window.confirm('¿Eliminar esta factura definitivamente?')) return
    try {
      await deleteInvoice(uid, facturaId)
    } catch {
      alert(t('admin.errorSave'))
    }
  }

  const months = useMemo(() => {
    const set = new Set()
    rows.forEach((r) => {
      if (r.factura?.fecha) set.add(monthKey(r.factura.fecha))
    })
    return Array.from(set).sort((a, b) => (a > b ? -1 : 1))
  }, [rows])

  const inWeek = (ts) => {
    if (week === 'all') return true
    const d = new Date(ts)
    const startCur = startOfWeekOffset(0)
    const startPrev = startOfWeekOffset(1)
    if (week === 'current') return d >= startCur && d < new Date(startCur.getTime() + 7 * 864e5)
    return d >= startPrev && d < startCur
  }

  const inMonth = (ts) => (month === 'all' ? true : monthKey(ts) === month)

  const filtered = rows.filter(
    (r) => r.factura?.fecha && inWeek(r.factura.fecha) && inMonth(r.factura.fecha)
  )
  const total = filtered.reduce((s, r) => s + (Number(r.factura.monto) || 0), 0)

  const byMonth = useMemo(() => {
    const m = new Map()
    rows.forEach((r) => {
      if (!r.factura?.fecha) return
      const k = monthKey(r.factura.fecha)
      const prev = m.get(k) || { total: 0, count: 0 }
      prev.total += Number(r.factura.monto) || 0
      prev.count += 1
      m.set(k, prev)
    })
    return [...m.entries()].sort((a, b) => (a[0] > b[0] ? -1 : 1))
  }, [rows])

  if (error) return <div className="empty empty-error"><p>{t('cat.error')}</p></div>

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <FaSackDollar />
          <h3>{t('admin.paymentsTitle')}</h3>
        </div>

        <div className="filter-bar">
          <label className="field-label">
            <span>{t('admin.weekFilter')}</span>
            <select className="input" value={week} onChange={(e) => setWeek(e.target.value)}>
              <option value="all">{t('admin.week.all')}</option>
              <option value="current">{t('admin.week.current')}</option>
              <option value="last">{t('admin.week.last')}</option>
            </select>
          </label>
          <label className="field-label">
            <span>{t('admin.monthFilter')}</span>
            <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="all">{t('admin.month.all')}</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m, lang)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="total-bar">
          <div>
            <span>{t('admin.totalFiltered')}</span>
            <strong>{CURRENCY}{total.toFixed(2)}</strong>
          </div>
          <div>
            <span>{t('admin.count')}</span>
            <strong>{filtered.length}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <FaFileInvoice />
          <h3>{t('admin.monthsTotal')}</h3>
        </div>
        {byMonth.length === 0 ? (
          <div className="panel-empty"><p>{t('admin.paymentsEmpty')}</p></div>
        ) : (
          <ul className="list">
            {byMonth.map(([key, v]) => (
              <li key={key} className="list-item">
                <div className="list-main">
                  <strong>{monthLabel(key, lang)}</strong>
                </div>
                <div className="invoice-right">
                  <strong>{CURRENCY}{v.total.toFixed(2)}</strong>
                  <span className="list-sub">{v.count} {t('admin.count')}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <FaFileInvoice />
          <h3>{t('admin.paymentsTitle')}</h3>
        </div>
        {loading ? (
          <div className="loading">{t('cat.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="panel-empty"><p>{t('admin.payments.noFilters')}</p></div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.payments.date')}</th>
                  <th>{t('admin.payments.payer')}</th>
                  <th>{t('admin.payments.course')}</th>
                  <th>{t('admin.amount')}</th>
                  <th>{t('admin.payments.method')}</th>
                  <th>{t('admin.table.status')}</th>
                  <th>{t('admin.payments.receipt')}</th>
                  <th>{t('admin.table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const concepto =
                    r.factura.concepto && typeof r.factura.concepto === 'object'
                      ? localize(r.factura.concepto, lang)
                      : r.factura.concepto
                  const isPdf = r.factura.comprobante?.startsWith('data:application/pdf')
                  return (
                    <tr key={`${r.uid}-${r.facturaId}`}>
                      <td>{formatDate(r.factura.fecha, lang)}</td>
                      <td>
                        <div className="admin-student">
                          <div>
                            <strong>{clientName(r.user)}</strong>
                            <span className="list-sub">{r.user?.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="list-main">{concepto || r.factura.numero}</span>
                        <span className="list-sub">{r.factura.numero}</span>
                      </td>
                      <td>
                        <strong>
                          {r.factura.monto > 0
                            ? `${CURRENCY}${r.factura.monto}`
                            : r.factura.tipo === 'afiliacion'
                              ? 'Por cotizar'
                              : t('detail.free')}
                        </strong>
                      </td>
                      <td>{t(paymentLabels[r.factura.metodo] || 'insc.payment.transfer')}</td>
                      <td><FacturaBadge estado={r.factura.estado} /></td>
                      <td>
                        {r.factura.comprobante ? (
                          <a href={r.factura.comprobante} target="_blank" rel="noopener noreferrer" className="receipt-ok" title={isPdf ? t('profile.openPdf') : t('profile.viewImage')}>
                            ✓
                          </a>
                        ) : (
                          <span className="receipt-no">—</span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-danger-outline btn-sm" onClick={() => removeInvoice(r.uid, r.facturaId)}>
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}