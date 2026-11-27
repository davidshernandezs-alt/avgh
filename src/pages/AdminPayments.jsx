import { useMemo, useState } from 'react'
import { FaSackDollar, FaFileInvoice, FaTrash, FaCheck, FaFilePdf } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useAllFacturas, deleteInvoice, setInscripcionEstado, deleteInscriptionsAndInvoicesBulk } from '../data/useData'
import { ref, update } from 'firebase/database'
import { db, DB_ROOT } from '../firebase'
import { formatDate } from '../components/ActivityCard'
import { localize } from '../utils/localized'
import { CURRENCY } from '../config'
import { getReceipt, isPdfUrl, viewReceipt, downloadReceipt } from '../utils/receiptFile'

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
  const pagada = estado === 'completada' || estado === 'aprobada'
  const cls =
    pagada ? 'completada' : estado === 'rechazada' ? 'Rechazada' : 'pendiente'
  const key =
    pagada
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
  const [onlyWithReceipt, setOnlyWithReceipt] = useState(false)
  const [selected, setSelected] = useState({})
  const [deleting, setDeleting] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')

  const removeInvoice = async (uid, facturaId) => {
    if (!window.confirm('¿Eliminar esta factura definitivamente?')) return
    try {
      await deleteInvoice(uid, facturaId)
    } catch {
      alert(t('admin.errorSave'))
    }
  }

  const markPaid = async (r) => {
    if (!window.confirm('¿Marcar esta factura como pagada y confirmar la inscripción?')) return
    try {
      if (r.actividadId) {
        await setInscripcionEstado({ uid: r.uid, actividadId: r.actividadId, estado: 'confirmada', confirmarPago: true })
      } else {
        await update(ref(db, `${DB_ROOT}/facturas/${r.uid}/${r.facturaId}`), {
          estado: 'completada',
          validadaFecha: Date.now()
        })
      }
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
    (r) =>
      r.factura?.fecha &&
      inWeek(r.factura.fecha) &&
      inMonth(r.factura.fecha) &&
      (!onlyWithReceipt || Boolean(r.factura?.comprobante))
  )
  const pendientesConComprobante = rows.filter(
    (r) => r.factura?.comprobante && r.factura?.estado !== 'completada'
  ).length
  const total = filtered.reduce((s, r) => s + (Number(r.factura.monto) || 0), 0)

  const rowKey = (r) => `${r.uid}__${r.facturaId}`
  const selectedRows = filtered.filter((r) => selected[rowKey(r)])
  const allSelected = filtered.length > 0 && selectedRows.length === filtered.length

  const toggleAll = () => {
    if (allSelected) setSelected({})
    else setSelected(Object.fromEntries(filtered.map((r) => [rowKey(r), true])))
  }

  const toggleOne = (r) => {
    const key = rowKey(r)
    setSelected((prev) => {
      const next = { ...prev }
      if (next[key]) delete next[key]
      else next[key] = true
      return next
    })
  }

  const bulkDelete = async () => {
    if (!selectedRows.length) return
    if (!window.confirm(`¿Eliminar ${selectedRows.length} factura(s) y su inscripción vinculada? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    setBulkMsg('')
    try {
      const n = await deleteInscriptionsAndInvoicesBulk(selectedRows)
      setSelected({})
      setBulkMsg(`✅ Se eliminaron ${n} registros (factura e inscripción).`)
    } catch (err) {
      console.error(err)
      alert(`Error al eliminar: ${err?.message || 'intenta de nuevo'}`)
    } finally {
      setDeleting(false)
    }
  }

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
          <button
            className={`btn btn-sm ${onlyWithReceipt ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setOnlyWithReceipt((v) => !v)}
            title="Mostrar solo facturas con comprobante de pago"
          >
            <FaFilePdf /> Con comprobante ({pendientesConComprobante} pendientes)
          </button>
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
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px', padding: '10px 12px', background: '#f4f6fb', borderRadius: '6px' }}>
          <label className="checkbox" style={{ margin: 0 }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!filtered.length || deleting} />
            <span>Seleccionar todos los filtrados ({filtered.length})</span>
          </label>
          <span style={{ fontSize: '13px', color: '#555' }}>{selectedRows.length} seleccionado(s)</span>
          <button className="btn btn-danger btn-sm" onClick={bulkDelete} disabled={!selectedRows.length || deleting}>
            <FaTrash /> {deleting ? 'Eliminando...' : 'Eliminar seleccionados (factura + inscripción)'}
          </button>
        </div>
        {bulkMsg && (
          <div className="form-success" style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '6px' }}>{bulkMsg}</div>
        )}
        {loading ? (
          <div className="loading">{t('cat.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="panel-empty"><p>{t('admin.payments.noFilters')}</p></div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '36px' }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Seleccionar todas" />
                  </th>
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
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(selected[rowKey(r)])}
                          onChange={() => toggleOne(r)}
                          aria-label={`Seleccionar factura ${r.factura.numero || ''}`}
                        />
                      </td>
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
                          <div className="payment-receipt-cell">
                            {!isPdfUrl(r.factura.comprobante) && (
                              <button className="receipt-thumb-link" onClick={() => viewReceipt(r.factura.comprobante)} title="Ver comprobante ampliado">
                                <img src={getReceipt(r.factura.comprobante)?.url} alt="Comprobante" className="receipt-thumb" />
                              </button>
                            )}
                            <div className="btn-row btn-row-sm">
                              <button className="btn btn-outline btn-sm" onClick={() => viewReceipt(r.factura.comprobante)} title="Ver comprobante">
                                <FaFilePdf /> Ver
                              </button>
                              <button className="btn btn-outline btn-sm" onClick={() => downloadReceipt(r.factura.comprobante, r.factura.comprobanteNombre)} title="Descargar comprobante">
                                ↓
                              </button>
                              {r.factura.estado !== 'completada' && (
                                <button className="btn btn-primary btn-sm" onClick={() => markPaid(r)} title="Validar pago y confirmar inscripción">
                                  <FaCheck /> Validar
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="receipt-no">—</span>
                        )}
                      </td>
                      <td>
                        {r.factura.estado !== 'completada' && (
                          <button className="btn btn-outline btn-sm" onClick={() => markPaid(r)} title="Marcar pagado">
                            <FaCheck />
                          </button>
                        )}{' '}
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