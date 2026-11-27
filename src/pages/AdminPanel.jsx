import { useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  FaHouseChimney,
  FaRightFromBracket,
  FaPlus,
  FaPen,
  FaTrash,
  FaXmark,
  FaFilePdf,
  FaImage,
  FaCircleCheck,
  FaCircleXmark,
  FaNoteSticky,
  FaUserShield,
  FaFileExcel,
  FaChartPie,
  FaUsers,
  FaClipboardList,
  FaMoneyCheckDollar,
  FaAddressCard,
  FaNewspaper,
  FaQrcode,
  FaBuildingColumns,
  FaBookOpen,
  FaIdCard,
  FaAward,
  FaCircleQuestion,
  FaUserCheck
} from 'react-icons/fa6'
import * as XLSX from 'xlsx'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import {
  useActivities,
  useAllInscripciones,
  setInscripcionEstado,
  setInscripcionTipoAsistente,
  saveActividad,
  deleteActividad,
  deleteInscription,
  deleteInscriptionsAndInvoicesBulk,
  createInscription
} from '../data/useData'
import { formatDate } from '../components/ActivityCard'
import { localize } from '../utils/localized'
import { fileToStorable } from '../utils/files'
import { CURRENCY } from '../config'
import { ref, onValue, off, update } from 'firebase/database'
import { db, DB_ROOT } from '../firebase'
import AdminPayments from './AdminPayments'
import AdminMembers from './AdminMembers'
import AdminPosts from './AdminPosts'
import AdminQRValidation from './AdminQRValidation'
import AdminBankConfig from './AdminBankConfig'
import AdminAffiliationConfig from './AdminAffiliationConfig'
import AdminAffiliationRequests from './AdminAffiliationRequests'
import AdminDashboard from './AdminDashboard'
import TicketModal from '../components/TicketModal'
import CertificateModal from '../components/CertificateModal'
import AdminQuestions from '../components/AdminQuestions'
import ScanToast from '../components/ScanToast'
import AdminEditPersonModal from '../components/AdminEditPersonModal'
import Toggle from '../components/Toggle'
import { importarExcelInscritos, parsearExcelInscritos } from '../data/excelImport'
import { getReceipt, isPdfUrl, viewReceipt, downloadReceipt } from '../utils/receiptFile'

const paymentLabels = {
  transfer: 'insc.payment.transfer',
  mobile: 'insc.payment.mobile',
  cash: 'insc.payment.cash',
  card: 'insc.payment.card'
}

function clientName(user) {
  const full = `${user?.nombres || ''} ${user?.apellidos || ''}`.trim()
  if (user?.tipoPersona === 'juridico') return user.nombreEmpresa || full || user?.email || '?'
  return full || user?.email || '?'
}

function EstadoBadge({ estado }) {
  const { t } = useLang()
  const label =
    estado === 'rechazada'
      ? t('insc.statusRechazada')
      : estado === 'confirmada' || estado === 'confirmed'
        ? t('insc.statusConfirmed')
        : t('insc.statusPendiente')
  const cls =
    estado === 'rechazada' ? 'Rechazada' : estado === 'confirmada' || estado === 'confirmed' ? 'Confirmada' : 'pendiente'
  return <span className={`badge badge-${cls}`}>{label}</span>
}

function RequestsTab() {
  const { t, lang } = useLang()
  const { rows, loading, error } = useAllInscripciones()
  const { items: actividades } = useActivities()
  const [selected, setSelected] = useState(null)
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [showTicket, setShowTicket] = useState(false)
  const [filterEstado, setFilterEstado] = useState('pendiente')
  const [filterActividad, setFilterActividad] = useState('all')
  const [sortBy, setSortBy] = useState('nombre-asc')
  const [search, setSearch] = useState('')

  const countsEstado = useMemo(() => ({
    pendiente: rows.filter((r) => !r.estado || r.estado === 'pendiente' || r.estado === 'lista_espera').length,
    aprobada: rows.filter((r) => r.estado === 'confirmada' || r.estado === 'completada' || r.estado === 'confirmed').length,
    rechazada: rows.filter((r) => r.estado === 'rechazada').length,
    total: rows.length
  }), [rows])

  const filteredRequests = useMemo(() => {
    let out = rows
    if (filterEstado === 'pendiente') out = rows.filter((r) => !r.estado || r.estado === 'pendiente' || r.estado === 'lista_espera')
    else if (filterEstado === 'aprobada') out = rows.filter((r) => r.estado === 'confirmada' || r.estado === 'completada' || r.estado === 'confirmed')
    else if (filterEstado === 'rechazada') out = rows.filter((r) => r.estado === 'rechazada')
    // Separar por evento/actividad
    if (filterActividad !== 'all') out = out.filter((r) => r.actividadId === filterActividad)
    // Buscador por nombre, apellido, cédula, correo o empresa
    const q = search.trim().toLowerCase()
    if (q) {
      out = out.filter((r) => {
        const u = r.user || {}
        return [u.nombres, u.apellidos, u.dni, u.cedula, u.email, u.empresa, u.nombreEmpresa]
          .some((v) => String(v || '').toLowerCase().includes(q))
      })
    }
    const nameOf = (r) => `${r.user?.nombres || ''} ${r.user?.apellidos || ''}`.trim()
    return [...out].sort((a, b) => {
      if (sortBy === 'nombre-desc') return nameOf(b).localeCompare(nameOf(a), 'es')
      if (sortBy === 'recientes') return (b.fecha || 0) - (a.fecha || 0)
      return nameOf(a).localeCompare(nameOf(b), 'es')
    })
  }, [rows, filterEstado, filterActividad, sortBy, search])

  const actById = useMemo(() => {
    const m = {}
    actividades.forEach((a) => {
      m[a.id] = a
    })
    return m
  }, [actividades])

  const exportExcel = () => {
    const today = new Date().toDateString()
    const todaySales = rows.filter((r) => new Date(r.fecha).toDateString() === today)

    const data = todaySales.map((r) => ({
      'Nombre (Cliente)': clientName(r.user),
      'Teléfono': r.user?.telefono || '',
      'Productos Comprados': actById[r.actividadId] ? localize(actById[r.actividadId].titulo, lang) : r.actividadId,
      'Total': r.monto,
      'Estado': r.estado
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventas del día')
    XLSX.writeFile(workbook, `Ventas_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`)
  }

  const row = selected
    ? rows.find((r) => r.uid === selected.uid && r.actividadId === selected.actividadId)
    : null

  const applyEstado = async (estado) => {
    setBusy(true)
    setMsg('')
    try {
      await setInscripcionEstado({ uid: selected.uid, actividadId: selected.actividadId, estado, nota })
      setMsg(t('admin.stateUpdated'))
    } catch {
      setMsg(t('admin.sessionError'))
    } finally {
      setBusy(false)
    }
  }

  const deleteReq = async () => {
    if (!window.confirm('¿Eliminar esta solicitud definitivamente?')) return
    setBusy(true)
    try {
      await deleteInscription(selected.uid, selected.actividadId)
      setSelected(null)
    } catch {
      alert(t('admin.errorSave'))
    } finally {
      setBusy(false)
    }
  }

  const receipt = row?.factura
  const activ = row ? actById[row.actividadId] : null

  if (error) return <div className="empty empty-error"><p>{t('cat.error')}</p></div>

  return (
    <>
      <AdminAffiliationRequests />

      <section className="panel">
        <div className="panel-head" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaUserShield />
            <h3>{t('admin.requestsTitle')}</h3>
          </div>
          <div className="btn-row">
            {[
              ['pendiente', `Pendientes (${countsEstado.pendiente})`],
              ['aprobada', `Aprobadas (${countsEstado.aprobada})`],
              ['rechazada', `Rechazadas (${countsEstado.rechazada})`],
              ['all', `Todas (${countsEstado.total})`]
            ].map(([value, label]) => (
              <button
                key={value}
                className={`btn btn-sm ${filterEstado === value ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFilterEstado(value)}
              >
                {label}
              </button>
            ))}
            <select
              className="input"
              style={{ maxWidth: '260px' }}
              value={filterActividad}
              onChange={(e) => setFilterActividad(e.target.value)}
              aria-label="Filtrar solicitudes por evento"
            >
              <option value="all">Todos los eventos</option>
              {actividades.map((a) => (
                <option key={a.id} value={a.id}>
                  {localize(a.titulo, lang)}
                </option>
              ))}
            </select>
            <select
              className="input"
              style={{ maxWidth: '190px' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Ordenar solicitudes"
            >
              <option value="nombre-asc">Orden: Nombre A-Z</option>
              <option value="nombre-desc">Orden: Nombre Z-A</option>
              <option value="recientes">Orden: Más recientes</option>
            </select>
          </div>
        </div>

        <div className="btn-row" style={{ marginBottom: '16px' }}>
          <input
            type="text"
            className="input"
            style={{ maxWidth: '400px' }}
            placeholder="Buscar por nombre, apellido, cédula, correo o empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar solicitudes"
          />
        </div>
        <div className="btn-row" style={{ marginBottom: '16px' }}>
          <button className="btn btn-outline btn-sm" onClick={exportExcel}>
            <FaFileExcel /> Descargar ventas del día (Excel)
          </button>
        </div>
        {loading ? (
          <div className="loading">{t('cat.loading')}</div>
        ) : filteredRequests.length === 0 ? (
          <div className="panel-empty"><p>{t('admin.requestsEmpty')}</p></div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.table.student')}</th>
                  <th>{t('admin.table.course')}</th>
                  <th>{t('admin.table.date')}</th>
                  <th>{t('admin.table.status')}</th>
                  <th>{t('admin.table.receipt')}</th>
                  <th>{t('admin.table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((r) => {
                  const act = actById[r.actividadId]
                  const name = clientName(r.user)

                  return (
                    <tr key={`${r.uid}-${r.actividadId}`} className={selected ? 'is-muted' : ''}>
                      <td>
                        <div className="admin-student">
                          {r.user?.foto ? (
                            <img src={r.user.foto} alt="" className="admin-thumb" />
                          ) : (
                            <span className="admin-thumb admin-thumb-initial">{name.charAt(0)}</span>
                          )}
                          <div>
                            <strong>{name}</strong>
                            <span className="list-sub">{r.user?.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>{act ? localize(act.titulo, lang) : r.actividadId}</td>
                      <td>{formatDate(r.fecha, lang)}</td>
                      <td><EstadoBadge estado={r.estado} /></td>
                      <td>{r.factura?.comprobante ? <span className="receipt-ok">✓</span> : <span className="receipt-no">—</span>}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => { setSelected({ uid: r.uid, actividadId: r.actividadId }); setNota(r.nota || '') }}>
                          {t('admin.review')}
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

      {row && (
        <div className="qr-modal-backdrop admin-review-backdrop" onClick={() => setSelected(null)}>
          <section className="panel admin-detail" onClick={(e) => e.stopPropagation()}>
            <div className="admin-detail-head">
              <h3>{t('admin.review')}</h3>
              <button className="btn-icon" onClick={() => setSelected(null)} aria-label={t('admin.close')}>
                <FaXmark />
              </button>
            </div>

            <div className="admin-actions-bar">
              <div className="btn-row">
                <button className="btn btn-primary" disabled={busy} onClick={() => applyEstado('confirmada')}>
                  <FaCircleCheck /> {t('admin.approve')}
                </button>
                <button className="btn btn-danger" disabled={busy} onClick={() => applyEstado('rechazada')}>
                  <FaCircleXmark /> {t('admin.reject')}
                </button>
                <button className="btn btn-ghost" disabled={busy} onClick={deleteReq} style={{ color: 'var(--danger)' }}>
                  <FaTrash /> Eliminar
                </button>
              </div>
              <div className="btn-row">
                <a
                  className="btn btn-outline"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(row.user?.email || '')}&su=${encodeURIComponent('Carnet QR de Inscripción - AVGH')}&body=${encodeURIComponent(`Hola ${row.user?.nombres || ''},\n\nTus datos e inscripción al curso "${activ ? localize(activ.titulo, lang) : ''}" han sido procesados y validados con éxito.\n\nAdjunto a este correo encontrarás tu Carnet de Acceso en PDF que incluye tu código QR oficial y los datos de tu inscripción ya pagada. También puedes consultar o presentar tu código QR en cualquier momento desde tu perfil de usuario en la plataforma.\n\n¡Te esperamos!\nAsociación Venezolana de Gestión Humana (AVGH)`)}`}
                >
                  ✉️ Enviar QR por correo (Gmail)
                </a>
                <button className="btn btn-outline" onClick={() => setShowTicket(true)}>
                  🖨️ Ver / Descargar Carnet PDF
                </button>
              </div>
              {msg && <p className="form-success">{msg}</p>}
            </div>

            {showTicket && (
              <TicketModal
                user={{ uid: row.uid, email: row.user?.email, ...row.user }}
                insc={row}
                act={activ}
                factura={row.factura}
                onClose={() => setShowTicket(false)}
              />
            )}

            <div className="admin-grid">
            <div className="admin-section">
              <h4>{t('admin.studentData')}</h4>
              <div className="admin-student">
                {row.user?.foto ? (
                  <img src={row.user.foto} alt="" className="admin-thumb admin-thumb-lg" />
                ) : (
                  <span className="admin-thumb admin-thumb-initial admin-thumb-lg">
                    {`${row.user?.nombres?.[0] || '?'}${row.user?.apellidos?.[0] || ''}`.toUpperCase()}
                  </span>
                )}
              </div>
              <ul className="admin-list">
                <li><strong>Cliente:</strong> {clientName(row.user)}</li>
                {row.user?.tipoPersona === 'juridico' && (
                  <>
                    <li><strong>{t('home.rif')}:</strong> {row.user?.rif || t('admin.notProvided')}</li>
                    <li><strong>{t('home.cargo')}:</strong> {row.user?.cargo || t('admin.notProvided')}</li>
                    <li><strong>{t('home.direccionFiscal')}:</strong> {row.user?.direccionFiscal || t('admin.notProvided')}</li>
                    <li><strong>{t('home.comoSeEntero')}:</strong> {row.user?.comoSeEntero ? t(`home.comoSeEntero.${row.user.comoSeEntero}`) : t('admin.notProvided')}</li>
                  </>
                )}
                <li><strong>Nombre:</strong> {`${row.user?.nombres || ''} ${row.user?.apellidos || ''}`.trim() || t('admin.notProvided')}</li>
                <li><strong>Email:</strong> {row.user?.email || t('admin.notProvided')}</li>
                <li><strong>{t('admin.phone')}:</strong> {row.user?.telefono || t('admin.notProvided')}</li>
                <li><strong>{t('admin.dni')}:</strong> {row.user?.dni || t('admin.notProvided')}</li>
                <li><strong>{t('admin.age')}:</strong> {row.user?.edad ? `${row.user.edad} años` : t('admin.notProvided')}</li>
                <li><strong>{t('admin.sex')}:</strong> {row.user?.sexo ? t(`profile.sex.${row.user.sexo}`) : t('admin.notProvided')}</li>
              </ul>
            </div>

            <div className="admin-section">
              <h4>{t('admin.enrollData')}</h4>
              <ul className="admin-list">
                <li><strong>{t('admin.table.course')}:</strong> {activ ? localize(activ.titulo, lang) : row.actividadId}</li>
                {activ && <li><strong>{t('detail.modality')}:</strong> {t(`detail.modality.${activ.modalidad}`)}</li>}
                {activ && (activ.precio ?? 0) > 0 && <li><strong>{t('admin.amount')}:</strong> {CURRENCY}{activ.precio}</li>}
                <li><strong>{t('admin.table.date')}:</strong> {formatDate(row.fecha, lang)}</li>
                <li><strong>{t('admin.table.status')}:</strong> <EstadoBadge estado={row.estado} /></li>
                <li>
                  <strong>Tipo de Asistente:</strong>{' '}
                  <select
                    className="input"
                    style={{ marginTop: '4px', padding: '6px 10px', fontSize: '13px' }}
                    value={row.tipoAsistente || 'regular'}
                    onChange={async (e) => {
                      try {
                        await setInscripcionTipoAsistente({
                          uid: row.uid,
                          actividadId: row.actividadId,
                          tipoAsistente: e.target.value
                        })
                        alert('✅ Tipo de asistente actualizado con éxito.')
                      } catch {
                        alert('Error al actualizar.')
                      }
                    }}
                  >
                    <option value="regular">Regular (Pago normal)</option>
                    <option value="afiliado">Afiliado</option>
                    <option value="noafiliado">No Afiliado</option>
                    <option value="invitado">Invitado especial</option>
                    <option value="junta">Junta Directiva</option>
                    <option value="facilitador">Facilitador</option>
                    <option value="exonerado">Exonerado (Sin costo)</option>
                  </select>
                </li>
              </ul>
            </div>

            <div className="admin-section">
              <h4>{t('admin.paymentData')}</h4>
              <ul className="admin-list">
                <li><strong>{t('admin.method')}:</strong> {t(paymentLabels[row.metodoPago] || 'insc.payment.transfer')}</li>
                <li><strong>{t('admin.amount')}:</strong> {row.monto > 0 ? `${CURRENCY}${row.monto}` : t('detail.free')}</li>
                {row.factura && (
                  <li><strong>{t('admin.invoice')}:</strong> {row.factura.numero}</li>
                )}
                {row.factura?.comprobanteFecha && (
                  <li><strong>Comprobante:</strong> {formatDate(row.factura.comprobanteFecha, lang)}</li>
                )}
              </ul>
            </div>
          </div>

          <div className="admin-section admin-receipt">
            <h4>{t('admin.receiptData')}</h4>
            {receipt?.comprobante ? (
              (() => {
                const r = getReceipt(receipt.comprobante)
                const pdf = isPdfUrl(r?.url)
                return (
                  <div className="receipt-preview">
                    {pdf ? (
                      <FaFilePdf className="receipt-icon-lg" />
                    ) : (
                      <img src={r.url} alt={t('admin.receiptYes')} className="receipt-img" />
                    )}
                    <div className="btn-row">
                      <button className="btn btn-primary btn-sm" onClick={() => viewReceipt(receipt.comprobante)}>
                        <FaFilePdf /> Ver en pestaña nueva
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => downloadReceipt(receipt.comprobante, receipt.comprobanteNombre)}>
                        Descargar
                      </button>
                    </div>
                    {receipt.comprobanteNombre && <small>{receipt.comprobanteNombre}</small>}
                  </div>
                )
              })()
            ) : (
              <p className="admin-warning"><FaCircleXmark /> {t('admin.noReceipt')}</p>
            )}
          </div>

          <div className="admin-validate admin-note-bottom">
            <label className="field-label">
              <span><FaNoteSticky /> {t('admin.notePlaceholder')}</span>
              <textarea className="input textarea" value={nota} onChange={(e) => setNota(e.target.value)} placeholder={t('admin.notePlaceholder')} />
            </label>
          </div>
          </section>
        </div>
      )}
    </>
  )
}

function ActivityForm({ initial, onCancel }) {
  const { t } = useLang()
  const isNew = !initial.id
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const titular = (v) => (v && typeof v === 'object' ? v : { es: v || '', en: '' })
  const listToText = (v) =>
    Array.isArray(v) ? v.join('\n') : v && typeof v === 'object' ? v.es || '' : v || ''

  const [form, setForm] = useState(() => ({
    id: initial.id || '',
    tipo: initial.tipo || 'course',
    tituloEs: titular(initial.titulo).es,
    tituloEn: titular(initial.titulo).en,
    descEs: titular(initial.descripcion).es,
    descEn: titular(initial.descripcion).en,
    modalidad:
      initial.modalidad === 'inPerson' || initial.modalidad === 'hybrid'
        ? 'presencial'
        : initial.modalidad || 'online',
    duracion: initial.duracion || '',
    horario: initial.horario || '',
    lugarEs: titular(initial.lugar).es,
    lugarEn: titular(initial.lugar).en,
    objEs: titular(initial.objetivoGeneral).es,
    objEn: titular(initial.objetivoGeneral).en,
    conEs: listToText(initial.contenido),
    conEn: initial.contenido && !Array.isArray(initial.contenido) && typeof initial.contenido === 'object' ? initial.contenido.en || '' : '',
    facilitadores: listToText(initial.facilitadores) || initial.instructor || '',
    fechaInicio: initial.fechaInicio ? new Date(initial.fechaInicio).toISOString().slice(0, 10) : '',
    precio: initial.precio != null ? String(initial.precio) : '',
    cupo: initial.cupo != null ? String(initial.cupo) : '',
    gratisAfiliados: !!initial.gratisAfiliados,
    imagen: initial.imagen || '',
    imagenBanner: initial.imagenBanner || ''
  }))

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const onFoto = async (e, key = 'imagen') => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const stored = await fileToStorable(file, 900, key === 'imagenBanner' ? 'banner' : 'square')
      setForm((f) => ({ ...f, [key]: stored.dataUrl }))
    } catch (err) {
      setMsg(err.message === 'too-large' ? t('admin.imageTooLarge') : t('admin.imageBadType'))
    }
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.tituloEs || !form.modalidad || !form.duracion || !form.horario) {
      setMsg(t('home.requiredField'))
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const act = {
        tipo: form.tipo,
        titulo: { es: form.tituloEs, en: form.tituloEn },
        descripcion: { es: form.descEs, en: form.descEn },
        modalidad: form.modalidad,
        duracion: form.duracion,
        horario: form.horario,
        lugar: { es: form.lugarEs, en: form.lugarEn },
        objetivoGeneral: { es: form.objEs, en: form.objEn },
        contenido: { es: form.conEs, en: form.conEn },
        facilitadores: form.facilitadores.split('\n').map((s) => s.trim()).filter(Boolean),
        fechaInicio: form.fechaInicio ? new Date(`${form.fechaInicio}T12:00:00`).getTime() : null,
        precio: Number(form.precio) || 0,
        cupo: Number(form.cupo) || 0,
        gratisAfiliados: !!form.gratisAfiliados,
        imagen: form.imagen,
        imagenBanner: form.imagenBanner
      }
      await saveActividad(form.id, act)
      setMsg(t('admin.saved'))
      setTimeout(onCancel, 1200)
    } catch {
      setMsg(t('admin.sessionError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{isNew ? t('admin.form.new') : t('admin.form.edit')}</h3>
      </div>
      <form className="form" onSubmit={save}>
        <div className="field-row">
          <label className="field-label">
            <span>{t('admin.form.tipo')}</span>
            <select className="input" value={form.tipo} onChange={set('tipo')}>
              <option value="course">{t('type.course')}</option>
              <option value="workshop">{t('type.workshop')}</option>
              <option value="event">{t('type.event')}</option>
            </select>
          </label>
          <label className="field-label">
            <span>{t('admin.form.modalidad')}</span>
            <select className="input" value={form.modalidad} onChange={set('modalidad')}>
              <option value="online">{t('detail.modality.online')}</option>
              <option value="presencial">{t('detail.modality.presencial')}</option>
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="field-label">
            <span>{t('admin.form.titleEs')}</span>
            <input className="input" value={form.tituloEs} onChange={set('tituloEs')} required />
          </label>
          <label className="field-label">
            <span>{t('admin.form.titleEn')}</span>
            <input className="input" value={form.tituloEn} onChange={set('tituloEn')} />
          </label>
        </div>

        <div className="field-row">
          <label className="field-label">
            <span>{t('admin.form.descEs')}</span>
            <textarea className="input textarea" value={form.descEs} onChange={set('descEs')} />
          </label>
          <label className="field-label">
            <span>{t('admin.form.descEn')}</span>
            <textarea className="input textarea" value={form.descEn} onChange={set('descEn')} />
          </label>
        </div>

        <div className="field-row">
          <label className="field-label">
            <span>{t('admin.form.duracion')}</span>
            <input className="input" value={form.duracion} onChange={set('duracion')} placeholder="8 semanas" />
          </label>
          <label className="field-label">
            <span>{t('admin.form.horario')}</span>
            <input className="input" value={form.horario} onChange={set('horario')} placeholder="Lun y Mié · 7:00 p. m." />
          </label>
        </div>

        <div className="field-row">
          <label className="field-label">
            <span>{t('admin.form.lugarEs')}</span>
            <input className="input" value={form.lugarEs} onChange={set('lugarEs')} placeholder="Ej. Sede AVGH, Caracas" />
          </label>
          <label className="field-label">
            <span>{t('admin.form.lugarEn')}</span>
            <input className="input" value={form.lugarEn} onChange={set('lugarEn')} placeholder="Ej. AVGH HQ, Caracas" />
          </label>
        </div>

        <div className="field-row">
          <label className="field-label">
            <span>{t('admin.form.objEs')}</span>
            <textarea className="input textarea" value={form.objEs} onChange={set('objEs')} />
          </label>
          <label className="field-label">
            <span>{t('admin.form.objEn')}</span>
            <textarea className="input textarea" value={form.objEn} onChange={set('objEn')} />
          </label>
        </div>

        <div className="field-row">
          <label className="field-label">
            <span>{t('admin.form.contentEs')}</span>
            <textarea className="input textarea textarea-lg" value={form.conEs} onChange={set('conEs')} />
          </label>
          <label className="field-label">
            <span>{t('admin.form.contentEn')}</span>
            <textarea className="input textarea textarea-lg" value={form.conEn} onChange={set('conEn')} />
          </label>
        </div>

        <label className="field-label">
          <span>{t('admin.form.facilitadores')}</span>
          <textarea className="input textarea" value={form.facilitadores} onChange={set('facilitadores')} />
        </label>

        <div className="field-row">
          <label className="field-label">
            <span>{t('admin.form.fechaInicio')}</span>
            <input type="date" className="input" value={form.fechaInicio} onChange={set('fechaInicio')} />
          </label>
          <label className="field-label">
            <span>{t('admin.form.precio')}</span>
            <input type="number" min="0" step="0.01" className="input" value={form.precio} onChange={set('precio')} />
          </label>
          <label className="field-label">
            <span>{t('admin.form.cupo')}</span>
            <input type="number" min="0" className="input" value={form.cupo} onChange={set('cupo')} />
          </label>
        </div>

        <div className="field-label gratis-afiliados-box">
          <Toggle
            id="gratisAfiliados"
            checked={form.gratisAfiliados}
            onChange={(v) => setForm((f) => ({ ...f, gratisAfiliados: v }))}
            label={t('admin.form.gratisAfiliados')}
          />
          <em>{t('admin.form.gratisAfiliadosHint')}</em>
        </div>

        <div className="field-label">
          <span>{t('admin.form.foto')} <em style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--muted)' }}>(1:1 · se ve en el listado de próximos eventos)</em></span>
          <div className="course-photo-row">
            {form.imagen ? (
              <img src={form.imagen} alt="" className="course-photo-preview" />
            ) : (
              <div className="course-photo-empty"><FaImage /></div>
            )}
            <input type="file" accept="image/jpeg,image/png" className="hidden-input" id="act-foto" onChange={(e) => onFoto(e, 'imagen')} />
            <label htmlFor="act-foto" className="btn btn-ghost btn-sm">Subir foto</label>
          </div>
        </div>

        <div className="field-label">
          <span>{t('admin.form.fotoBanner')} <em style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--muted)' }}>(panorámica · se ve en la vista de detalle)</em></span>
          <div className="course-photo-row">
            {form.imagenBanner ? (
              <img src={form.imagenBanner} alt="" className="course-photo-preview course-photo-preview-wide" />
            ) : (
              <div className="course-photo-empty course-photo-empty-wide"><FaImage /></div>
            )}
            <input type="file" accept="image/jpeg,image/png" className="hidden-input" id="act-foto-banner" onChange={(e) => onFoto(e, 'imagenBanner')} />
            <label htmlFor="act-foto-banner" className="btn btn-ghost btn-sm">Subir banner</label>
          </div>
        </div>

        {msg && <p className="form-error">{msg}</p>}

        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? t('admin.saving') : t('admin.form.save')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            <FaXmark /> {t('admin.form.cancel')}
          </button>
        </div>
      </form>
    </section>
  )
}

function CoursesTab() {
  const { t, lang } = useLang()
  const { items: actividades, loading } = useActivities()
  const [editing, setEditing] = useState(null)
  const [busyId, setBusyId] = useState('')

  const remove = async (id, titulo) => {
    if (!window.confirm(t('admin.confirmDelete'))) return
    setBusyId(id)
    try {
      await deleteActividad(id)
    } finally {
      setBusyId('')
    }
  }

  if (editing) return <ActivityForm initial={editing} onCancel={() => setEditing(null)} />

  return (
    <>
      <div className="panel-head admin-tools">
        <div>
          <h3>{t('admin.tabCourses')}</h3>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ tipo: 'course' })}>
          <FaPlus /> {t('admin.addCourse')}
        </button>
      </div>

      <section className="panel">
        {loading ? (
          <div className="loading">{t('cat.loading')}</div>
        ) : actividades.length === 0 ? (
          <div className="panel-empty"><p>{t('admin.emptyCourses')}</p></div>
        ) : (
          <ul className="list">
            {actividades.map((a) => (
              <li key={a.id} className="list-item admin-course-row">
                {a.imagen ? (
                  <img src={a.imagen} alt="" className="admin-course-img" />
                ) : (
                  <span className="admin-course-img admin-course-img-empty">{localize(a.titulo, lang).charAt(0)}</span>
                )}
                <div className="list-main">
                  <strong>{localize(a.titulo, lang)}</strong>
                  <span className="list-sub">
                    {t(`type.${a.tipo}`)} · {a.duracion} · {t(`detail.modality.${a.modalidad}`)}
                  </span>
                </div>
                <div className="btn-row btn-row-sm">
                  <button className="btn-icon" onClick={() => setEditing(a)} title={t('admin.editActivity')}>
                    <FaPen />
                  </button>
                  <button className="btn-icon btn-icon-danger" disabled={busyId === a.id} onClick={() => remove(a.id, a.titulo)} title={t('admin.deleteActivity')}>
                    <FaTrash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function useAdminNotifications() {
  const [notifs, setNotifs] = useState([])

  const push = (n) => {
    // Marcar/desmarcar asistencia (incluido el lector QR) nunca genera avisos.
    if (n.tipo === 'inscripcion' && window.__avghAttendanceUpdateUntil > Date.now()) return
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    setNotifs((prev) => [...prev.slice(-5), { ...n, id, at: Date.now() }])
    setTimeout(() => {
      setNotifs((prev) => prev.filter((x) => x.id !== id))
    }, 10000)
  }

  useEffect(() => {
    const usersRef = ref(db, `${DB_ROOT}/users`)
    const inscRef = ref(db, `${DB_ROOT}/inscripciones`)
    const affRef = ref(db, `${DB_ROOT}/afiliaciones_solicitudes`)

    let knownUsers = null
    let knownInsc = null
    let knownAff = null

    const clearFlag = (path) => {
      update(ref(db, path), { notificarNuevo: null }).catch(() => {})
    }

    const playBeep = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(587.33, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15)
        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.5)
      } catch {
        /* ignore */
      }
    }

    const unsubUsers = onValue(usersRef, (snap) => {
      const val = snap.val() || {}
      const keys = Object.keys(val)
      if (!knownUsers) {
        knownUsers = new Set(keys)
        return
      }
      const nuevos = keys.filter((k) => !knownUsers.has(k))
      knownUsers = new Set(keys)
      if (!nuevos.length) return
      const u = val[nuevos[0]] || {}
      if (u.notificarNuevo !== 'registro') return
      const nombre = `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.email || 'Nuevo usuario'
      playBeep()
      push({ tipo: 'registro', titulo: '🆕 Nuevo registro', detalle: nombre, tab: 'members' })
      clearFlag(`${DB_ROOT}/users/${nuevos[0]}`)
    })

    // Solo avisamos cuando aparece una inscripción NUEVA. Actualizar asistencia
    // desde el lector QR (presente/fechaAsistencia) no cuenta como inscripción.
    const unsubInsc = onValue(inscRef, (snap) => {
      const val = snap.val() || {}
      const keys = []
      Object.entries(val).forEach(([uid, acts]) => {
        Object.keys(acts || {}).forEach((actId) => keys.push(`${uid}|${actId}`))
      })
      if (!knownInsc) {
        knownInsc = new Set(keys)
        return
      }
      const nuevos = keys.filter((k) => !knownInsc.has(k))
      knownInsc = new Set(keys)
      if (!nuevos.length) return
      const [uid, actId] = nuevos[0].split('|')
      const data = val[uid]?.[actId] || {}
      if (data.notificarNuevo !== 'inscripcion') return
      const nombre = `${data.user?.nombres || ''} ${data.user?.apellidos || ''}`.trim() || 'Participante'
      playBeep()
      push({ tipo: 'inscripcion', titulo: '📝 Nueva inscripción', detalle: nombre, tab: 'requests' })
      clearFlag(`${DB_ROOT}/inscripciones/${uid}/${actId}`)
    })

    const unsubAff = onValue(affRef, (snap) => {
      const val = snap.val() || {}
      const keys = Object.keys(val)
      if (!knownAff) {
        knownAff = new Set(keys)
        return
      }
      const nuevos = keys.filter((k) => !knownAff.has(k))
      knownAff = new Set(keys)
      if (!nuevos.length) return
      const r = val[nuevos[0]] || {}
      if (r.notificarNuevo !== 'afiliacion') return
      const nombre = `${r.user?.nombres || ''} ${r.user?.apellidos || ''}`.trim() || r.nombreEmpresa || 'Solicitante'
      playBeep()
      push({
        tipo: 'afiliacion',
        titulo: '🪪 Nueva solicitud de afiliación',
        detalle: `${nombre} · ${r.tipo === 'corporativo' ? 'Corporativa' : 'Individual'}`,
        tab: 'requests'
      })
      clearFlag(`${DB_ROOT}/afiliaciones_solicitudes/${nuevos[0]}`)
    })

    return () => {
      off(usersRef, 'value', unsubUsers)
      off(inscRef, 'value', unsubInsc)
      off(affRef, 'value', unsubAff)
    }
  }, [])

  return {
    notifs,
    dismiss: (id) => setNotifs((prev) => prev.filter((x) => x.id !== id))
  }
}

function AdminNotifications({ notifs, dismiss, setTab }) {
  if (!notifs.length) return null
  return (
    <div className="admin-notif-stack" aria-live="polite">
      {notifs.map((n) => (
        <div className={`admin-notif admin-notif-${n.tipo}`} key={n.id}>
          <div className="admin-notif-body">
            <strong>{n.titulo}</strong>
            <span>{n.detalle}</span>
          </div>
          {n.tab && (
            <button className="btn btn-outline btn-sm" onClick={() => { setTab(n.tab); dismiss(n.id) }}>
              Ver
            </button>
          )}
          <button className="admin-notif-close" onClick={() => dismiss(n.id)} aria-label="Cerrar aviso">
            <FaXmark />
          </button>
        </div>
      ))}
    </div>
  )
}

function InscribedTab() {
  const { t, lang } = useLang()
  const { rows, loading } = useAllInscripciones()
  const { items: actividades } = useActivities()
  const [search, setSearch] = useState('')
  const [filterAct, setFilterAct] = useState('')
  const [sortBy, setSortBy] = useState('nombre-asc')
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [preview, setPreview] = useState(null)
  const [selected, setSelected] = useState({})
  const [deleting, setDeleting] = useState(false)
  const [certRow, setCertRow] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const excelInputRef = useRef(null)

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const name = `${r.user?.nombres || ''} ${r.user?.apellidos || ''} ${r.user?.dni || ''}`.toLowerCase()
      const matchSearch = name.includes(search.toLowerCase())
      // Sin curso seleccionado no se muestra información de cursos/inscritos.
      const matchAct = filterAct ? r.actividadId === filterAct : false
      return matchSearch && matchAct
    })
    .sort((a, b) => {
      if (sortBy === 'nombre-desc') return clientName(b.user).localeCompare(clientName(a.user), 'es')
      if (sortBy === 'recientes') return (b.fecha || 0) - (a.fecha || 0)
      return clientName(a.user).localeCompare(clientName(b.user), 'es')
    })
  }, [rows, search, filterAct, sortBy])

  const actTitle = (id) => {
    const a = actividades.find((x) => x.id === id)
    return a ? localize(a.titulo, lang) : id
  }

  const rowKey = (r) => `${r.uid}__${r.actividadId}`
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
    if (!window.confirm(`¿Eliminar ${selectedRows.length} inscripción(es) y sus facturas? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    try {
      const n = await deleteInscriptionsAndInvoicesBulk(selectedRows)
      setSelected({})
      setUploadMsg(`✅ Se eliminaron ${n} registros (inscripción y factura).`)
    } catch (err) {
      console.error(err)
      alert(`Error al eliminar: ${err?.message || 'intenta de nuevo'}`)
    } finally {
      setDeleting(false)
    }
  }

  const attendeeBadge = (tipo) => {
    if (tipo === 'afiliado') return <span className="badge" style={{ background: '#16a34a', color: '#fff' }}>🟢 Afiliado</span>
    if (tipo === 'noafiliado') return <span className="badge" style={{ background: '#6b7280', color: '#fff' }}>⚪ No Afiliado</span>
    if (tipo === 'invitado') return <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>🔵 Invitado especial</span>
    if (tipo === 'junta') return <span className="badge" style={{ background: '#7c3aed', color: '#fff' }}>🟣 Junta Directiva</span>
    if (tipo === 'facilitador') return <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>🟠 Facilitador</span>
    if (tipo === 'exonerado') return <span className="badge" style={{ background: '#f97316', color: '#fff' }}>🟠 Exonerado</span>
    return <span className="badge badge-Confirmada">Regular</span>
  }

  const canIssueCertificate = (tipo) => (tipo || '') !== 'facilitador'

  const downloadTemplate = () => {
    const data = [
      {
        'FECHA DE INSCRIPCION': '',
        FACTURA: '',
        PAGOS: 'PAGADO',
        CATEGORIA: 'NO AFILIADO',
        'Cantidad de participantes': 1,
        NOMBRE: 'ALMER',
        'NOMBRE APELLIDOS': 'BRACAMONTE',
        CI: '11926888',
        EMPRESA: 'AVGH',
        CARGO: 'PRESIDENTE',
        CORREO: 'almer.bracamonte@gmail.com',
        TELEFONO: '04145551234',
        OBSERVACIONES: 'Afiliado individual / corporativo / junta / facilitador'
      }
    ]
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Inscritos')
    XLSX.writeFile(workbook, 'Plantilla_Inscritos_AVGH.xlsx')
  }

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!filterAct) {
      alert('Por favor selecciona primero el Curso/Evento en el desplegable al que deseas inscribir a las personas del archivo.')
      e.target.value = ''
      return
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const { people, porHoja } = parsearExcelInscritos({ arrayBuffer })
      if (!people.length) {
        setUploadMsg('No se encontraron registros válidos. Revisa que las columnas NOMBRE y CÉDULA/DNI estén presentes.')
        setPreview(null)
      } else {
        setUploadMsg('')
        setPreview({ fileName: file.name, arrayBuffer, people, porHoja })
      }
    } catch (err) {
      console.error(err)
      setUploadMsg(`Error al leer el archivo: ${err?.message || 'Verifica el formato.'}`)
      setPreview(null)
    } finally {
      e.target.value = ''
    }
  }

  const confirmarImportacion = async () => {
    if (!preview) return
    const selectedAct = actividades.find((a) => a.id === filterAct)
    if (!selectedAct) {
      alert('Curso no encontrado.')
      return
    }

    setUploading(true)
    setUploadMsg('Procesando archivo...')
    try {
      const result = await importarExcelInscritos({
        arrayBuffer: preview.arrayBuffer,
        actividad: selectedAct,
        actualizarExistentes: updateExisting,
        onProgress: (m) => setUploadMsg(m)
      })

      const ok = result.created.length
      const upd = result.actualizados?.length || 0
      const ya = result.yaInscritos?.length || 0
      const conCorreo = result.created.filter((p) => p.email).length
      const conTel = result.created.filter((p) => p.telefono).length
      const conCi = result.created.filter((p) => p.dni).length
      const err = result.errores.length
        ? ` · ${result.errores.length} con error: ${result.errores.slice(0, 5).join(' | ')}`
        : ''
      const detalle = [
        ok ? `${ok} inscritos registrados en "${localize(selectedAct.titulo, lang)}" · ${conCi} con cédula · ${conTel} con teléfono · ${conCorreo} con correo` : '',
        upd ? `${upd} actualizados (misma factura)` : '',
        ya ? `${ya} ya inscritos (omitidos, sin factura nueva)` : ''
      ].filter(Boolean).join(' · ')
      if (!detalle) {
        setUploadMsg(`No se registraron inscritos. ${result.errores.slice(0, 2).join(' ')}`)
      } else {
        setUploadMsg(`✅ ${detalle}${err}`)
      }
      setPreview(null)
    } catch (err) {
      console.error(err)
      setUploadMsg(`Error al importar: ${err?.message || 'Verifica el formato.'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaCircleCheck />
          <h3>Listado General de Inscritos ({filtered.length})</h3>
        </div>

        <div className="btn-row">
          <button className="btn btn-outline btn-sm" onClick={downloadTemplate}>
            📥 Descargar Plantilla Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => excelInputRef.current?.click()} disabled={uploading}>
            <FaFileExcel /> {uploading ? 'Cargando...' : 'Cargar Inscritos desde Excel'}
          </button>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            ref={excelInputRef}
            className="hidden-input"
            onChange={handleExcelUpload}
          />
        </div>
      </div>

      <p className="auth-hint">
        Consulta o carga masivamente participantes desde un archivo Excel seleccionando primero el curso/evento objetivo.
      </p>

      <label className="checkbox" style={{ marginBottom: '14px' }}>
        <input
          type="checkbox"
          checked={updateExisting}
          onChange={(e) => setUpdateExisting(e.target.checked)}
        />
        <span>
          Actualizar inscritos existentes: reutiliza su factura (mismo número, sin crear una nueva) y actualiza su
          inscripción, afiliación y datos con los del Excel. No revierte pagos ya validados ni asistencia registrada.
          Sin marcar, los que ya estén inscritos se omiten.
        </span>
      </label>

      {preview && (
        <div style={{ marginBottom: '16px', border: '1px solid #dbe6f7', borderRadius: '8px', padding: '14px', background: '#f8faff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            <div>
              <strong>Vista previa: {preview.fileName}</strong>
              <div style={{ fontSize: '12px', color: '#555' }}>
                {preview.people.length} registros detectados
                {Object.entries(preview.porHoja).map(([hoja, n]) => ` · ${hoja}: ${n}`).join('')}
              </div>
            </div>
            <div className="btn-row">
              <button className="btn btn-outline btn-sm" onClick={() => setPreview(null)} disabled={uploading}>
                Cancelar
              </button>
              <button className="btn btn-primary btn-sm" onClick={confirmarImportacion} disabled={uploading}>
                {uploading ? 'Importando...' : '✅ Confirmar e importar'}
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Nombre</th>
                  <th>Apellido</th>
                  <th>Cédula</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Categoría</th>
                  <th>Pago</th>
                </tr>
              </thead>
              <tbody>
                {preview.people.slice(0, 8).map((p, i) => (
                  <tr key={i}>
                    <td>{p.factura || '—'}</td>
                    <td>{p.nombres || '—'}</td>
                    <td>{p.apellidos || '—'}</td>
                    <td>{p.dni || '—'}</td>
                    <td>{p.telefono || '—'}</td>
                    <td>{p.email || '—'}</td>
                    <td>{p.categoria || '—'}</td>
                    <td>{p.pago || 'Sin dato (pendiente)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="auth-hint" style={{ marginTop: '8px', marginBottom: 0 }}>
            El Excel no incluye columnas de Edad ni Sexo, por eso esos campos quedarán como “No indicado”.
          </p>
        </div>
      )}

      {uploadMsg && (
        <div className="form-success" style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '6px' }}>
          {uploadMsg}
        </div>
      )}

      <div className="field-row" style={{ marginBottom: '16px' }}>
        <input
          type="text"
          className="input"
          placeholder="Buscar por nombre, apellido o cédula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          value={filterAct}
          onChange={(e) => setFilterAct(e.target.value)}
        >
          <option value="">Selecciona el Curso / Evento para cargar o filtrar...</option>
          {actividades.map((a) => (
            <option key={a.id} value={a.id}>{localize(a.titulo, lang)}</option>
          ))}
        </select>
        <select
          className="input"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Ordenar inscritos"
        >
          <option value="nombre-asc">Orden: Nombre A-Z</option>
          <option value="nombre-desc">Orden: Nombre Z-A</option>
          <option value="recientes">Orden: Más recientes</option>
        </select>
      </div>

      <div className="bulk-bar" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px', padding: '10px 12px', background: '#f4f6fb', borderRadius: '6px' }}>
        <label className="checkbox" style={{ margin: 0 }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!filtered.length || deleting} />
          <span>Seleccionar todos los filtrados ({filtered.length})</span>
        </label>
        <span style={{ fontSize: '13px', color: '#555' }}>{selectedRows.length} seleccionado(s)</span>
        <button className="btn btn-danger btn-sm" onClick={bulkDelete} disabled={!selectedRows.length || deleting}>
          <FaTrash /> {deleting ? 'Eliminando...' : 'Eliminar seleccionados (inscripción + factura)'}
        </button>
      </div>

      {loading ? (
        <p className="loading">Cargando inscritos...</p>
      ) : filtered.length === 0 ? (
        <p className="auth-hint">
          {!filterAct
            ? 'Selecciona un curso / evento para ver los inscritos.'
            : 'No se encontraron inscripciones con los filtros seleccionados.'}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '36px' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Seleccionar todos" />
                </th>
                <th>Participante</th>
                <th>Cédula</th>
                <th>Tipo de Asistente</th>
                <th>Estatus Afiliado</th>
                <th>Curso / Evento</th>
                <th>Pago</th>
                <th>Asistencia</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isPresent = r.presente === true
                const isAffiliate = r.user?.afiliado === true
                return (
                  <tr key={`${r.uid}-${r.actividadId}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(selected[rowKey(r)])}
                        onChange={() => toggleOne(r)}
                        aria-label={`Seleccionar a ${r.user?.nombres || ''} ${r.user?.apellidos || ''}`}
                      />
                    </td>
                    <td><strong>{r.user?.nombres || ''} {r.user?.apellidos || ''}</strong><br /><small>{r.user?.email}</small></td>
                    <td>{r.user?.dni || r.user?.cedula || '—'}</td>
                    <td>{attendeeBadge(r.tipoAsistente)}</td>
                    <td>
                      {isAffiliate ? (
                        <span className="badge-member">
                          Afiliado {r.user?.tipoAfiliacion === 'corporativo' ? 'Corporativo' : 'Individual'}
                        </span>
                      ) : (
                        <span className="badge badge-pendiente">No Afiliado</span>
                      )}
                    </td>
                    <td>{actTitle(r.actividadId)}</td>
                    <td><EstadoBadge estado={r.estado} /></td>
                    <td>
                      <span className={`badge badge-${isPresent ? 'Confirmada' : 'pendiente'}`}>
                        {isPresent ? '✅ Presente' : '⏳ Por llegar'}
                      </span>
                    </td>
                    <td>
                      <div className="member-actions" style={{ flexWrap: 'nowrap', gap: '4px' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setEditRow(r)} title="Editar datos del participante">
                          <FaPen />
                        </button>
                        {isPresent && canIssueCertificate(r.tipoAsistente) ? (
                          <button className="btn btn-outline btn-sm" onClick={() => setCertRow(r)} title="Generar certificado">
                            <FaAward />
                          </button>
                        ) : null}
                        {/* La afiliación se gestiona solo en el módulo Afiliaciones. */}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {certRow && (
        <CertificateModal
          user={certRow.user}
          insc={certRow}
          act={actividades.find((a) => a.id === certRow.actividadId)}
          mode="admin"
          onClose={() => setCertRow(null)}
        />
      )}

      {editRow && (
        <AdminEditPersonModal
          uid={editRow.uid}
          person={editRow.user}
          inscripcion={editRow}
          onClose={() => setEditRow(null)}
        />
      )}
    </section>
  )
}

export default function AdminPanel() {
  const { t } = useLang()
  const { profile, logout } = useAuth()
  const [tab, setTab] = useState('requests')
  const { notifs, dismiss } = useAdminNotifications()

  if (profile?.rol !== 'admin') {
    return (
      <div className="page">
        <div className="empty empty-error">
          <p>{t('admin.notAdmin')}</p>
          <Link to="/admin" className="btn btn-primary btn-block">{t('admin.title')}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <ScanToast />
      <AdminNotifications notifs={notifs} dismiss={dismiss} setTab={setTab} />
      <div className="page-head">
        <Link to="/" className="btn-icon" aria-label={t('admin.goApp')}>
          <FaHouseChimney />
        </Link>
        <div className="page-head-text">
          <h1>{t('admin.panel')}</h1>
          <p>{t('admin.welcome')}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout}>
          <FaRightFromBracket /> {t('admin.signOut')}
        </button>
      </div>

      <div className="admin-tabs">
        <button className={tab === 'dashboard' ? 'is-active' : ''} onClick={() => setTab('dashboard')} title="Dashboard & Aforo">
          <FaChartPie className="admin-tab-icon" /> <span className="admin-tab-label">Dashboard</span>
        </button>
        <button className={tab === 'inscribed' ? 'is-active' : ''} onClick={() => setTab('inscribed')} title="Inscritos">
          <FaUsers className="admin-tab-icon" /> <span className="admin-tab-label">Inscritos</span>
        </button>
        <button className={tab === 'requests' ? 'is-active' : ''} onClick={() => setTab('requests')} title={t('admin.tabRequests')}>
          <FaClipboardList className="admin-tab-icon" /> <span className="admin-tab-label">{t('admin.tabRequests')}</span>
        </button>
        <button className={tab === 'payments' ? 'is-active' : ''} onClick={() => setTab('payments')} title={t('admin.tabPayments')}>
          <FaMoneyCheckDollar className="admin-tab-icon" /> <span className="admin-tab-label">{t('admin.tabPayments')}</span>
        </button>
        <button className={tab === 'members' ? 'is-active' : ''} onClick={() => setTab('members')} title={t('admin.tabMembers')}>
          <FaAddressCard className="admin-tab-icon" /> <span className="admin-tab-label">{t('admin.tabMembers')}</span>
        </button>
        <button className={tab === 'news' ? 'is-active' : ''} onClick={() => setTab('news')} title={t('admin.tabNews')}>
          <FaNewspaper className="admin-tab-icon" /> <span className="admin-tab-label">{t('admin.tabNews')}</span>
        </button>
        <button className={tab === 'qr' ? 'is-active' : ''} onClick={() => setTab('qr')} title={t('admin.tabQR')}>
          <FaQrcode className="admin-tab-icon" /> <span className="admin-tab-label">{t('admin.tabQR')}</span>
        </button>
        <button className={tab === 'bank' ? 'is-active' : ''} onClick={() => setTab('bank')} title={t('admin.tabBank')}>
          <FaBuildingColumns className="admin-tab-icon" /> <span className="admin-tab-label">{t('admin.tabBank')}</span>
        </button>
        <button
          className={tab === 'affiliation' ? 'is-active' : ''}
          onClick={() => setTab('affiliation')}
          title={t('admin.tabAffiliation')}
        >
          <FaIdCard className="admin-tab-icon" /> <span className="admin-tab-label">{t('admin.tabAffiliation')}</span>
        </button>
        <button className={tab === 'courses' ? 'is-active' : ''} onClick={() => setTab('courses')} title={t('admin.tabCourses')}>
          <FaBookOpen className="admin-tab-icon" /> <span className="admin-tab-label">{t('admin.tabCourses')}</span>
        </button>
        <button className={tab === 'qa' ? 'is-active' : ''} onClick={() => setTab('qa')} title="Preguntas en vivo">
          <FaCircleQuestion className="admin-tab-icon" /> <span className="admin-tab-label">Preguntas</span>
        </button>
      </div>

      {tab === 'dashboard' ? (
        <AdminDashboard />
      ) : tab === 'inscribed' ? (
        <InscribedTab />
      ) : tab === 'requests' ? (
        <RequestsTab />
      ) : tab === 'payments' ? (
        <AdminPayments />
      ) : tab === 'members' ? (
        <AdminMembers />
      ) : tab === 'news' ? (
        <AdminPosts />
      ) : tab === 'qr' ? (
        <AdminQRValidation />
      ) : tab === 'bank' ? (
        <AdminBankConfig />
      ) : tab === 'affiliation' ? (
        <AdminAffiliationConfig />
      ) : tab === 'qa' ? (
        <AdminQuestions />
      ) : (
        <CoursesTab />
      )}
    </div>
  )
}