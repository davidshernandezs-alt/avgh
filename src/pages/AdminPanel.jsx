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
  FaCircleQuestion
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
  createInscription,
  setUserAffiliation
} from '../data/useData'
import { formatDate } from '../components/ActivityCard'
import { localize } from '../utils/localized'
import { fileToStorable } from '../utils/files'
import { CURRENCY } from '../config'
import { ref, onValue, off } from 'firebase/database'
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
import Toggle from '../components/Toggle'

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
        <div className="panel-head">
          <FaUserShield />
          <h3>{t('admin.requestsTitle')}</h3>
          <button className="btn btn-outline btn-sm" onClick={exportExcel}>
            <FaFileExcel /> Descargar ventas del día (Excel)
          </button>
        </div>
        {loading ? (
          <div className="loading">{t('cat.loading')}</div>
        ) : rows.length === 0 ? (
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
                {rows.map((r) => {
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
                const c = receipt.comprobante
                const isPdf = c.startsWith('data:application/pdf')
                return isPdf ? (
                  <div className="receipt-preview">
                    <FaFilePdf className="receipt-icon-lg" />
                    <a className="btn btn-primary btn-sm" href={c} target="_blank" rel="noopener noreferrer">
                      <FaFilePdf /> {t('profile.openPdf')} · {receipt.comprobanteNombre}
                    </a>
                  </div>
                ) : (
                  <a className="receipt-preview" href={c} target="_blank" rel="noopener noreferrer">
                    <img src={c} alt={t('admin.receiptYes')} className="receipt-img" />
                  </a>
                )
              })()
            ) : (
              <p className="admin-warning"><FaCircleXmark /> {t('admin.noReceipt')}</p>
            )}
          </div>

          <div className="admin-validate">
            <label className="field-label">
              <span><FaNoteSticky /> {t('admin.notePlaceholder')}</span>
              <textarea className="input textarea" value={nota} onChange={(e) => setNota(e.target.value)} placeholder={t('admin.notePlaceholder')} />
            </label>
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
            <a
              className="btn btn-outline btn-block"
              style={{ marginTop: '10px' }}
              target="_blank"
              rel="noopener noreferrer"
              href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(row.user?.email || '')}&su=${encodeURIComponent('Carnet QR de Inscripción - AVGH')}&body=${encodeURIComponent(`Hola ${row.user?.nombres || ''},\n\nTus datos e inscripción al curso "${activ ? localize(activ.titulo, lang) : ''}" han sido procesados y validados con éxito.\n\nAdjunto a este correo encontrarás tu Carnet de Acceso en PDF que incluye tu código QR oficial y los datos de tu inscripción ya pagada. También puedes consultar o presentar tu código QR en cualquier momento desde tu perfil de usuario en la plataforma.\n\n¡Te esperamos!\nAsociación Venezolana de Gestión Humana (AVGH)`)}`}
            >
              ✉️ Enviar QR por correo al participante (Gmail)
            </a>
            <button className="btn btn-outline btn-block" style={{ marginTop: '8px' }} onClick={() => setShowTicket(true)}>
              🖨️ Ver y Descargar Carnet PDF del Participante
            </button>
            {showTicket && (
              <TicketModal
                user={{ uid: row.uid, email: row.user?.email, ...row.user }}
                insc={row}
                act={activ}
                factura={row.factura}
                onClose={() => setShowTicket(false)}
              />
            )}
            {msg && <p className="form-success">{msg}</p>}
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

function useAdminRealtimeAlerts() {
  const [alertMsg, setAlertMsg] = useState(null)

  useEffect(() => {
    const usersRef = ref(db, `${DB_ROOT}/users`)
    const inscRef = ref(db, `${DB_ROOT}/inscripciones`)
    const affRef = ref(db, `${DB_ROOT}/afiliaciones_solicitudes`)

    let knownUsers = null
    let initInsc = true
    let initAff = true

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
      const keys = Object.keys(snap.val() || {})
      if (!knownUsers) {
        knownUsers = new Set(keys)
        return
      }
      const hasNewUser = keys.some((key) => !knownUsers.has(key))
      knownUsers = new Set(keys)
      if (!hasNewUser) return
      playBeep()
      setAlertMsg('🔔 ¡Nuevo usuario registrado en el sistema!')
      setTimeout(() => setAlertMsg(null), 8000)
    })

    const unsubInsc = onValue(inscRef, () => {
      if (initInsc) {
        initInsc = false
        return
      }
      playBeep()
      setAlertMsg('🔔 ¡Nueva inscripción a un curso o taller recibida!')
      setTimeout(() => setAlertMsg(null), 8000)
    })

    const unsubAff = onValue(affRef, (snap) => {
      if (initAff) {
        initAff = false
        return
      }
      const pending = Object.values(snap.val() || {}).some(
        (request) => request?.estado === 'pendiente'
      )
      if (!pending) return
      playBeep()
      setAlertMsg('🔔 ¡Nueva solicitud de afiliación! Revisa los recaudos y aprueba la solicitud.')
      setTimeout(() => setAlertMsg(null), 8000)
    })

    return () => {
      off(usersRef, 'value', unsubUsers)
      off(inscRef, 'value', unsubInsc)
      off(affRef, 'value', unsubAff)
    }
  }, [])

  return alertMsg
}

function InscribedTab() {
  const { t, lang } = useLang()
  const { rows, loading } = useAllInscripciones()
  const { items: actividades } = useActivities()
  const [search, setSearch] = useState('')
  const [filterAct, setFilterAct] = useState('')
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const [affPlan, setAffPlan] = useState({})
  const [certRow, setCertRow] = useState(null)
  const excelInputRef = useRef(null)

  const planFor = (uid) => affPlan[uid] || 'individual'

  const makeAffiliate = async (row) => {
    const plan = planFor(row.uid)
    const planName = plan === 'corporativo' ? 'corporativo' : 'individual'
    const participant = `${row.user?.nombres || ''} ${row.user?.apellidos || ''}`.trim() || row.user?.email || 'este participante'
    if (!window.confirm(`¿Convertir a ${participant} en afiliado ${planName}?`)) return
    try {
      await setUserAffiliation({
        uid: row.uid,
        tipoAfiliacion: plan,
        afiliado: true,
        userData: row.user
      })
      alert(`✅ ${participant} quedó como afiliado ${planName} activo.`)
    } catch (error) {
      console.error(error)
      alert('Error al actualizar el estado de afiliado.')
    }
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const name = `${r.user?.nombres || ''} ${r.user?.apellidos || ''} ${r.user?.dni || ''}`.toLowerCase()
      const matchSearch = name.includes(search.toLowerCase())
      const matchAct = filterAct ? r.actividadId === filterAct : true
      return matchSearch && matchAct
    })
  }, [rows, search, filterAct])

  const actTitle = (id) => {
    const a = actividades.find((x) => x.id === id)
    return a ? localize(a.titulo, lang) : id
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
        nombres: 'ALMER',
        apellidos: 'BRACAMONTE',
        dni: '11926888',
        email: 'almer.bracamonte@gmail.com',
        tipoAsistente: 'regular'
      },
      {
        nombres: 'RAQUEL',
        apellidos: 'HERRERA',
        dni: '10382857',
        email: 'raherrera71@gmail.com',
        tipoAsistente: 'regular'
      }
    ]
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Inscritos')
    XLSX.writeFile(workbook, 'Plantilla_Inscritos_AVGH.csv', { bookType: 'csv' })
  }

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!filterAct) {
      alert('Por favor selecciona primero el Curso/Evento en el desplegable al que deseas inscribir a las personas del archivo.')
      e.target.value = ''
      return
    }

    const selectedAct = actividades.find((a) => a.id === filterAct)
    if (!selectedAct) {
      alert('Curso no encontrado.')
      e.target.value = ''
      return
    }

    setUploading(true)
    setUploadMsg('Procesando archivo...')

    try {
      const arrayBuffer = await file.arrayBuffer()
      let jsonRows = []

      // Intentar leer con XLSX (soporta .xlsx, .xls y .csv automáticamente)
      try {
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
      } catch {
        // Fallback como texto plano CSV / TSV
        const text = new TextDecoder().decode(arrayBuffer)
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
        if (lines.length > 0) {
          const firstLine = lines[0]
          const separator = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ','
          const headers = firstLine.split(separator).map(h => h.replace(/^["'\uFEFF]|["']$/g, '').trim().toLowerCase())
          
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(separator).map(c => c.replace(/^["']|["']$/g, '').trim())
            const rowObj = {}
            headers.forEach((h, idx) => {
              rowObj[h] = cols[idx] || ''
            })
            jsonRows.push(rowObj)
          }
        }
      }

      if (!jsonRows || jsonRows.length === 0) {
        setUploadMsg('El archivo está vacío o no se pudieron leer filas.')
        setUploading(false)
        return
      }

      let count = 0
      for (const row of jsonRows) {
        // Buscar campos sin importar mayúsculas, minúsculas o variaciones
        const keys = Object.keys(row)
        const findKey = (terms) => {
          const found = keys.find(k => terms.some(t => k.toLowerCase().includes(t)))
          return found ? String(row[found] || '').trim() : ''
        }

        const nombres = findKey(['nombre', 'nombres'])
        const apellidos = findKey(['apellido', 'apellidos'])
        const dni = findKey(['dni', 'cedula', 'cédula', 'documento', 'ci'])
        const email = findKey(['email', 'correo', 'mail'])
        const rawTipo = findKey(['tipo', 'asistente']).toLowerCase()
        const tipoAsistente = rawTipo.includes('invitad')
          ? 'invitado'
          : rawTipo.includes('exonerad')
            ? 'exonerado'
            : rawTipo.includes('facilitad')
              ? 'facilitador'
              : rawTipo.includes('junta')
                ? 'junta'
                : rawTipo.includes('noafiliad')
                  ? 'noafiliado'
                  : rawTipo.includes('afiliad')
                    ? 'afiliado'
                    : 'regular'

        if (nombres && dni) {
          const fakeUid = `import_${Date.now()}_${Math.floor(Math.random() * 10000)}`
          const fakeUser = {
            nombres,
            apellidos,
            dni,
            email: email || `${dni}@avgh.local`
          }
          await createInscription({
            uid: fakeUid,
            actividad: selectedAct,
            user: fakeUser,
            metodoPago: 'cash',
            estado: 'confirmada',
            tipoAsistente,
            presente: false
          })
          count++
        }
      }

      if (count === 0) {
        setUploadMsg('No se encontraron registros válidos (se requiere al menos nombre y cédula/dni por fila).')
      } else {
        setUploadMsg(`✅ ¡Éxito! Se registraron ${count} inscritos en el evento "${localize(selectedAct.titulo, lang)}".`)
      }
    } catch (err) {
      console.error(err)
      setUploadMsg('Error al leer el archivo. Verifica el formato.')
    } finally {
      setUploading(false)
      e.target.value = ''
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
      </div>

      {loading ? (
        <p className="loading">Cargando inscritos...</p>
      ) : filtered.length === 0 ? (
        <p className="auth-hint">No se encontraron inscripciones con los filtros seleccionados.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
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
                      <div className="member-actions" style={{ flexWrap: 'wrap', gap: '6px' }}>
                        {isPresent && canIssueCertificate(r.tipoAsistente) ? (
                          <button className="btn btn-outline btn-sm" onClick={() => setCertRow(r)}>
                            <FaAward /> Generar certificado
                          </button>
                        ) : null}
                        {!isAffiliate && (
                          <>
                            <select
                              className="input"
                              style={{ maxWidth: '130px' }}
                              value={planFor(r.uid)}
                              onChange={(event) =>
                                setAffPlan((prev) => ({ ...prev, [r.uid]: event.target.value }))
                              }
                              aria-label="Plan de afiliación"
                            >
                              <option value="individual">Individual</option>
                              <option value="corporativo">Corporativo</option>
                            </select>
                            <button className="btn btn-outline btn-sm" onClick={() => makeAffiliate(r)}>
                              Hacer Afiliado
                            </button>
                          </>
                        )}
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
    </section>
  )
}

export default function AdminPanel() {
  const { t } = useLang()
  const { profile, logout } = useAuth()
  const [tab, setTab] = useState('requests')
  const liveAlert = useAdminRealtimeAlerts()

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
      {liveAlert && (
        <div className="admin-live-alert">
          <span>{liveAlert}</span>
          <button className="btn btn-primary btn-sm" onClick={() => setTab('requests')}>
            Ver solicitudes
          </button>
        </div>
      )}
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